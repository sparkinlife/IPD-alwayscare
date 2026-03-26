"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { validateNoteCategory } from "@/lib/validators";

function handleActionError(error: unknown): { error: string } {
  if (error && typeof error === "object" && "digest" in error) throw error;
  if (error instanceof Error) {
    if (error.message === "Unauthorized") return { error: "Please log in again" };
    if (error.message.startsWith("Forbidden")) return { error: error.message };
    if (error.message.startsWith("Invalid")) return { error: error.message };
  }
  return { error: "An unexpected error occurred" };
}

export async function addNote(admissionId: string, formData: FormData) {
  try {
    const session = await requireAuth();

    const admission = await db.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, deletedAt: true },
    });
    if (!admission || admission.deletedAt) return { error: "Admission not found" };

    const category = formData.get("category") as string;
    const content = formData.get("content") as string;
    if (!category || !content) return { error: "Category and content are required" };

    await db.clinicalNote.create({
      data: { admissionId, category: validateNoteCategory(category), content, recordedById: session.staffId },
    });
    revalidatePath(`/patients/${admissionId}`);
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}
