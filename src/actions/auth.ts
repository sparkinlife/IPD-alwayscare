"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";

export async function login(_prevState: unknown, formData: FormData) {
  const phone = formData.get("phone") as string;
  const password = formData.get("password") as string;
  let redirectTo = "/";

  if (!phone || !password) {
    return { error: "Phone and password are required" };
  }

  try {
    const staff = await db.staff.findUnique({ where: { phone } });
    if (!staff || !staff.isActive || staff.deletedAt) {
      return { error: "Invalid phone number or password" };
    }

    const valid = await bcrypt.compare(password, staff.passwordHash);
    if (!valid) {
      return { error: "Invalid phone number or password" };
    }

    await createSession(staff.id, staff.role);
    if (staff.role === "MANAGEMENT") {
      redirectTo = "/management";
    }
  } catch (error) {
    console.error("Login action failed:", error);
    return { error: "Something went wrong. Please try again." };
  }
  redirect(redirectTo);
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
