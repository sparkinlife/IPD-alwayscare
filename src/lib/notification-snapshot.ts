import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { isBathDue, parseIntervalHours } from "@/lib/date-utils";
import {
  hasAnyAbnormalVital,
  checkTemperature,
  checkHeartRate,
  checkRespRate,
  checkPainScore,
  checkCRT,
} from "@/lib/vitals-thresholds";
import {
  CLINICAL_LIVE_PROFILE,
  notificationsTag,
  type NotificationRole,
} from "@/lib/clinical-cache";

export interface Notification {
  id: string;
  type: "upcoming" | "due" | "overdue" | "urgent" | "critical" | "info";
  category: "MEDS" | "FOOD" | "BATH" | "DISINFECTION" | "VITALS" | "ADMISSION" | "CONDITION";
  title: string;
  description: string;
  patientName: string;
  admissionId: string;
  timestamp: string;
}

const priority: Record<string, number> = {
  urgent: 0,
  critical: 1,
  overdue: 2,
  due: 3,
  upcoming: 4,
  info: 5,
};

export function sortNotificationsByPriority<T extends { type: string }>(items: T[]) {
  return [...items].sort((a, b) => (priority[a.type] ?? 9) - (priority[b.type] ?? 9));
}

export function filterNotificationsForRole<T extends { type: string; category: string }>(
  items: T[],
  role: string
) {
  if (role === "MANAGEMENT") {
    return items.filter((item) => item.type === "overdue" || item.type === "urgent" || item.type === "critical");
  }
  if (role === "DOCTOR") {
    return items.filter((item) => {
      if (item.type === "overdue" || item.type === "urgent") return true;
      if (item.type === "critical") return true;
      return item.category === "ADMISSION";
    });
  }
  if (role === "PARAVET") {
    return items.filter((item) => {
      if (item.category === "MEDS") return true;
      return item.type === "critical";
    });
  }
  return items;
}

export async function buildNotificationsSnapshot(today: Date, nowMinutes: number) {
  const admissions = await db.admission.findMany({
    where: { status: "ACTIVE", deletedAt: null, patient: { deletedAt: null } },
    select: {
      id: true,
      admissionDate: true,
      condition: true,
      diagnosis: true,
      patient: { select: { name: true } },
      treatmentPlans: {
        where: { isActive: true, deletedAt: null },
        select: {
          id: true,
          drugName: true,
          dose: true,
          scheduledTimes: true,
          administrations: {
            where: { scheduledDate: today },
            select: { scheduledTime: true, wasAdministered: true, wasSkipped: true },
          },
        },
      },
      dietPlans: {
        where: { isActive: true, deletedAt: null },
        select: {
          id: true,
          feedingSchedules: {
            where: { isActive: true },
            select: {
              id: true,
              scheduledTime: true,
              foodType: true,
              feedingLogs: {
                where: { date: today },
                select: { status: true },
              },
            },
          },
        },
      },
      bathLogs: {
        orderBy: { bathedAt: "desc" },
        take: 1,
        select: { bathedAt: true },
      },
      vitalRecords: {
        orderBy: { recordedAt: "desc" },
        take: 1,
        select: {
          temperature: true,
          heartRate: true,
          respRate: true,
          painScore: true,
          capillaryRefillTime: true,
        },
      },
      isolationProtocol: {
        select: {
          disease: true,
          disinfectionInterval: true,
          isCleared: true,
          createdAt: true,
          disinfectionLogs: {
            orderBy: { performedAt: "desc" },
            take: 1,
            select: { performedAt: true },
          },
        },
      },
    },
  });

  const notifications: Notification[] = [];

  for (const admission of admissions) {
    const name = admission.patient.name;
    const admId = admission.id;

    for (const plan of admission.treatmentPlans) {
      for (const time of plan.scheduledTimes) {
        const existing = plan.administrations.find((a) => a.scheduledTime === time);
        if (existing && (existing.wasAdministered || existing.wasSkipped)) continue;

        const [h, m] = time.split(":").map(Number);
        const scheduledMinutes = h * 60 + m;
        const diff = nowMinutes - scheduledMinutes;

        const baseId = `med-${plan.id}-${time}`;
        const desc = `${plan.drugName} ${plan.dose}`;

        if (diff >= 60) {
          notifications.push({
            id: baseId,
            type: "urgent",
            category: "MEDS",
            title: `URGENT: ${desc} (${diff} min late)`,
            description: `Scheduled at ${time}`,
            patientName: name,
            admissionId: admId,
            timestamp: time,
          });
        } else if (diff >= 30) {
          notifications.push({
            id: baseId,
            type: "overdue",
            category: "MEDS",
            title: `OVERDUE: ${desc} (${diff} min late)`,
            description: `Scheduled at ${time}`,
            patientName: name,
            admissionId: admId,
            timestamp: time,
          });
        } else if (diff >= 0) {
          notifications.push({
            id: baseId,
            type: "due",
            category: "MEDS",
            title: `${desc} is due NOW`,
            description: `Scheduled at ${time}`,
            patientName: name,
            admissionId: admId,
            timestamp: time,
          });
        } else if (diff >= -30) {
          notifications.push({
            id: baseId,
            type: "upcoming",
            category: "MEDS",
            title: `${desc} due in ${Math.abs(diff)} min`,
            description: `Scheduled at ${time}`,
            patientName: name,
            admissionId: admId,
            timestamp: time,
          });
        }
      }
    }

    for (const diet of admission.dietPlans) {
      for (const schedule of diet.feedingSchedules) {
        const todayLog = schedule.feedingLogs[0];
        if (todayLog && todayLog.status !== "PENDING") continue;

        const [h, m] = schedule.scheduledTime.split(":").map(Number);
        const scheduledMinutes = h * 60 + m;
        const diff = nowMinutes - scheduledMinutes;

        const baseId = `food-${schedule.id}-${schedule.scheduledTime}`;

        if (diff >= 60) {
          notifications.push({
            id: baseId,
            type: "urgent",
            category: "FOOD",
            title: `URGENT: Feeding overdue (${diff} min)`,
            description: `${schedule.foodType} at ${schedule.scheduledTime}`,
            patientName: name,
            admissionId: admId,
            timestamp: schedule.scheduledTime,
          });
        } else if (diff >= 30) {
          notifications.push({
            id: baseId,
            type: "overdue",
            category: "FOOD",
            title: `OVERDUE: Feeding (${diff} min late)`,
            description: `${schedule.foodType} at ${schedule.scheduledTime}`,
            patientName: name,
            admissionId: admId,
            timestamp: schedule.scheduledTime,
          });
        } else if (diff >= 0) {
          notifications.push({
            id: baseId,
            type: "due",
            category: "FOOD",
            title: `Feeding due NOW`,
            description: `${schedule.foodType} at ${schedule.scheduledTime}`,
            patientName: name,
            admissionId: admId,
            timestamp: schedule.scheduledTime,
          });
        } else if (diff >= -30) {
          notifications.push({
            id: baseId,
            type: "upcoming",
            category: "FOOD",
            title: `Feeding in ${Math.abs(diff)} min`,
            description: `${schedule.foodType} at ${schedule.scheduledTime}`,
            patientName: name,
            admissionId: admId,
            timestamp: schedule.scheduledTime,
          });
        }
      }
    }

    const lastBathDate = admission.bathLogs[0]?.bathedAt ?? admission.admissionDate;
    const bathStatus = isBathDue(lastBathDate);
    if (bathStatus.isDue) {
      notifications.push({
        id: `bath-${admId}`,
        type: bathStatus.isOverdue ? "overdue" : "due",
        category: "BATH",
        title: bathStatus.isOverdue
          ? `OVERDUE: Bath (${bathStatus.daysSinceLast} days)`
          : `Bath due today`,
        description: `Last bathed ${bathStatus.daysSinceLast} days ago`,
        patientName: name,
        admissionId: admId,
        timestamp: "",
      });
    }

    if (admission.isolationProtocol && !admission.isolationProtocol.isCleared) {
      const lastDisinfection =
        admission.isolationProtocol.disinfectionLogs[0]?.performedAt ?? admission.isolationProtocol.createdAt;
      const intervalStr = admission.isolationProtocol.disinfectionInterval;
      const intervalHours = parseIntervalHours(intervalStr);
      const nextDueMs = new Date(lastDisinfection).getTime() + intervalHours * 60 * 60 * 1000;
      const overdueMs = Date.now() - nextDueMs;

      if (overdueMs > 60 * 60 * 1000) {
        notifications.push({
          id: `disinfect-${admId}`,
          type: "urgent",
          category: "DISINFECTION",
          title: `URGENT: Disinfection overdue`,
          description: admission.isolationProtocol.disease,
          patientName: name,
          admissionId: admId,
          timestamp: "",
        });
      } else if (overdueMs > 0) {
        notifications.push({
          id: `disinfect-${admId}`,
          type: "overdue",
          category: "DISINFECTION",
          title: `Disinfection overdue`,
          description: admission.isolationProtocol.disease,
          patientName: name,
          admissionId: admId,
          timestamp: "",
        });
      } else if (overdueMs > -30 * 60 * 1000) {
        notifications.push({
          id: `disinfect-${admId}`,
          type: "upcoming",
          category: "DISINFECTION",
          title: `Disinfection due soon`,
          description: admission.isolationProtocol.disease,
          patientName: name,
          admissionId: admId,
          timestamp: "",
        });
      }
    }

    const latestVitals = admission.vitalRecords[0];
    if (latestVitals && hasAnyAbnormalVital(latestVitals)) {
      const parts: string[] = [];
      if (checkTemperature(latestVitals.temperature).isAbnormal) parts.push(`Temp ${latestVitals.temperature}°C`);
      if (checkHeartRate(latestVitals.heartRate).isAbnormal) parts.push(`HR ${latestVitals.heartRate}`);
      if (checkRespRate(latestVitals.respRate).isAbnormal) parts.push(`RR ${latestVitals.respRate}`);
      if (checkPainScore(latestVitals.painScore).isAbnormal) parts.push(`Pain ${latestVitals.painScore}`);
      if (checkCRT(latestVitals.capillaryRefillTime).isAbnormal) parts.push(`CRT ${latestVitals.capillaryRefillTime}s`);

      notifications.push({
        id: `vitals-${admId}`,
        type: "critical",
        category: "VITALS",
        title: `CRITICAL: Abnormal vitals`,
        description: parts.join(", "),
        patientName: name,
        admissionId: admId,
        timestamp: "",
      });
    }

    if (admission.condition === "CRITICAL") {
      notifications.push({
        id: `condition-${admId}`,
        type: "critical",
        category: "CONDITION",
        title: `Patient is CRITICAL`,
        description: admission.diagnosis ?? "",
        patientName: name,
        admissionId: admId,
        timestamp: "",
      });
    }
  }

  const pendingSetups = await db.admission.findMany({
    where: { status: "REGISTERED", deletedAt: null },
    select: { id: true, patient: { select: { name: true } } },
  });
  for (const adm of pendingSetups) {
    notifications.push({
      id: `setup-${adm.id}`,
      type: "info",
      category: "ADMISSION",
      title: `Awaiting clinical setup`,
      description: "Needs doctor attention",
      patientName: adm.patient.name,
      admissionId: adm.id,
      timestamp: "",
    });
  }

  return notifications;
}

export async function getNotificationsSnapshot(role: NotificationRole, today: Date, nowMinutes: number) {
  "use cache";
  cacheLife(CLINICAL_LIVE_PROFILE);
  cacheTag(notificationsTag(role));

  const notifications = await buildNotificationsSnapshot(today, nowMinutes);
  return filterNotificationsForRole(sortNotificationsByPriority(notifications), role);
}
