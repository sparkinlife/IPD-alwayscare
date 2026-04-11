import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/features"];
const MANAGEMENT_PATH_PREFIX = "/management";

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow cron API routes (authenticated via CRON_SECRET header, not session)
  if (pathname.startsWith("/api/cron")) {
    return NextResponse.next();
  }

  // Allow static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/favicon") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/sw.js.map" ||
    pathname.startsWith("/swe-worker-")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("ipd-session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Lightweight JWT verification (no DB call in proxy)
  try {
    const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!);
    const { jwtVerify } = await import("jose");
    const { payload } = await jwtVerify(token, SECRET);
    if (!payload) throw new Error("Invalid token");

    const role = payload.role as string | undefined;
    const isManagement = role === "MANAGEMENT";
    const isManagementPath =
      pathname === MANAGEMENT_PATH_PREFIX ||
      pathname.startsWith(`${MANAGEMENT_PATH_PREFIX}/`);
    const isApiPath = pathname.startsWith("/api/");

    if (isManagement) {
      // Management users are constrained to the external read-only portal.
      if (pathname === "/") {
        return NextResponse.redirect(new URL(MANAGEMENT_PATH_PREFIX, request.url));
      }
      if (!isManagementPath && !isApiPath) {
        return NextResponse.redirect(new URL(MANAGEMENT_PATH_PREFIX, request.url));
      }
    } else if (isManagementPath) {
      // Internal staff should not enter management-only routes.
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("ipd-session");
    return response;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|icons|manifest\\.webmanifest|sw\\.js|swe-worker-).*)"],
};
