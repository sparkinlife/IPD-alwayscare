"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth, requireDoctor } from "@/lib/auth";
import { handleActionError } from "@/lib/action-utils";
import { markDeletedInDrive } from "@/lib/google-auth";

export async function logDisinfection(isolationProtocolId: string) {
  try {
    const session = await requireAuth();

    const protocol = await db.isolationProtocol.findUnique({
      where: { id: isolationProtocolId },
      select: { admissionId: true },
    });
    if (!protocol) return { error: "Isolation protocol not found" };

    const disinfectionLog = await db.disinfectionLog.create({
      data: { isolationProtocolId, performedById: session.staffId },
    });

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
      select: { pcrStatus: true, admissionId: true },
    });
    if (!currentProtocol) return { error: "Protocol not found" };

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

    const protocol = await db.isolationProtocol.update({
      where: { id: protocolId },
      data,
    });
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
      select: { admissionId: true },
    });
    if (!protocol) return { error: "Protocol not found" };

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
      select: { isolationProtocol: { select: { admissionId: true } } },
    });
    if (!log) return { error: "Disinfection log not found" };

    const proofs = await db.proofAttachment.findMany({
      where: { recordId: logId, recordType: "DisinfectionLog" },
      select: { fileId: true, fileName: true },
    });
    await markDeletedInDrive(proofs);

    await db.proofAttachment.deleteMany({
      where: { recordId: logId, recordType: "DisinfectionLog" },
    });

    await db.disinfectionLog.delete({ where: { id: logId } });
    revalidatePath("/patients/[admissionId]", "page");
    revalidatePath("/isolation");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}
