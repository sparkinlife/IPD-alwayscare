"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireDoctor } from "@/lib/auth";
import { validateLabTestType } from "@/lib/validators";
import { handleActionError } from "@/lib/action-utils";
import { markDeletedInDrive } from "@/lib/google-auth";

export async function addLabResult(admissionId: string, formData: FormData) {
  try {
    const session = await requireDoctor();

    const admission = await db.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, deletedAt: true, status: true },
    });
    if (!admission || admission.deletedAt) return { error: "Admission not found" };
    if (admission.status !== "ACTIVE") return { error: "Admission is no longer active" };

    const testType = formData.get("testType") as string;
    const testName = formData.get("testName") as string;
    const result = formData.get("result") as string;
    const isAbnormal = formData.get("isAbnormal") === "true";
    const notes = (formData.get("notes") as string) || undefined;
    const reportUrl = (formData.get("reportUrl") as string) || undefined;

    if (!testType || !testName || !result) return { error: "Test type, name, and result are required" };

    await db.labResult.create({
      data: { admissionId, testType: validateLabTestType(testType), testName, result, isAbnormal, notes, reportUrl, createdById: session.staffId },
    });
    revalidatePath("/patients/[admissionId]", "page");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateLabResult(labId: string, formData: FormData) {
  try {
    await requireDoctor();

    const lab = await db.labResult.findUnique({
      where: { id: labId },
      select: {
        admissionId: true,
        admission: { select: { deletedAt: true, status: true } },
      },
    });
    if (!lab) return { error: "Lab result not found" };
    if (lab.admission.deletedAt || lab.admission.status !== "ACTIVE") {
      return { error: "Admission is no longer active" };
    }

    const testType = formData.get("testType") as string;
    const testName = formData.get("testName") as string;
    const result = formData.get("result") as string;
    const isAbnormal = formData.get("isAbnormal") === "true";
    const notes = (formData.get("notes") as string) || null;
    const reportUrl = (formData.get("reportUrl") as string) || null;

    if (!testType || !testName || !result) return { error: "Test type, name, and result are required" };

    await db.labResult.update({
      where: { id: labId },
      data: { testType: validateLabTestType(testType), testName, result, isAbnormal, notes, reportUrl },
    });

    revalidatePath("/patients/[admissionId]", "page");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deleteLabResult(labId: string) {
  try {
    await requireDoctor();

    const lab = await db.labResult.findUnique({
      where: { id: labId },
      select: {
        admissionId: true,
        admission: { select: { deletedAt: true, status: true } },
      },
    });
    if (!lab) return { error: "Lab result not found" };
    if (lab.admission.deletedAt || lab.admission.status !== "ACTIVE") {
      return { error: "Admission is no longer active" };
    }

    const proofs = await db.proofAttachment.findMany({
      where: { recordId: labId, recordType: "LabResult" },
      select: { fileId: true, fileName: true },
    });
    await markDeletedInDrive(proofs);

    await db.proofAttachment.deleteMany({
      where: { recordId: labId, recordType: "LabResult" },
    });

    await db.labResult.delete({ where: { id: labId } });
    revalidatePath("/patients/[admissionId]", "page");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}
