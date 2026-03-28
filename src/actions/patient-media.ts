"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireDoctor, requireWriteAccess } from "@/lib/auth";
import { handleActionError } from "@/lib/action-utils";
import { markDeletedInDrive } from "@/lib/google-auth";

export async function savePatientMedia(
  patientId: string,
  files: Array<{ fileUrl: string; fileId: string; fileName: string; mimeType: string }>,
  setAsProfile: boolean
) {
  try {
    const session = await requireWriteAccess();

    const patient = await db.patient.findUnique({
      where: { id: patientId },
      select: { id: true, deletedAt: true },
    });
    if (!patient || patient.deletedAt) return { error: "Patient not found" };

    if (files.length === 0) return { success: true };

    if (setAsProfile) {
      await db.patientMedia.updateMany({
        where: { patientId, isProfilePhoto: true },
        data: { isProfilePhoto: false },
      });
    }

    await db.patientMedia.createMany({
      data: files.map((f, index) => ({
        patientId,
        fileUrl: f.fileUrl,
        fileId: f.fileId,
        fileName: f.fileName,
        mimeType: f.mimeType,
        isProfilePhoto: setAsProfile && index === 0,
        uploadedById: session.staffId,
      })),
    });

    revalidatePath("/patients");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deletePatientMedia(mediaId: string) {
  try {
    await requireDoctor();

    const media = await db.patientMedia.findUnique({
      where: { id: mediaId },
      select: { id: true, patientId: true, fileId: true, fileName: true, isProfilePhoto: true },
    });
    if (!media) return { error: "Media not found" };

    await markDeletedInDrive([{ fileId: media.fileId, fileName: media.fileName }]);

    await db.patientMedia.delete({ where: { id: mediaId } });

    if (media.isProfilePhoto) {
      const next = await db.patientMedia.findFirst({
        where: { patientId: media.patientId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (next) {
        await db.patientMedia.update({
          where: { id: next.id },
          data: { isProfilePhoto: true },
        });
      }
    }

    revalidatePath("/patients");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function setProfilePhoto(mediaId: string) {
  try {
    await requireWriteAccess();

    const media = await db.patientMedia.findUnique({
      where: { id: mediaId },
      select: { id: true, patientId: true, mimeType: true },
    });
    if (!media) return { error: "Media not found" };
    if (!media.mimeType.startsWith("image/")) return { error: "Only images can be set as profile photo" };

    await db.$transaction(async (tx: any) => {
      await tx.patientMedia.updateMany({
        where: { patientId: media.patientId, isProfilePhoto: true },
        data: { isProfilePhoto: false },
      });
      await tx.patientMedia.update({
        where: { id: mediaId },
        data: { isProfilePhoto: true },
      });
    });

    revalidatePath("/patients");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}
