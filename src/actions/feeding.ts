"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireDoctor, requireAuth } from "@/lib/auth";
import { validateFeedingStatus } from "@/lib/validators";

function handleActionError(error: unknown): { error: string } {
  if (error && typeof error === "object" && "digest" in error) throw error;
  if (error instanceof Error) {
    if (error.message === "Unauthorized") return { error: "Please log in again" };
    if (error.message.startsWith("Forbidden")) return { error: error.message };
    if (error.message.startsWith("Invalid")) return { error: error.message };
  }
  return { error: "An unexpected error occurred" };
}

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

    revalidatePath(`/patients/${admissionId}`);
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

    const date = new Date(dateStr);

    // Find the feeding schedule to get admissionId for revalidation
    const feedingSchedule = await db.feedingSchedule.findUnique({
      where: { id: feedingScheduleId },
      select: { dietPlan: { select: { admissionId: true } } },
    });

    if (!feedingSchedule) return { error: "Feeding schedule not found" };

    // Upsert feeding log for today
    await db.feedingLog.upsert({
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

    revalidatePath(`/patients/${feedingSchedule.dietPlan.admissionId}`);
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}
