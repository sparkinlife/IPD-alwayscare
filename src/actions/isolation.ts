"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth, requireDoctor } from "@/lib/auth";

export async function logDisinfection(isolationProtocolId: string) {
  const session = await requireAuth();
  await db.disinfectionLog.create({
    data: { isolationProtocolId, performedById: session.staffId },
  });
  const protocol = await db.isolationProtocol.findUnique({
    where: { id: isolationProtocolId },
    select: { admissionId: true },
  });
  revalidatePath(`/patients/${protocol?.admissionId}`);
  revalidatePath("/isolation");
  return { success: true };
}

export async function updateIsolationProtocol(
  protocolId: string,
  formData: FormData
) {
  await requireDoctor();
  const pcrStatus = formData.get("pcrStatus") as string;
  const pcrTrend = (formData.get("pcrTrend") as string) || undefined;
  const isCleared = formData.get("isCleared") === "true";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (pcrStatus) {
    data.pcrStatus = pcrStatus;
    data.lastPcrDate = new Date();
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
}
