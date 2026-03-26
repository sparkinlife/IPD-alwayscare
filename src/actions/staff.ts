"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { StaffRole } from "@prisma/client";

function assertAdminOrDoctor(role: string) {
  if (role !== "ADMIN" && role !== "DOCTOR") {
    throw new Error("Forbidden: Admin or Doctor access required");
  }
}

export async function createStaff(_prevState: unknown, formData: FormData) {
  const session = await requireAuth();
  assertAdminOrDoctor(session.role);

  const name = (formData.get("name") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const password = formData.get("password") as string;
  const role = formData.get("role") as StaffRole;

  if (!name || !phone || !password || !role) {
    return { error: "All fields are required" };
  }

  const validRoles: StaffRole[] = ["DOCTOR", "PARAVET", "ATTENDANT", "ADMIN"];
  if (!validRoles.includes(role)) {
    return { error: "Invalid role" };
  }

  const existing = await db.staff.findUnique({ where: { phone } });
  if (existing) {
    return { error: "A staff member with this phone number already exists" };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db.staff.create({
    data: { name, phone, passwordHash, role },
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function toggleStaffActive(staffId: string) {
  const session = await requireAuth();
  assertAdminOrDoctor(session.role);

  const staff = await db.staff.findUnique({ where: { id: staffId } });
  if (!staff) {
    return { error: "Staff member not found" };
  }

  const newActive = !staff.isActive;

  await db.staff.update({
    where: { id: staffId },
    data: { isActive: newActive },
  });

  // If deactivating, delete all sessions to force logout
  if (!newActive) {
    await db.session.deleteMany({ where: { staffId } });
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function resetStaffPassword(staffId: string, newPassword: string) {
  const session = await requireAuth();
  assertAdminOrDoctor(session.role);

  if (!newPassword || newPassword.length < 4) {
    return { error: "Password must be at least 4 characters" };
  }

  const staff = await db.staff.findUnique({ where: { id: staffId } });
  if (!staff) {
    return { error: "Staff member not found" };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await db.staff.update({
    where: { id: staffId },
    data: { passwordHash },
  });

  // Invalidate all existing sessions
  await db.session.deleteMany({ where: { staffId } });

  revalidatePath("/admin");
  return { success: true };
}

export async function addCage(_prevState: unknown, formData: FormData) {
  const session = await requireAuth();
  assertAdminOrDoctor(session.role);

  const ward = formData.get("ward") as string;
  const cageNumber = (formData.get("cageNumber") as string)?.trim();

  if (!ward || !cageNumber) {
    return { error: "Ward and cage number are required" };
  }

  const validWards = ["GENERAL", "ISOLATION", "ICU"];
  if (!validWards.includes(ward)) {
    return { error: "Invalid ward" };
  }

  const existing = await db.cageConfig.findUnique({
    where: { ward_cageNumber: { ward: ward as "GENERAL" | "ISOLATION" | "ICU", cageNumber } },
  });
  if (existing) {
    return { error: "A cage with this ward and number already exists" };
  }

  await db.cageConfig.create({
    data: { ward: ward as "GENERAL" | "ISOLATION" | "ICU", cageNumber },
  });

  revalidatePath("/admin");
  return { success: true };
}

export async function toggleCageActive(cageId: string) {
  const session = await requireAuth();
  assertAdminOrDoctor(session.role);

  const cage = await db.cageConfig.findUnique({ where: { id: cageId } });
  if (!cage) {
    return { error: "Cage not found" };
  }

  await db.cageConfig.update({
    where: { id: cageId },
    data: { isActive: !cage.isActive },
  });

  revalidatePath("/admin");
  return { success: true };
}
