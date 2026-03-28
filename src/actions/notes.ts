"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth, requireDoctor } from "@/lib/auth";
import { validateNoteCategory } from "@/lib/validators";
import { handleActionError } from "@/lib/action-utils";

export async function addNote(admissionId: string, formData: FormData) {
  try {
    const session = await requireAuth();

    const admission = await db.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, deletedAt: true, status: true },
    });
    if (!admission || admission.deletedAt) return { error: "Admission not found" };
    if (admission.status !== "ACTIVE") return { error: "Admission is no longer active" };

    const category = formData.get("category") as string;
    const content = formData.get("content") as string;
    if (!category || !content) return { error: "Category and content are required" };

    await db.clinicalNote.create({
      data: { admissionId, category: validateNoteCategory(category), content, recordedById: session.staffId },
    });
    revalidatePath("/patients/[admissionId]", "page");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateNote(noteId: string, formData: FormData) {
  try {
    await requireDoctor();

    const note = await db.clinicalNote.findUnique({
      where: { id: noteId },
      select: {
        admissionId: true,
        admission: { select: { deletedAt: true, status: true } },
      },
    });
    if (!note) return { error: "Note not found" };
    if (note.admission.deletedAt || note.admission.status !== "ACTIVE") {
      return { error: "Admission is no longer active" };
    }

    const category = formData.get("category") as string;
    const content = formData.get("content") as string;
    if (!category || !content) return { error: "Category and content are required" };

    await db.clinicalNote.update({
      where: { id: noteId },
      data: { category: validateNoteCategory(category), content },
    });

    revalidatePath("/patients/[admissionId]", "page");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deleteNote(noteId: string) {
  try {
    await requireDoctor();

    const note = await db.clinicalNote.findUnique({
      where: { id: noteId },
      select: {
        admissionId: true,
        admission: { select: { deletedAt: true, status: true } },
      },
    });
    if (!note) return { error: "Note not found" };
    if (note.admission.deletedAt || note.admission.status !== "ACTIVE") {
      return { error: "Admission is no longer active" };
    }

    await db.clinicalNote.delete({ where: { id: noteId } });
    revalidatePath("/patients/[admissionId]", "page");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}
