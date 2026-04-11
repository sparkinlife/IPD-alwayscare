import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import {
  CLINICAL_LIVE_PROFILE,
  patientShellTag,
  patientTabTag,
} from "@/lib/clinical-cache";
import { buildFoodTabData, type FoodTabData } from "@/lib/food-tab-data";
import { getLogsTimelineEntries } from "@/lib/logs-queries";

export async function getPatientPageShell(admissionId: string) {
  "use cache";
  cacheLife(CLINICAL_LIVE_PROFILE);
  cacheTag(patientShellTag(admissionId));

  return db.admission.findFirst({
    where: { id: admissionId, deletedAt: null },
    select: {
      id: true,
      patientId: true,
      admissionDate: true,
      ward: true,
      cageNumber: true,
      condition: true,
      diagnosis: true,
      chiefComplaint: true,
      diagnosisNotes: true,
      attendingDoctor: true,
      viralRisk: true,
      spayNeuterStatus: true,
      abcCandidate: true,
      status: true,
      patient: {
        select: {
          id: true,
          patientNumber: true,
          name: true,
          breed: true,
          age: true,
          sex: true,
          weight: true,
          species: true,
          color: true,
          isStray: true,
          rescueLocation: true,
          locationGpsCoordinates: true,
          ambulancePersonName: true,
          handlingNote: true,
          registrationMode: true,
          registrationModeOther: true,
          rescuerInfo: true,
          deletedAt: true,
        },
      },
    },
  });
}

export async function getPatientProfilePhoto(patientId: string) {
  return db.patientMedia.findFirst({
    where: { patientId, isProfilePhoto: true },
    select: { fileId: true },
  });
}

export async function getAvailableCages(admissionId: string) {
  const [allCages, occupiedCages] = await Promise.all([
    db.cageConfig.findMany({
      where: { isActive: true },
      orderBy: { cageNumber: "asc" },
      select: { ward: true, cageNumber: true },
    }),
    db.admission.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        patient: { deletedAt: null },
        id: { not: admissionId },
      },
      select: { ward: true, cageNumber: true },
    }),
  ]);

  const occupiedSet = new Set(
    occupiedCages
      .filter((admission) => admission.ward && admission.cageNumber)
      .map((admission) => `${admission.ward}:${admission.cageNumber}`)
  );

  return allCages.filter(
    (cage) => !occupiedSet.has(`${cage.ward}:${cage.cageNumber}`)
  );
}

export async function getPatientVitalsData(admissionId: string) {
  "use cache";
  cacheLife(CLINICAL_LIVE_PROFILE);
  cacheTag(patientTabTag(admissionId, "vitals"));

  return db.vitalRecord.findMany({
    where: {
      admissionId,
      admission: { deletedAt: null },
    },
    orderBy: [{ recordedAt: "desc" }, { id: "asc" }],
    include: {
      recordedBy: { select: { name: true } },
    },
  });
}

export async function getPatientMedsData(admissionId: string, today: Date) {
  "use cache";
  cacheLife(CLINICAL_LIVE_PROFILE);
  cacheTag(patientTabTag(admissionId, "meds"));

  const [treatmentPlans, fluidTherapies] = await Promise.all([
    db.treatmentPlan.findMany({
      where: {
        admissionId,
        deletedAt: null,
        admission: { deletedAt: null },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        drugName: true,
        dose: true,
        calculatedDose: true,
        route: true,
        frequency: true,
        customFrequency: true,
        scheduledTimes: true,
        isActive: true,
        startDate: true,
        endDate: true,
        notes: true,
        createdBy: { select: { name: true } },
        administrations: {
          where: { scheduledDate: today },
          orderBy: [{ scheduledTime: "asc" }, { id: "asc" }],
          select: {
            id: true,
            treatmentPlanId: true,
            scheduledDate: true,
            scheduledTime: true,
            wasAdministered: true,
            wasSkipped: true,
            skipReason: true,
            actualTime: true,
            administeredBy: { select: { name: true } },
          },
        },
      },
    }),
    db.fluidTherapy.findMany({
      where: {
        admissionId,
        admission: { deletedAt: null },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        fluidType: true,
        rate: true,
        additives: true,
        startTime: true,
        endTime: true,
        isActive: true,
        notes: true,
        createdBy: { select: { name: true } },
        rateChanges: {
          orderBy: [{ changedAt: "desc" }, { id: "asc" }],
          select: {
            id: true,
            oldRate: true,
            newRate: true,
            changedAt: true,
            reason: true,
            changedBy: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  return {
    treatmentPlans,
    fluidTherapies,
  };
}

export async function getPatientFoodData(
  admissionId: string,
  today: Date,
  sevenDaysAgo: Date
): Promise<FoodTabData> {
  "use cache";
  cacheLife(CLINICAL_LIVE_PROFILE);
  cacheTag(patientTabTag(admissionId, "food"));

  const [activePlan, historyLogs] = await Promise.all([
    db.dietPlan.findFirst({
      where: {
        admissionId,
        isActive: true,
        deletedAt: null,
        admission: { deletedAt: null },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        dietType: true,
        instructions: true,
        createdBy: { select: { name: true } },
        feedingSchedules: {
          where: { isActive: true },
          orderBy: [{ scheduledTime: "asc" }, { id: "asc" }],
          select: {
            id: true,
            scheduledTime: true,
            foodType: true,
            portion: true,
            feedingLogs: {
              where: { date: today },
              orderBy: { id: "asc" },
              take: 1,
              select: {
                id: true,
                status: true,
                amountConsumed: true,
                notes: true,
              },
            },
          },
        },
      },
    }),
    db.feedingLog.findMany({
      where: {
        date: { gte: sevenDaysAgo, lt: today },
        feedingSchedule: {
          dietPlan: {
            admissionId,
            deletedAt: null,
            admission: { deletedAt: null },
          },
        },
      },
      orderBy: [{ date: "desc" }, { id: "asc" }],
      select: {
        id: true,
        date: true,
        status: true,
        amountConsumed: true,
        notes: true,
        feedingSchedule: {
          select: {
            scheduledTime: true,
            foodType: true,
          },
        },
      },
    }),
  ]);

  return buildFoodTabData(activePlan, historyLogs);
}

export async function getPatientNotesData(admissionId: string) {
  "use cache";
  cacheLife(CLINICAL_LIVE_PROFILE);
  cacheTag(patientTabTag(admissionId, "notes"));

  return db.clinicalNote.findMany({
    where: {
      admissionId,
      admission: { deletedAt: null },
    },
    orderBy: [{ recordedAt: "desc" }, { id: "asc" }],
    include: { recordedBy: { select: { name: true, role: true } } },
  });
}

export async function getPatientLabsData(admissionId: string) {
  "use cache";
  cacheLife(CLINICAL_LIVE_PROFILE);
  cacheTag(patientTabTag(admissionId, "labs"));

  return db.labResult.findMany({
    where: {
      admissionId,
      admission: { deletedAt: null },
    },
    orderBy: [{ resultDate: "desc" }, { id: "asc" }],
    include: { createdBy: { select: { name: true } } },
  });
}

export async function getPatientBathData(admissionId: string) {
  "use cache";
  cacheLife(CLINICAL_LIVE_PROFILE);
  cacheTag(patientTabTag(admissionId, "bath"));

  return db.bathLog.findMany({
    where: {
      admissionId,
      admission: { deletedAt: null },
    },
    orderBy: [{ bathedAt: "desc" }, { id: "asc" }],
    include: { bathedBy: { select: { name: true } } },
  });
}

export async function getPatientIsolationData(admissionId: string) {
  "use cache";
  cacheLife(CLINICAL_LIVE_PROFILE);
  cacheTag(patientTabTag(admissionId, "isolation"));

  const [isolationProtocol, labResults] = await Promise.all([
    db.isolationProtocol.findFirst({
      where: {
        admissionId,
        admission: { deletedAt: null },
      },
      include: {
        disinfectionLogs: {
          orderBy: [{ performedAt: "desc" }, { id: "asc" }],
          include: { performedBy: { select: { name: true } } },
        },
      },
    }),
    db.labResult.findMany({
      where: {
        admissionId,
        admission: { deletedAt: null },
      },
      orderBy: [{ resultDate: "desc" }, { id: "asc" }],
      select: {
        id: true,
        testType: true,
        testName: true,
        result: true,
        resultDate: true,
        isAbnormal: true,
      },
    }),
  ]);

  return {
    isolationProtocol,
    labResults,
  };
}

export async function getPatientPhotosData(patientId: string) {
  return db.patientMedia.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { name: true } } },
  });
}

export async function getPatientLogsData(
  admissionId: string
): Promise<import("@/lib/logs-read-model").LogsTimelineEntry[]> {
  "use cache";
  cacheLife(CLINICAL_LIVE_PROFILE);
  cacheTag(patientTabTag(admissionId, "logs"));

  return getLogsTimelineEntries(admissionId);
}
