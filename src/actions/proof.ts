"use server";

import { db } from "@/lib/db";
import { requireAuth, requireDoctor } from "@/lib/auth";
import { handleActionError } from "@/lib/action-utils";
import { markDeletedInDrive } from "@/lib/google-auth";

export async function saveProofAttachments(
  recordId: string,
  recordType: string,
  category: string,
  fileData: Array<{ fileUrl: string; fileId: string; fileName: string }>
) {
  try {
    const session = await requireAuth();
    if (fileData.length === 0) return { success: true };
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

export async function getProofAttachments(recordId: string, recordType: string) {
  try {
    await requireAuth();
    const proofs = await db.proofAttachment.findMany({
      where: { recordId, recordType },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return { proofs };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deleteProofAttachment(attachmentId: string) {
  try {
    await requireDoctor();

    const proof = await db.proofAttachment.findUnique({
      where: { id: attachmentId },
      select: { fileId: true, fileName: true },
    });
    if (!proof) return { error: "Proof not found" };

    await markDeletedInDrive([proof]);

    await db.proofAttachment.delete({ where: { id: attachmentId } });
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
