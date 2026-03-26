"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth, requireDoctor } from "@/lib/auth";

function handleActionError(error: unknown): { error: string } {
  if (error && typeof error === "object" && "digest" in error) throw error;
  if (error instanceof Error) {
    if (error.message === "Unauthorized") return { error: "Please log in again" };
    if (error.message.startsWith("Forbidden")) return { error: error.message };
    if (error.message.startsWith("Invalid")) return { error: error.message };
  }
  return { error: "An unexpected error occurred" };
}

export async function logDisinfection(isolationProtocolId: string) {
  try {
    const session = await requireAuth();

    const protocol = await db.isolationProtocol.findUnique({
      where: { id: isolationProtocolId },
      select: { admissionId: true },
    });
    if (!protocol) return { error: "Isolation protocol not found" };

    await db.disinfectionLog.create({
      data: { isolationProtocolId, performedById: session.staffId },
    });

    revalidatePath(`/patients/${protocol.admissionId}`);
    revalidatePath("/isolation");
    return { success: true };
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
    const isCleared = formData.get("isCleared") === "true";

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
    if (isCleared) {
      data.isCleared = true;
      data.clearedDate = new Date();
    }

    const protocol = await db.isolationProtocol.update({
      where: { id: protocolId },
      data,
    });
    revalidatePath(`/patients/${protocol.admissionId}`);
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

    revalidatePath(`/patients/${protocol.admissionId}`);
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

    await db.disinfectionLog.delete({ where: { id: logId } });
    revalidatePath(`/patients/${log.isolationProtocol.admissionId}`);
    revalidatePath("/isolation");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}
