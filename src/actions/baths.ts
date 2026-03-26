"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function logBath(admissionId: string, formData: FormData) {
  const session = await requireAuth();
  const notes = (formData.get("notes") as string) || undefined;
  await db.bathLog.create({
    data: { admissionId, bathedById: session.staffId, notes },
  });
  revalidatePath(`/patients/${admissionId}`);
  revalidatePath("/");
  revalidatePath("/schedule");
  return { success: true };
}
