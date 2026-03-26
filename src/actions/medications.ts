"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth, requireDoctor } from "@/lib/auth";
import { validateMedRoute, validateFrequency } from "@/lib/validators";

function handleActionError(error: unknown): { error: string } {
  if (error && typeof error === "object" && "digest" in error) throw error;
  if (error instanceof Error) {
    if (error.message === "Unauthorized") return { error: "Please log in again" };
    if (error.message.startsWith("Forbidden")) return { error: error.message };
    if (error.message.startsWith("Invalid")) return { error: error.message };
  }
  return { error: "An unexpected error occurred" };
}

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

    const endDate = endDateRaw ? new Date(endDateRaw) : undefined;

    await db.treatmentPlan.create({
      data: {
        admissionId,
        drugName,
        dose,
        calculatedDose,
        route: validateMedRoute(route),
        frequency: validateFrequency(frequency),
        scheduledTimes,
        notes,
        endDate,
        createdById: session.staffId,
      },
    });

    revalidatePath(`/patients/${admissionId}`);
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

    revalidatePath(`/patients/${plan.admissionId}`);
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
      select: { admissionId: true },
    });

    if (!plan) return { error: "Treatment plan not found" };

    const scheduledDateObj = new Date(scheduledDate);
    scheduledDateObj.setHours(0, 0, 0, 0);

    await db.medicationAdministration.upsert({
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

    revalidatePath(`/patients/${plan.admissionId}`);
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
      select: { admissionId: true },
    });

    if (!plan) return { error: "Treatment plan not found" };

    const scheduledDateObj = new Date(scheduledDate);
    scheduledDateObj.setHours(0, 0, 0, 0);

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

    revalidatePath(`/patients/${plan.admissionId}`);
    revalidatePath("/schedule");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}
