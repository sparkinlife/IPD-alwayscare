"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth, requireDoctor } from "@/lib/auth";
import { handleActionError } from "@/lib/action-utils";
import { markDeletedInDrive } from "@/lib/google-auth";

export async function logBath(admissionId: string, formData: FormData) {
  try {
    const session = await requireAuth();

    const admission = await db.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, deletedAt: true, status: true },
    });
    if (!admission || admission.deletedAt) return { error: "Admission not found" };
    if (admission.status !== "ACTIVE") return { error: "Admission is no longer active" };

    const notes = (formData.get("notes") as string) || undefined;
    const bathLog = await db.bathLog.create({
      data: { admissionId, bathedById: session.staffId, notes },
    });
    revalidatePath("/patients/[admissionId]", "page");
    revalidatePath("/");
    revalidatePath("/schedule");
    return { success: true, id: bathLog.id };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateBath(bathId: string, formData: FormData) {
  try {
    await requireDoctor();

    const bath = await db.bathLog.findUnique({
      where: { id: bathId },
      select: {
        admissionId: true,
        admission: { select: { deletedAt: true, status: true } },
      },
    });
    if (!bath) return { error: "Bath log not found" };
    if (bath.admission.deletedAt || bath.admission.status !== "ACTIVE") {
      return { error: "Admission is no longer active" };
    }

    const notes = (formData.get("notes") as string) || null;

    await db.bathLog.update({
      where: { id: bathId },
      data: { notes },
    });

    revalidatePath("/patients/[admissionId]", "page");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deleteBath(bathId: string) {
  try {
    await requireDoctor();

    const bath = await db.bathLog.findUnique({
      where: { id: bathId },
      select: {
        admissionId: true,
        admission: { select: { deletedAt: true, status: true } },
      },
    });
    if (!bath) return { error: "Bath log not found" };
    if (bath.admission.deletedAt || bath.admission.status !== "ACTIVE") {
      return { error: "Admission is no longer active" };
    }

    const proofs = await db.proofAttachment.findMany({
      where: { recordId: bathId, recordType: "BathLog" },
      select: { fileId: true, fileName: true },
    });
    await markDeletedInDrive(proofs);

    await db.proofAttachment.deleteMany({
      where: { recordId: bathId, recordType: "BathLog" },
    });

    await db.bathLog.delete({ where: { id: bathId } });
    revalidatePath("/patients/[admissionId]", "page");
    revalidatePath("/");
    revalidatePath("/schedule");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}
