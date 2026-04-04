import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  buildLogsTimelineEntries,
  type LogsTimelineData,
  type LogsTimelineEntry,
} from "@/lib/logs-read-model";

interface LogsTimelineQueryOptions {
  medicationDate?: Date;
  feedingFromDate?: Date;
}

export async function getLogsTimelineEntries(
  admissionId: string,
  options: LogsTimelineQueryOptions = {}
): Promise<LogsTimelineEntry[]> {
  const admission = await db.admission.findFirst({
    where: { id: admissionId, deletedAt: null },
    select: { id: true },
  });

  if (!admission) {
    return [];
  }

  const medicationWhere: Prisma.MedicationAdministrationWhereInput = {
    treatmentPlan: {
      admissionId,
      deletedAt: null,
      admission: {
        deletedAt: null,
      },
    },
    OR: [{ wasAdministered: true }, { wasSkipped: true }],
    ...(options.medicationDate
      ? { scheduledDate: options.medicationDate }
      : {}),
  };

  const feedingWhere: Prisma.FeedingLogWhereInput = {
    feedingSchedule: {
      dietPlan: {
        admissionId,
        deletedAt: null,
        admission: {
          deletedAt: null,
        },
      },
    },
    status: { not: "PENDING" },
    ...(options.feedingFromDate
      ? { date: { gte: options.feedingFromDate } }
      : {}),
  };

  const [
    medicationAdministrations,
    vitalRecords,
    feedingLogs,
    bathLogs,
    clinicalNotes,
    disinfectionLogs,
    fluidTherapies,
  ] = await Promise.all([
    db.medicationAdministration.findMany({
      where: medicationWhere,
      orderBy: [{ actualTime: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      select: {
        scheduledTime: true,
        wasAdministered: true,
        wasSkipped: true,
        skipReason: true,
        actualTime: true,
        createdAt: true,
        administeredBy: { select: { name: true } },
        treatmentPlan: {
          select: {
            drugName: true,
            dose: true,
            route: true,
          },
        },
      },
    }),
    db.vitalRecord.findMany({
      where: {
        admissionId,
        admission: {
          deletedAt: null,
        },
      },
      orderBy: [{ recordedAt: "desc" }, { id: "asc" }],
      select: {
        recordedAt: true,
        temperature: true,
        heartRate: true,
        respRate: true,
        painScore: true,
        weight: true,
        recordedBy: { select: { name: true } },
      },
    }),
    db.feedingLog.findMany({
      where: feedingWhere,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: {
        status: true,
        createdAt: true,
        loggedBy: { select: { name: true } },
        feedingSchedule: {
          select: {
            scheduledTime: true,
            foodType: true,
          },
        },
      },
    }),
    db.bathLog.findMany({
      where: {
        admissionId,
        admission: {
          deletedAt: null,
        },
      },
      orderBy: [{ bathedAt: "desc" }, { id: "asc" }],
      select: {
        bathedAt: true,
        notes: true,
        bathedBy: { select: { name: true } },
      },
    }),
    db.clinicalNote.findMany({
      where: {
        admissionId,
        admission: {
          deletedAt: null,
        },
      },
      orderBy: [{ recordedAt: "desc" }, { id: "asc" }],
      select: {
        recordedAt: true,
        category: true,
        content: true,
        recordedBy: { select: { name: true, role: true } },
      },
    }),
    db.disinfectionLog.findMany({
      where: {
        isolationProtocol: {
          admissionId,
          admission: {
            deletedAt: null,
          },
        },
      },
      orderBy: [{ performedAt: "desc" }, { id: "asc" }],
      select: {
        performedAt: true,
        performedBy: { select: { name: true } },
      },
    }),
    db.fluidTherapy.findMany({
      where: {
        admissionId,
        admission: {
          deletedAt: null,
        },
      },
      orderBy: [{ startTime: "desc" }, { id: "asc" }],
      select: {
        fluidType: true,
        rate: true,
        startTime: true,
        endTime: true,
        createdBy: { select: { name: true } },
        rateChanges: {
          orderBy: [{ changedAt: "desc" }, { id: "asc" }],
          select: {
            oldRate: true,
            newRate: true,
            changedAt: true,
            changedBy: { select: { name: true } },
            reason: true,
          },
        },
      },
    }),
  ]);

  const timelineData: LogsTimelineData = {
    medicationAdministrations,
    vitalRecords,
    feedingLogs,
    bathLogs,
    clinicalNotes,
    disinfectionLogs,
    fluidTherapies,
  };

  return buildLogsTimelineEntries(timelineData);
}
