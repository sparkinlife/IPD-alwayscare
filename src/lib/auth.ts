import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!);
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const COOKIE_NAME = "ipd-session";
const LAST_SEEN_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

function isManagementRole(role: string): boolean {
  return role === "MANAGEMENT";
}

export async function createSession(staffId: string, role: string) {
  const session = await db.session.create({
    data: {
      staffId,
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    },
  });

  await db.staff.update({
    where: { id: staffId },
    data: { lastSeenAt: new Date() },
  });

  const token = await new SignJWT({ sid: session.id, uid: staffId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });

  return session;
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const session = await db.session.findUnique({
      where: { id: payload.sid as string },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            role: true,
            isActive: true,
            deletedAt: true,
            lastSeenAt: true,
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date() || !session.staff.isActive || session.staff.deletedAt) {
      return null;
    }

    if (isManagementRole(session.staff.role)) {
      const now = Date.now();
      const lastSeen = session.staff.lastSeenAt?.getTime() ?? 0;
      if (now - lastSeen > LAST_SEEN_REFRESH_MS) {
        await db.staff.update({
          where: { id: session.staff.id },
          data: { lastSeenAt: new Date() },
        });
      }
    }

    return {
      sessionId: session.id,
      staffId: session.staff.id,
      name: session.staff.name,
      role: session.staff.role,
    };
  } catch {
    return null;
  }
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET);
      await db.session.delete({ where: { id: payload.sid as string } }).catch(() => {});
    } catch {
      // Token invalid — just clear the cookie
    }
  }

  cookieStore.delete(COOKIE_NAME);
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function requireDoctor() {
  const session = await requireAuth();
  if (session.role !== "DOCTOR" && session.role !== "ADMIN") {
    throw new Error("Forbidden: Doctor or Admin only");
  }
  return session;
}

export async function requireWriteAccess() {
  const session = await requireAuth();
  if (isManagementRole(session.role)) {
    throw new Error("Forbidden: Management accounts are read-only");
  }
  return session;
}

export async function requireManagement() {
  const session = await requireAuth();
  if (!isManagementRole(session.role)) {
    throw new Error("Forbidden: Management access only");
  }
  return session;
}

export async function requireInternalStaff() {
  const session = await requireAuth();
  if (isManagementRole(session.role)) {
    throw new Error("Forbidden: Internal staff access only");
  }
  return session;
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload;
  } catch {
    return null;
  }
}
