import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { loadEnvConfig } from "@next/env";

const IST_ZONE = "Asia/Kolkata";
const args = new Set(process.argv.slice(2));
const applyMode = args.has("--apply");
const dryRun = !applyMode;

loadEnvConfig(process.cwd());

function getTodayUTCDate(): Date {
  const todayIST = formatInTimeZone(new Date(), IST_ZONE, "yyyy-MM-dd");
  return new Date(`${todayIST}T00:00:00.000Z`);
}

function getTodayISTBounds(): { dayLabel: string; startUTC: Date; endUTC: Date } {
  const dayLabel = formatInTimeZone(new Date(), IST_ZONE, "yyyy-MM-dd");
  return {
    dayLabel,
    startUTC: new Date(`${dayLabel}T00:00:00+05:30`),
    endUTC: new Date(`${dayLabel}T23:59:59.999+05:30`),
  };
}

function scheduleKey(schedule: {
  scheduledTime: string;
  foodType: string;
  portion: string;
}): string {
  return `${schedule.scheduledTime}::${schedule.foodType}::${schedule.portion}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const today = getTodayUTCDate();
  const { dayLabel, startUTC, endUTC } = getTodayISTBounds();

  console.log(
    dryRun
      ? `Running feeding integrity repair in DRY-RUN mode for ${dayLabel} (IST).`
      : `Running feeding integrity repair in APPLY mode for ${dayLabel} (IST).`
  );
  console.log(
    dryRun
      ? "No database writes will be made. Re-run with --apply to execute repairs."
      : "Database writes are enabled."
  );

  const admissions = await prisma.admission.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      patient: { deletedAt: null },
    },
    select: {
      id: true,
      patient: { select: { name: true } },
    },
    orderBy: { admissionDate: "desc" },
  });

  let totalRepaired = 0;
  let totalSkipped = 0;
  let totalConflicts = 0;
  let touchedAdmissions = 0;

  for (const admission of admissions) {
    const activePlan = await prisma.dietPlan.findFirst({
      where: {
        admissionId: admission.id,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        feedingSchedules: {
          where: { isActive: true },
          select: {
            id: true,
            scheduledTime: true,
            foodType: true,
            portion: true,
            feedingLogs: {
              where: { date: today },
              select: { id: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!activePlan) continue;

    const inactivePlans = await prisma.dietPlan.findMany({
      where: {
        admissionId: admission.id,
        isActive: false,
        deletedAt: null,
        createdAt: {
          gte: startUTC,
          lte: endUTC,
        },
      },
      select: {
        id: true,
        feedingSchedules: {
          select: {
            id: true,
            scheduledTime: true,
            foodType: true,
            portion: true,
            feedingLogs: {
              where: { date: today },
              select: {
                id: true,
                status: true,
                amountConsumed: true,
                notes: true,
                loggedById: true,
                updatedAt: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const candidatesByKey = new Map<
      string,
      Array<{
        scheduleId: string;
        log: {
          id: string;
          status: (typeof inactivePlans)[number]["feedingSchedules"][number]["feedingLogs"][number]["status"];
          amountConsumed: string | null;
          notes: string | null;
          loggedById: string;
          updatedAt: Date;
        };
      }>
    >();

    for (const oldPlan of inactivePlans) {
      for (const oldSchedule of oldPlan.feedingSchedules) {
        const oldLog = oldSchedule.feedingLogs[0];
        if (!oldLog) continue;
        const key = scheduleKey(oldSchedule);
        const existing = candidatesByKey.get(key) ?? [];
        existing.push({
          scheduleId: oldSchedule.id,
          log: {
            id: oldLog.id,
            status: oldLog.status,
            amountConsumed: oldLog.amountConsumed,
            notes: oldLog.notes,
            loggedById: oldLog.loggedById,
            updatedAt: oldLog.updatedAt,
          },
        });
        candidatesByKey.set(key, existing);
      }
    }

    for (const list of candidatesByKey.values()) {
      list.sort((a, b) => b.log.updatedAt.getTime() - a.log.updatedAt.getTime());
    }

    let repaired = 0;
    let skipped = 0;
    let conflicts = 0;

    for (const activeSchedule of activePlan.feedingSchedules) {
      if (activeSchedule.feedingLogs.length > 0) {
        skipped += 1;
        continue;
      }

      const key = scheduleKey(activeSchedule);
      const candidates = candidatesByKey.get(key) ?? [];

      if (candidates.length === 0) {
        skipped += 1;
        continue;
      }

      if (candidates.length > 1) {
        conflicts += 1;
        continue;
      }

      const [candidate] = candidates;
      candidatesByKey.set(key, []);

      if (dryRun) {
        repaired += 1;
        continue;
      }

      const createdLog = await prisma.feedingLog.create({
        data: {
          feedingScheduleId: activeSchedule.id,
          date: today,
          status: candidate.log.status,
          amountConsumed: candidate.log.amountConsumed,
          notes: candidate.log.notes,
          loggedById: candidate.log.loggedById,
        },
      });

      const oldProofs = await prisma.proofAttachment.findMany({
        where: {
          recordType: "FeedingLog",
          recordId: candidate.log.id,
        },
        select: {
          category: true,
          fileUrl: true,
          fileId: true,
          fileName: true,
          skipReason: true,
          uploadedById: true,
        },
      });

      if (oldProofs.length > 0) {
        await prisma.proofAttachment.createMany({
          data: oldProofs.map((proof) => ({
            category: proof.category,
            recordId: createdLog.id,
            recordType: "FeedingLog",
            fileUrl: proof.fileUrl,
            fileId: proof.fileId,
            fileName: proof.fileName,
            skipReason: proof.skipReason,
            uploadedById: proof.uploadedById,
          })),
        });
      }

      repaired += 1;
    }

    totalRepaired += repaired;
    totalSkipped += skipped;
    totalConflicts += conflicts;
    if (repaired > 0 || conflicts > 0) touchedAdmissions += 1;

    if (repaired > 0 || conflicts > 0 || skipped > 0) {
      console.log(
        `[${dryRun ? "DRY-RUN" : "APPLY"}] ${admission.patient.name} (${admission.id}) -> repaired=${repaired}, skipped=${skipped}, conflicts=${conflicts}`
      );
    }
  }

  console.log("");
  console.log("Repair summary:");
  console.log(`- Mode: ${dryRun ? "dry-run" : "apply"}`);
  console.log(`- Active admissions checked: ${admissions.length}`);
  console.log(`- Admissions touched (repairs/conflicts): ${touchedAdmissions}`);
  console.log(`- Repaired slots: ${totalRepaired}`);
  console.log(`- Skipped slots: ${totalSkipped}`);
  console.log(`- Conflict slots: ${totalConflicts}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Repair failed:", error);
  process.exitCode = 1;
});
