"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleActionError } from "@/lib/action-utils";

export async function saveProofAttachments(
  recordId: string,
  recordType: string,
  category: string,
  fileData: Array<{ fileUrl: string; fileId: string; fileName: string }>
) {
  try {
    if (fileData.length === 0) return { success: true };
    const session = await requireAuth();
    await db.proofAttachment.createMany({
      data: fileData.map((f) => ({
        recordId,
        recordType,
        category,
        fileUrl: f.fileUrl,
        fileId: f.fileId,
        fileName: f.fileName,
        uploadedById: session.staffId,
      })),
    });
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function saveSkippedProof(
  recordId: string,
  recordType: string,
  category: string,
  skipReason: string
) {
  try {
    const session = await requireAuth();
    await db.proofAttachment.create({
      data: {
        recordId,
        recordType,
        category,
        fileUrl: "SKIPPED",
        fileId: "SKIPPED",
        fileName: "SKIPPED",
        skipReason,
        uploadedById: session.staffId,
      },
    });
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}
