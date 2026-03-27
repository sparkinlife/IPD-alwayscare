import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendAlertToAll } from "@/lib/whatsapp";
import {
  hasAnyAbnormalVital,
  checkTemperature,
  checkHeartRate,
} from "@/lib/vitals-thresholds";
import { isBathDue, getTodayUTCDate, getTodayIST } from "@/lib/date-utils";

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  
  const today = getTodayUTCDate();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  // Fetch all active admissions with relevant data
  const admissions = await db.admission.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    include: {
      patient: true,
      vitalRecords: { orderBy: { recordedAt: "desc" }, take: 1 },
      treatmentPlans: {
        where: { isActive: true },
        include: {
          administrations: {
            where: {
              scheduledDate: today,
              wasAdministered: false,
              wasSkipped: false,
            },
          },
        },
      },
      bathLogs: { orderBy: { bathedAt: "desc" }, take: 1 },
      dietPlans: {
        where: { isActive: true },
        include: {
          feedingSchedules: {
            include: {
              feedingLogs: {
                where: { status: "REFUSED" },
                orderBy: { date: "desc" },
                take: 2,
              },
            },
          },
        },
      },
      isolationProtocol: {
        include: {
          disinfectionLogs: { orderBy: { performedAt: "desc" }, take: 1 },
        },
      },
    },
  });

  const alerts: { type: string; admissionId: string; message: string }[] = [];

  for (const admission of admissions) {
    const name = admission.patient.name;

    // 1. Check missed medications (30+ min overdue)
    for (const plan of admission.treatmentPlans) {
      for (const admin of plan.administrations) {
        const scheduledStr = admin.scheduledTime;
        const todayStr = getTodayIST();
        const scheduledTime = new Date(`${todayStr}T${scheduledStr}:00+05:30`);
        const minutesOverdue = Math.floor(
          (Date.now() - scheduledTime.getTime()) / 60000
        );
        if (minutesOverdue > 30) {
          alerts.push({
            type: "MISSED_MED",
            admissionId: admission.id,
            message: `Medication ${plan.drugName} for ${name} is ${minutesOverdue} min overdue`,
          });
        }
      }
    }

    // 2. Check critical vitals
    const latestVitals = admission.vitalRecords[0];
    if (latestVitals && hasAnyAbnormalVital(latestVitals)) {
      const tempFlag = checkTemperature(latestVitals.temperature);
      const hrFlag = checkHeartRate(latestVitals.heartRate);
      const abnormals: string[] = [];
      if (tempFlag.isAbnormal) abnormals.push(`Temp ${latestVitals.temperature}C`);
      if (hrFlag.isAbnormal) abnormals.push(`HR ${latestVitals.heartRate} bpm`);
      if (abnormals.length > 0) {
        alerts.push({
          type: "CRITICAL_VITALS",
          admissionId: admission.id,
          message: `ALERT: ${name} vitals abnormal: ${abnormals.join(", ")}`,
        });
      }
    }

    // 3. Check bath due
    const lastBath =
      admission.bathLogs[0]?.bathedAt ?? admission.admissionDate;
    const bathStatus = isBathDue(lastBath);
    if (bathStatus.isDue) {
      alerts.push({
        type: "BATH_DUE",
        admissionId: admission.id,
        message: `Patient ${name} needs a bath (last bathed ${bathStatus.daysSinceLast} days ago)`,
      });
    }

    // 4. Check feeding refusals (2+ consecutive)
    for (const diet of admission.dietPlans) {
      for (const schedule of diet.feedingSchedules) {
        if (schedule.feedingLogs.length >= 2) {
          alerts.push({
            type: "MISSED_FEEDING",
            admissionId: admission.id,
            message: `Patient ${name} has refused 2+ consecutive feedings (${schedule.foodType})`,
          });
        }
      }
    }

    // 5. Check disinfection overdue (isolation patients)
    if (admission.isolationProtocol && !admission.isolationProtocol.isCleared) {
      const lastDisinfection =
        admission.isolationProtocol.disinfectionLogs[0]?.performedAt;
      if (lastDisinfection) {
        const intervalStr = admission.isolationProtocol.disinfectionInterval;
        const intervalHours = parseInt(
          intervalStr.match(/\d+/)?.[0] || "4"
        );
        const nextDue = new Date(
          lastDisinfection.getTime() + intervalHours * 60 * 60 * 1000
        );
        const overdueBy = Date.now() - nextDue.getTime();
        if (overdueBy > 60 * 60 * 1000) {
          // >1 hour overdue
          alerts.push({
            type: "DISINFECTION_OVERDUE",
            admissionId: admission.id,
            message: `Disinfection overdue for ${name} in isolation (${admission.isolationProtocol.disease})`,
          });
        }
      }
    }
  }

  // Dedup: don't re-send same alert type for same admission within 2 hours
  const recentAlerts = await db.alertLog.findMany({
    where: { sentAt: { gte: twoHoursAgo } },
    select: { alertType: true, admissionId: true },
  });

  const recentSet = new Set(
    recentAlerts.map((a) => `${a.alertType}:${a.admissionId}`)
  );
  const newAlerts = alerts.filter(
    (a) => !recentSet.has(`${a.type}:${a.admissionId}`)
  );

  // Send and log
  for (const alert of newAlerts) {
    await sendAlertToAll(alert.message);
    await db.alertLog.create({
      data: {
        alertType: alert.type,
        admissionId: alert.admissionId,
        message: alert.message,
      },
    });
  }

  return NextResponse.json({
    checked: admissions.length,
    alertsFound: alerts.length,
    alertsSent: newAlerts.length,
    alerts: newAlerts.map((a) => a.message),
  });
}
