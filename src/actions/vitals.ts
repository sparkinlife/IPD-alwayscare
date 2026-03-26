"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

function handleActionError(error: unknown): { error: string } {
  if (error && typeof error === "object" && "digest" in error) throw error;
  if (error instanceof Error) {
    if (error.message === "Unauthorized") return { error: "Please log in again" };
    if (error.message.startsWith("Forbidden")) return { error: error.message };
    if (error.message.startsWith("Invalid")) return { error: error.message };
  }
  return { error: "An unexpected error occurred" };
}

export async function recordVitals(admissionId: string, formData: FormData) {
  try {
    const session = await requireAuth();

    const admission = await db.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, deletedAt: true },
    });
    if (!admission || admission.deletedAt) return { error: "Admission not found" };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = { admissionId, recordedById: session.staffId };

    const fields = [
      { name: "temperature", parse: parseFloat },
      { name: "heartRate", parse: parseInt },
      { name: "respRate", parse: parseInt },
      { name: "painScore", parse: parseInt },
      { name: "weight", parse: parseFloat },
      { name: "spo2", parse: parseFloat },
      { name: "capillaryRefillTime", parse: parseFloat },
    ];

    for (const { name, parse } of fields) {
      const val = formData.get(name) as string;
      if (val) {
        const parsed = parse(val);
        if (!isNaN(parsed)) data[name] = parsed;
      }
    }

    const bp = formData.get("bloodPressure") as string;
    if (bp) data.bloodPressure = bp;
    const mmc = formData.get("mucousMembraneColor") as string;
    if (mmc) data.mucousMembraneColor = mmc;
    const notes = formData.get("notes") as string;
    if (notes) data.notes = notes;

    await db.vitalRecord.create({ data });
    revalidatePath(`/patients/${admissionId}`);
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}
