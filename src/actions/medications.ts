"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth, requireDoctor } from "@/lib/auth";
import { validateMedRoute, validateFrequency } from "@/lib/validators";
import { handleActionError } from "@/lib/action-utils";
import { toUTCDate } from "@/lib/date-utils";
import { markDeletedInDrive } from "@/lib/google-auth";

export async function prescribeMedication(admissionId: string, formData: FormData) {
  try {
    const session = await requireDoctor();

    const admission = await db.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, deletedAt: true },
    });
    if (!admission || admission.deletedAt) return { error: "Admission not found" };

    const drugName = formData.get("drugName") as string;
    const dose = formData.get("dose") as string;
    const calculatedDose = (formData.get("calculatedDose") as string) || undefined;
    const route = formData.get("route") as string;
    const frequency = formData.get("frequency") as string;
    const customFrequency = (formData.get("customFrequency") as string) || undefined;
    const scheduledTimesRaw = formData.get("scheduledTimes") as string;
    const notes = (formData.get("notes") as string) || undefined;
    const endDateRaw = (formData.get("endDate") as string) || undefined;

    if (!drugName || !dose || !route || !frequency) {
      return { error: "Drug name, dose, route, and frequency are required" };
    }

    let scheduledTimes: string[] = [];
    try {
      scheduledTimes = scheduledTimesRaw ? JSON.parse(scheduledTimesRaw) : [];
    } catch {
      return { error: "Invalid scheduled times format" };
    }

    if (!Array.isArray(scheduledTimes)) return { error: "Invalid scheduled times format" };

    const endDate = endDateRaw ? toUTCDate(endDateRaw) : undefined;

    await db.treatmentPlan.create({
      data: {
        admissionId,
        drugName,
        dose,
        calculatedDose,
        route: validateMedRoute(route),
        frequency: validateFrequency(frequency),
        customFrequency,
        scheduledTimes,
        notes,
        endDate,
        createdById: session.staffId,
      },
    });

    revalidatePath("/patients/[admissionId]", "page");
    revalidatePath("/schedule");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function stopMedication(treatmentPlanId: string) {
  try {
    await requireDoctor();

    const plan = await db.treatmentPlan.findUnique({
      where: { id: treatmentPlanId },
      select: { admissionId: true },
    });

    if (!plan) return { error: "Treatment plan not found" };

    await db.treatmentPlan.update({
      where: { id: treatmentPlanId },
      data: {
        isActive: false,
        endDate: new Date(),
      },
    });

    revalidatePath("/patients/[admissionId]", "page");
    revalidatePath("/schedule");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function administerDose(
  treatmentPlanId: string,
  scheduledDate: string,
  scheduledTime: string
) {
  try {
    const session = await requireAuth();

    const plan = await db.treatmentPlan.findUnique({
      where: { id: treatmentPlanId },
      select: { admissionId: true, isActive: true, deletedAt: true },
    });

    if (!plan) return { error: "Treatment plan not found" };
    if (!plan.isActive || plan.deletedAt) return { error: "Treatment plan is no longer active" };

    const scheduledDateObj = toUTCDate(scheduledDate);

    const administration = await db.medicationAdministration.upsert({
      where: {
        treatmentPlanId_scheduledDate_scheduledTime: {
          treatmentPlanId,
          scheduledDate: scheduledDateObj,
          scheduledTime,
        },
      },
      update: {
        wasAdministered: true,
        wasSkipped: false,
        skipReason: null,
        actualTime: new Date(),
        administeredById: session.staffId,
      },
      create: {
        treatmentPlanId,
        scheduledDate: scheduledDateObj,
        scheduledTime,
        wasAdministered: true,
        actualTime: new Date(),
        administeredById: session.staffId,
      },
    });

    revalidatePath("/patients/[admissionId]", "page");
    revalidatePath("/schedule");
    return { success: true, id: administration.id };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateMedication(treatmentPlanId: string, formData: FormData) {
  try {
    await requireDoctor();

    const plan = await db.treatmentPlan.findUnique({
      where: { id: treatmentPlanId },
      select: { admissionId: true },
    });
    if (!plan) return { error: "Treatment plan not found" };

    const drugName = formData.get("drugName") as string;
    const dose = formData.get("dose") as string;
    const calculatedDose = (formData.get("calculatedDose") as string) || null;
    const route = formData.get("route") as string;
    const frequency = formData.get("frequency") as string;
    const customFrequency = (formData.get("customFrequency") as string) || undefined;
    const scheduledTimesRaw = formData.get("scheduledTimes") as string;
    const notes = (formData.get("notes") as string) || null;

    if (!drugName || !dose || !route || !frequency) {
      return { error: "Drug name, dose, route, and frequency are required" };
    }

    let scheduledTimes: string[] = [];
    try {
      scheduledTimes = scheduledTimesRaw ? JSON.parse(scheduledTimesRaw) : [];
    } catch {
      return { error: "Invalid scheduled times format" };
    }

    await db.treatmentPlan.update({
      where: { id: treatmentPlanId },
      data: {
        drugName,
        dose,
        calculatedDose,
        route: validateMedRoute(route),
        frequency: validateFrequency(frequency),
        customFrequency,
        scheduledTimes,
        notes,
      },
    });

    revalidatePath("/patients/[admissionId]", "page");
    revalidatePath("/schedule");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deleteMedication(treatmentPlanId: string) {
  try {
    await requireDoctor();

    const plan = await db.treatmentPlan.findUnique({
      where: { id: treatmentPlanId },
      select: { admissionId: true },
    });
    if (!plan) return { error: "Treatment plan not found" };

    // Find all administrations for this plan and rename their proofs in Drive
    const administrations = await db.medicationAdministration.findMany({
      where: { treatmentPlanId },
      select: { id: true },
    });
    const adminIds = administrations.map(a => a.id);

    if (adminIds.length > 0) {
      const proofs = await db.proofAttachment.findMany({
        where: { recordId: { in: adminIds }, recordType: "MedicationAdministration" },
        select: { fileId: true, fileName: true },
      });
      await markDeletedInDrive(proofs);
      await db.proofAttachment.deleteMany({
        where: { recordId: { in: adminIds }, recordType: "MedicationAdministration" },
      });
    }

    await db.treatmentPlan.update({
      where: { id: treatmentPlanId },
      data: { deletedAt: new Date(), isActive: false },
    });

    revalidatePath("/patients/[admissionId]", "page");
    revalidatePath("/schedule");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function undoAdministration(administrationId: string) {
  try {
    const session = await requireDoctor();

    const admin = await db.medicationAdministration.findUnique({
      where: { id: administrationId },
      select: { treatmentPlan: { select: { admissionId: true } } },
    });
    if (!admin) return { error: "Administration record not found" };

    await db.medicationAdministration.update({
      where: { id: administrationId },
      data: {
        wasAdministered: false,
        wasSkipped: false,
        actualTime: null,
        administeredById: null,
        skipReason: null,
        notes: `Undone by ${session.name}`,
      },
    });

    const proofs = await db.proofAttachment.findMany({
      where: { recordId: administrationId, recordType: "MedicationAdministration" },
      select: { fileId: true, fileName: true },
    });
    await markDeletedInDrive(proofs);

    await db.proofAttachment.deleteMany({
      where: { recordId: administrationId, recordType: "MedicationAdministration" },
    });

    revalidatePath("/patients/[admissionId]", "page");
    revalidatePath("/schedule");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function skipDose(
  treatmentPlanId: string,
  scheduledDate: string,
  scheduledTime: string,
  skipReason: string
) {
  try {
    const session = await requireAuth();

    if (!skipReason) return { error: "Skip reason is required" };

    const plan = await db.treatmentPlan.findUnique({
      where: { id: treatmentPlanId },
      select: { admissionId: true, isActive: true, deletedAt: true },
    });

    if (!plan) return { error: "Treatment plan not found" };
    if (!plan.isActive || plan.deletedAt) return { error: "Treatment plan is no longer active" };

    const scheduledDateObj = toUTCDate(scheduledDate);

    await db.medicationAdministration.upsert({
      where: {
        treatmentPlanId_scheduledDate_scheduledTime: {
          treatmentPlanId,
          scheduledDate: scheduledDateObj,
          scheduledTime,
        },
      },
      update: {
        wasSkipped: true,
        wasAdministered: false,
        skipReason,
        actualTime: null,
        administeredById: session.staffId,
      },
      create: {
        treatmentPlanId,
        scheduledDate: scheduledDateObj,
        scheduledTime,
        wasSkipped: true,
        skipReason,
        administeredById: session.staffId,
      },
    });

    revalidatePath("/patients/[admissionId]", "page");
    revalidatePath("/schedule");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}
