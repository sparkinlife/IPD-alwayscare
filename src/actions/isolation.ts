"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireDoctor, requireWriteAccess } from "@/lib/auth";
import { handleActionError } from "@/lib/action-utils";
import { markDeletedInDrive } from "@/lib/google-auth";
import {
  getIsolationMutationTags,
  updateClinicalTags,
} from "@/lib/clinical-revalidation";
import { invalidateDashboardTags } from "@/lib/dashboard-revalidation";

export async function logDisinfection(isolationProtocolId: string) {
  try {
    const session = await requireWriteAccess();

    const protocol = await db.isolationProtocol.findUnique({
      where: { id: isolationProtocolId },
      select: {
        admissionId: true,
        admission: { select: { deletedAt: true, status: true } },
      },
    });
    if (!protocol) return { error: "Isolation protocol not found" };
    if (protocol.admission.deletedAt || protocol.admission.status !== "ACTIVE") {
      return { error: "Admission is no longer active" };
    }

    const disinfectionLog = await db.disinfectionLog.create({
      data: { isolationProtocolId, performedById: session.staffId },
    });

    updateClinicalTags(getIsolationMutationTags(protocol.admissionId));
    revalidatePath("/patients/[admissionId]", "page");
    revalidatePath("/isolation");
    return { success: true, id: disinfectionLog.id };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateIsolationProtocol(
  protocolId: string,
  formData: FormData
) {
  try {
    await requireDoctor();

    // Fetch current protocol to compare pcrStatus
    const currentProtocol = await db.isolationProtocol.findUnique({
      where: { id: protocolId },
      select: {
        pcrStatus: true,
        admissionId: true,
        admission: { select: { deletedAt: true, status: true } },
      },
    });
    if (!currentProtocol) return { error: "Protocol not found" };
    if (
      currentProtocol.admission.deletedAt ||
      currentProtocol.admission.status !== "ACTIVE"
    ) {
      return { error: "Admission is no longer active" };
    }

    const pcrStatus = formData.get("pcrStatus") as string;
    const pcrTrend = (formData.get("pcrTrend") as string) || undefined;
    const isClearedValue = formData.get("isCleared");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};

    // Only update lastPcrDate if the status actually changed
    if (pcrStatus && pcrStatus !== currentProtocol.pcrStatus) {
      data.pcrStatus = pcrStatus;
      data.lastPcrDate = new Date();
    } else if (pcrStatus) {
      data.pcrStatus = pcrStatus;
    }

    if (pcrTrend) data.pcrTrend = pcrTrend;
    if (isClearedValue === "true") {
      data.isCleared = true;
      data.clearedDate = new Date();
    } else if (isClearedValue === "false") {
      data.isCleared = false;
      data.clearedDate = null;
    }

    await db.isolationProtocol.update({
      where: { id: protocolId },
      data,
    });
    updateClinicalTags(getIsolationMutationTags(currentProtocol.admissionId));
    revalidatePath("/patients/[admissionId]", "page");
    revalidatePath("/isolation");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateIsolationSetup(protocolId: string, formData: FormData) {
  try {
    await requireDoctor();

    const protocol = await db.isolationProtocol.findUnique({
      where: { id: protocolId },
      select: {
        admissionId: true,
        admission: { select: { deletedAt: true, status: true } },
      },
    });
    if (!protocol) return { error: "Protocol not found" };
    if (protocol.admission.deletedAt || protocol.admission.status !== "ACTIVE") {
      return { error: "Admission is no longer active" };
    }

    const disease = formData.get("disease") as string;
    const ppeJson = formData.get("ppeRequired") as string;
    const disinfectant = formData.get("disinfectant") as string;
    const disinfectionInterval = formData.get("disinfectionInterval") as string;
    const biosecurityNotes = (formData.get("biosecurityNotes") as string) || null;

    if (!disease) return { error: "Disease is required" };

    let ppeRequired: string[] = [];
    if (ppeJson) {
      try {
        ppeRequired = JSON.parse(ppeJson);
      } catch {
        return { error: "Invalid PPE format" };
      }
    }

    await db.isolationProtocol.update({
      where: { id: protocolId },
      data: {
        disease,
        ppeRequired,
        disinfectant: disinfectant || "Quaternary ammonium compound",
        disinfectionInterval: disinfectionInterval || "Q4H",
        biosecurityNotes,
      },
    });

    invalidateDashboardTags("setup");
    updateClinicalTags(getIsolationMutationTags(protocol.admissionId));
    revalidatePath("/patients/[admissionId]", "page");
    revalidatePath("/isolation");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deleteDisinfectionLog(logId: string) {
  try {
    await requireDoctor();

    const log = await db.disinfectionLog.findUnique({
      where: { id: logId },
      select: {
        isolationProtocol: {
          select: {
            admissionId: true,
            admission: { select: { deletedAt: true, status: true } },
          },
        },
      },
    });
    if (!log) return { error: "Disinfection log not found" };
    if (
      log.isolationProtocol.admission.deletedAt ||
      log.isolationProtocol.admission.status !== "ACTIVE"
    ) {
      return { error: "Admission is no longer active" };
    }

    const proofs = await db.proofAttachment.findMany({
      where: { recordId: logId, recordType: "DisinfectionLog" },
      select: { fileId: true, fileName: true },
    });
    await markDeletedInDrive(proofs);

    await db.proofAttachment.deleteMany({
      where: { recordId: logId, recordType: "DisinfectionLog" },
    });

    await db.disinfectionLog.delete({ where: { id: logId } });
    updateClinicalTags(getIsolationMutationTags(log.isolationProtocol.admissionId));
    revalidatePath("/patients/[admissionId]", "page");
    revalidatePath("/isolation");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}
