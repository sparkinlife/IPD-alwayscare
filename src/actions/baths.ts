"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

function handleActionError(error: unknown): { error: string } {
  if (error && typeof error === "object" && "digest" in error) throw error;
  if (error instanceof Error) {
    if (error.message === "Unauthorized") return { error: "Please log in again" };
    if (error.message.startsWith("Forbidden")) return { error: error.message };
    if (error.message.startsWith("Invalid")) return { error: error.message };
  }
  return { error: "An unexpected error occurred" };
}

export async function logBath(admissionId: string, formData: FormData) {
  try {
    const session = await requireAuth();

    const admission = await db.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, deletedAt: true },
    });
    if (!admission || admission.deletedAt) return { error: "Admission not found" };

    const notes = (formData.get("notes") as string) || undefined;
    await db.bathLog.create({
      data: { admissionId, bathedById: session.staffId, notes },
    });
    revalidatePath(`/patients/${admissionId}`);
    revalidatePath("/");
    revalidatePath("/schedule");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}
