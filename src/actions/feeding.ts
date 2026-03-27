"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireDoctor, requireAuth } from "@/lib/auth";
import { validateFeedingStatus } from "@/lib/validators";
import { handleActionError } from "@/lib/action-utils";
import { toUTCDate } from "@/lib/date-utils";

export async function createDietPlan(admissionId: string, formData: FormData) {
  try {
    const session = await requireDoctor();

    const admission = await db.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, deletedAt: true },
    });
    if (!admission || admission.deletedAt) return { error: "Admission not found" };

    const dietType = formData.get("dietType") as string;
    const instructions = (formData.get("instructions") as string) || undefined;
    const schedulesRaw = formData.get("schedules") as string;

    if (!dietType) return { error: "Diet type is required" };

    let schedules: Array<{ scheduledTime: string; foodType: string; portion: string }> = [];
    if (schedulesRaw) {
      try {
        schedules = JSON.parse(schedulesRaw);
      } catch {
        return { error: "Invalid schedules format" };
      }
      if (!Array.isArray(schedules)) return { error: "Invalid schedules format" };
      for (const s of schedules) {
        if (!s.scheduledTime || !s.foodType || !s.portion) {
          return { error: "Each feeding schedule must have scheduledTime, foodType, and portion" };
        }
      }
    }

    // Deactivate all existing active diet plans
    await db.dietPlan.updateMany({
      where: { admissionId, isActive: true },
      data: { isActive: false },
    });

    // Create new diet plan with feeding schedules
    await db.dietPlan.create({
      data: {
        admissionId,
        dietType,
        instructions,
        isActive: true,
        createdById: session.staffId,
        feedingSchedules: {
          create: schedules.map((s) => ({
            scheduledTime: s.scheduledTime,
            foodType: s.foodType,
            portion: s.portion,
          })),
        },
      },
    });

    revalidatePath("/patients/[admissionId]", "page");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function logFeeding(feedingScheduleId: string, formData: FormData) {
  try {
    const session = await requireAuth();

    const status = formData.get("status") as string;
    const amountConsumed = (formData.get("amountConsumed") as string) || undefined;
    const notes = (formData.get("notes") as string) || undefined;
    const dateStr = formData.get("date") as string;

    if (!status) return { error: "Status is required" };
    if (!dateStr) return { error: "Date is required" };

    const date = toUTCDate(dateStr);

    // Find the feeding schedule to get admissionId for revalidation
    const feedingSchedule = await db.feedingSchedule.findUnique({
      where: { id: feedingScheduleId },
      select: {
        dietPlan: {
          select: {
            admissionId: true,
            isActive: true,
            admission: { select: { deletedAt: true } }
          }
        }
      },
    });

    if (!feedingSchedule) return { error: "Feeding schedule not found" };
    if (!feedingSchedule.dietPlan.isActive) return { error: "Diet plan is no longer active" };
    if (feedingSchedule.dietPlan.admission.deletedAt) return { error: "Admission not found" };

    // Upsert feeding log for today
    const feedingLog = await db.feedingLog.upsert({
      where: { feedingScheduleId_date: { feedingScheduleId, date } },
      create: {
        feedingScheduleId,
        date,
        status: validateFeedingStatus(status),
        amountConsumed,
        notes,
        loggedById: session.staffId,
      },
      update: {
        status: validateFeedingStatus(status),
        amountConsumed,
        notes,
        loggedById: session.staffId,
      },
    });

    revalidatePath("/patients/[admissionId]", "page");
    return { success: true, id: feedingLog.id };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateFeeding(feedingLogId: string, formData: FormData) {
  try {
    await requireDoctor();

    const feedingLog = await db.feedingLog.findUnique({
      where: { id: feedingLogId },
      select: { feedingSchedule: { select: { dietPlan: { select: { admissionId: true } } } } },
    });
    if (!feedingLog) return { error: "Feeding log not found" };

    const status = formData.get("status") as string;
    const amountConsumed = (formData.get("amountConsumed") as string) || null;
    const notes = (formData.get("notes") as string) || null;

    if (!status) return { error: "Status is required" };

    await db.feedingLog.update({
      where: { id: feedingLogId },
      data: { status: validateFeedingStatus(status), amountConsumed, notes },
    });

    revalidatePath("/patients/[admissionId]", "page");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deleteFeeding(feedingLogId: string) {
  try {
    const session = await requireDoctor();

    const feedingLog = await db.feedingLog.findUnique({
      where: { id: feedingLogId },
      select: { feedingSchedule: { select: { dietPlan: { select: { admissionId: true } } } } },
    });
    if (!feedingLog) return { error: "Feeding log not found" };

    await db.feedingLog.update({
      where: { id: feedingLogId },
      data: {
        status: "SKIPPED",
        notes: `Deleted by ${session.name} at ${new Date().toISOString()}`,
      },
    });
    revalidatePath("/patients/[admissionId]", "page");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}
