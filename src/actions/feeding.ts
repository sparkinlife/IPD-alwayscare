"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireDoctor, requireWriteAccess } from "@/lib/auth";
import { validateFeedingStatus } from "@/lib/validators";
import { handleActionError } from "@/lib/action-utils";
import { toUTCDate } from "@/lib/date-utils";

type SubmittedFeedingSchedule = {
  id?: string;
  scheduledTime: string;
  foodType: string;
  portion: string;
};

export async function createDietPlan(admissionId: string, formData: FormData) {
  try {
    const session = await requireDoctor();

    const admission = await db.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, deletedAt: true, status: true },
    });
    if (!admission || admission.deletedAt) return { error: "Admission not found" };
    if (admission.status !== "ACTIVE") return { error: "Admission is no longer active" };

    const dietType = formData.get("dietType") as string;
    const instructions = (formData.get("instructions") as string) || undefined;
    const schedulesRaw = formData.get("schedules") as string;

    if (!dietType) return { error: "Diet type is required" };

    let schedules: SubmittedFeedingSchedule[] = [];
    if (schedulesRaw) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(schedulesRaw);
      } catch {
        return { error: "Invalid schedules format" };
      }
      if (!Array.isArray(parsed)) return { error: "Invalid schedules format" };
      for (const item of parsed) {
        if (!item || typeof item !== "object") {
          return { error: "Invalid schedules format" };
        }
        const row = item as Record<string, unknown>;
        const id = typeof row.id === "string" && row.id.trim().length > 0 ? row.id.trim() : undefined;
        const scheduledTime = typeof row.scheduledTime === "string" ? row.scheduledTime : "";
        const foodType = typeof row.foodType === "string" ? row.foodType : "";
        const portion = typeof row.portion === "string" ? row.portion : "";

        if (!scheduledTime || !foodType || !portion) {
          return { error: "Each feeding schedule must have scheduledTime, foodType, and portion" };
        }
        schedules.push({ id, scheduledTime, foodType, portion });
      }
    }

    await db.$transaction(async (tx) => {
      const activePlan = await tx.dietPlan.findFirst({
        where: { admissionId, isActive: true, deletedAt: null },
        select: {
          id: true,
          feedingSchedules: {
            where: { isActive: true },
            select: {
              id: true,
              scheduledTime: true,
              foodType: true,
              portion: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!activePlan) {
        await tx.dietPlan.create({
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
                isActive: true,
              })),
            },
          },
        });
        return;
      }

      await tx.dietPlan.updateMany({
        where: {
          admissionId,
          isActive: true,
          deletedAt: null,
          id: { not: activePlan.id },
        },
        data: { isActive: false },
      });

      await tx.dietPlan.update({
        where: { id: activePlan.id },
        data: {
          dietType,
          instructions: instructions ?? null,
        },
      });

      const existingSchedulesById = new Map(
        activePlan.feedingSchedules.map((s) => [s.id, s])
      );
      const submittedIds = new Set<string>();
      for (const row of schedules) {
        if (!row.id) continue;
        if (submittedIds.has(row.id)) {
          throw new Error("Invalid schedules format");
        }
        if (!existingSchedulesById.has(row.id)) {
          throw new Error("Invalid schedules format");
        }
        submittedIds.add(row.id);
      }

      const existingScheduleIds = activePlan.feedingSchedules.map((s) => s.id);
      const existingLogs =
        existingScheduleIds.length > 0
          ? await tx.feedingLog.findMany({
              where: { feedingScheduleId: { in: existingScheduleIds } },
              select: { id: true, feedingScheduleId: true },
            })
          : [];

      const scheduleIdsWithLogs = new Set(existingLogs.map((log) => log.feedingScheduleId));
      const scheduleByLogId = new Map(existingLogs.map((log) => [log.id, log.feedingScheduleId]));
      const existingLogIds = existingLogs.map((log) => log.id);
      const existingProofs =
        existingLogIds.length > 0
          ? await tx.proofAttachment.findMany({
              where: {
                recordType: "FeedingLog",
                recordId: { in: existingLogIds },
              },
              select: { recordId: true },
            })
          : [];
      const scheduleIdsWithProofs = new Set(
        existingProofs
          .map((proof) => scheduleByLogId.get(proof.recordId))
          .filter((scheduleId): scheduleId is string => Boolean(scheduleId))
      );

      const hasImmutableHistory = (scheduleId: string): boolean =>
        scheduleIdsWithLogs.has(scheduleId) || scheduleIdsWithProofs.has(scheduleId);

      for (const row of schedules) {
        if (!row.id) {
          await tx.feedingSchedule.create({
            data: {
              dietPlanId: activePlan.id,
              scheduledTime: row.scheduledTime,
              foodType: row.foodType,
              portion: row.portion,
              isActive: true,
            },
          });
          continue;
        }

        const existing = existingSchedulesById.get(row.id)!;
        const unchanged =
          existing.scheduledTime === row.scheduledTime &&
          existing.foodType === row.foodType &&
          existing.portion === row.portion;
        if (unchanged) continue;

        if (hasImmutableHistory(row.id)) {
          await tx.feedingSchedule.update({
            where: { id: row.id },
            data: { isActive: false },
          });
          await tx.feedingSchedule.create({
            data: {
              dietPlanId: activePlan.id,
              scheduledTime: row.scheduledTime,
              foodType: row.foodType,
              portion: row.portion,
              isActive: true,
            },
          });
          continue;
        }

        await tx.feedingSchedule.update({
          where: { id: row.id },
          data: {
            scheduledTime: row.scheduledTime,
            foodType: row.foodType,
            portion: row.portion,
            isActive: true,
          },
        });
      }

      for (const existing of activePlan.feedingSchedules) {
        if (submittedIds.has(existing.id)) continue;

        if (hasImmutableHistory(existing.id)) {
          await tx.feedingSchedule.update({
            where: { id: existing.id },
            data: { isActive: false },
          });
          continue;
        }

        await tx.feedingSchedule.delete({
          where: { id: existing.id },
        });
      }
    });

    revalidatePath("/patients/[admissionId]", "page");
    revalidatePath("/schedule");
    revalidatePath("/management");
    revalidatePath("/management/patients/[admissionId]", "page");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function logFeeding(feedingScheduleId: string, formData: FormData) {
  try {
    const session = await requireWriteAccess();

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
        isActive: true,
        dietPlan: {
          select: {
            admissionId: true,
            isActive: true,
            admission: { select: { deletedAt: true, status: true } }
          }
        }
      },
    });

    if (!feedingSchedule) return { error: "Feeding schedule not found" };
    if (!feedingSchedule.isActive) return { error: "Feeding schedule is no longer active" };
    if (!feedingSchedule.dietPlan.isActive) return { error: "Diet plan is no longer active" };
    if (feedingSchedule.dietPlan.admission.deletedAt) return { error: "Admission not found" };
    if (feedingSchedule.dietPlan.admission.status !== "ACTIVE") {
      return { error: "Admission is no longer active" };
    }

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
      select: {
        feedingSchedule: {
          select: {
            dietPlan: {
              select: {
                admissionId: true,
                admission: { select: { deletedAt: true, status: true } },
              },
            },
          },
        },
      },
    });
    if (!feedingLog) return { error: "Feeding log not found" };
    if (
      feedingLog.feedingSchedule.dietPlan.admission.deletedAt ||
      feedingLog.feedingSchedule.dietPlan.admission.status !== "ACTIVE"
    ) {
      return { error: "Admission is no longer active" };
    }

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
      select: {
        feedingSchedule: {
          select: {
            dietPlan: {
              select: {
                admissionId: true,
                admission: { select: { deletedAt: true, status: true } },
              },
            },
          },
        },
      },
    });
    if (!feedingLog) return { error: "Feeding log not found" };
    if (
      feedingLog.feedingSchedule.dietPlan.admission.deletedAt ||
      feedingLog.feedingSchedule.dietPlan.admission.status !== "ACTIVE"
    ) {
      return { error: "Admission is no longer active" };
    }

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
