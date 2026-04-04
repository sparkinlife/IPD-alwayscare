"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireDoctor, requireWriteAccess } from "@/lib/auth";
import { handleActionError } from "@/lib/action-utils";
import { markDeletedInDrive } from "@/lib/google-auth";
import {
  getVitalsMutationTags,
  updateClinicalTags,
} from "@/lib/clinical-revalidation";
import { invalidateDashboardTags } from "@/lib/dashboard-revalidation";

export async function recordVitals(admissionId: string, formData: FormData) {
  try {
    const session = await requireWriteAccess();

    const admission = await db.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, deletedAt: true, status: true },
    });
    if (!admission || admission.deletedAt) return { error: "Admission not found" };
    if (admission.status !== "ACTIVE") return { error: "Admission is no longer active" };

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

    const vitalRecord = await db.vitalRecord.create({ data });
    invalidateDashboardTags("queue");
    updateClinicalTags(getVitalsMutationTags(admissionId));
    revalidatePath("/patients/[admissionId]", "page");
    return { success: true, id: vitalRecord.id };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateVitals(vitalId: string, formData: FormData) {
  try {
    await requireDoctor();

    const vital = await db.vitalRecord.findUnique({
      where: { id: vitalId },
      select: {
        id: true,
        admissionId: true,
        admission: { select: { deletedAt: true, status: true } },
      },
    });
    if (!vital) return { error: "Vital record not found" };
    if (vital.admission.deletedAt || vital.admission.status !== "ACTIVE") {
      return { error: "Admission is no longer active" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};

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
      if (val !== null && val !== undefined && val !== "") {
        const parsed = parse(val);
        if (!isNaN(parsed)) data[name] = parsed;
        else data[name] = null;
      } else {
        data[name] = null;
      }
    }

    const bp = formData.get("bloodPressure") as string;
    data.bloodPressure = bp || null;
    const mmc = formData.get("mucousMembraneColor") as string;
    data.mucousMembraneColor = mmc || null;
    const notes = formData.get("notes") as string;
    data.notes = notes || null;

    await db.vitalRecord.update({ where: { id: vitalId }, data });
    invalidateDashboardTags("queue");
    updateClinicalTags(getVitalsMutationTags(vital.admissionId));
    revalidatePath("/patients/[admissionId]", "page");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deleteVitals(vitalId: string) {
  try {
    await requireDoctor();

    const vital = await db.vitalRecord.findUnique({
      where: { id: vitalId },
      select: {
        admissionId: true,
        admission: { select: { deletedAt: true, status: true } },
      },
    });
    if (!vital) return { error: "Vital record not found" };
    if (vital.admission.deletedAt || vital.admission.status !== "ACTIVE") {
      return { error: "Admission is no longer active" };
    }

    const proofs = await db.proofAttachment.findMany({
      where: { recordId: vitalId, recordType: "VitalRecord" },
      select: { fileId: true, fileName: true },
    });
    await markDeletedInDrive(proofs);

    await db.proofAttachment.deleteMany({
      where: { recordId: vitalId, recordType: "VitalRecord" },
    });

    await db.vitalRecord.delete({ where: { id: vitalId } });
    invalidateDashboardTags("queue");
    updateClinicalTags(getVitalsMutationTags(vital.admissionId));
    revalidatePath("/patients/[admissionId]", "page");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}
