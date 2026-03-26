"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function recordVitals(admissionId: string, formData: FormData) {
  const session = await requireAuth();
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
    if (val) data[name] = parse(val);
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
}
