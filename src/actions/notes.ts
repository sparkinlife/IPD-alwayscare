"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function addNote(admissionId: string, formData: FormData) {
  const session = await requireAuth();
  const category = formData.get("category") as string;
  const content = formData.get("content") as string;
  if (!category || !content) return { error: "Category and content are required" };

  await db.clinicalNote.create({
    data: { admissionId, category: category as any, content, recordedById: session.staffId },
  });
  revalidatePath(`/patients/${admissionId}`);
  return { success: true };
}
