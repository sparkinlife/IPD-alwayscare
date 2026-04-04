import { db } from "@/lib/db";
import { getLogsTimelineEntries } from "@/lib/logs-queries";

export async function getPatientPageShell(admissionId: string) {
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
      status: true,
      patient: {
        select: {
          id: true,
          name: true,
          breed: true,
          age: true,
          sex: true,
          weight: true,
          species: true,
          color: true,
          isStray: true,
          rescueLocation: true,
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
  const admission = await db.admission.findFirst({
    where: { id: admissionId, deletedAt: null },
    select: {
      vitalRecords: {
        orderBy: { recordedAt: "desc" },
        include: { recordedBy: { select: { name: true } } },
      },
    },
  });

  return admission?.vitalRecords ?? [];
}

export async function getPatientMedsData(admissionId: string, today: Date) {
  const admission = await db.admission.findFirst({
    where: { id: admissionId, deletedAt: null },
    select: {
      treatmentPlans: {
        where: { deletedAt: null },
        include: {
          administrations: {
            where: { scheduledDate: today },
            orderBy: { scheduledTime: "asc" },
            include: { administeredBy: { select: { name: true } } },
          },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      fluidTherapies: {
        include: {
          rateChanges: {
            orderBy: { changedAt: "desc" },
            include: { changedBy: { select: { name: true } } },
          },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return {
    treatmentPlans: admission?.treatmentPlans ?? [],
    fluidTherapies: admission?.fluidTherapies ?? [],
  };
}

export async function getPatientFoodData(
  admissionId: string,
  sevenDaysAgo: Date
) {
  const admission = await db.admission.findFirst({
    where: { id: admissionId, deletedAt: null },
    select: {
      dietPlans: {
        where: { deletedAt: null },
        include: {
          feedingSchedules: {
            include: {
              feedingLogs: {
                where: { date: { gte: sevenDaysAgo } },
                orderBy: { date: "desc" },
                select: {
                  id: true,
                  date: true,
                  status: true,
                  amountConsumed: true,
                  notes: true,
                },
              },
            },
          },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return admission?.dietPlans ?? [];
}

export async function getPatientNotesData(admissionId: string) {
  const admission = await db.admission.findFirst({
    where: { id: admissionId, deletedAt: null },
    select: {
      clinicalNotes: {
        orderBy: { recordedAt: "desc" },
        include: { recordedBy: { select: { name: true, role: true } } },
      },
    },
  });

  return admission?.clinicalNotes ?? [];
}

export async function getPatientLabsData(admissionId: string) {
  const admission = await db.admission.findFirst({
    where: { id: admissionId, deletedAt: null },
    select: {
      labResults: {
        orderBy: { resultDate: "desc" },
        include: { createdBy: { select: { name: true } } },
      },
    },
  });

  return admission?.labResults ?? [];
}

export async function getPatientBathData(admissionId: string) {
  const admission = await db.admission.findFirst({
    where: { id: admissionId, deletedAt: null },
    select: {
      bathLogs: {
        orderBy: { bathedAt: "desc" },
        include: { bathedBy: { select: { name: true } } },
      },
    },
  });

  return admission?.bathLogs ?? [];
}

export async function getPatientIsolationData(admissionId: string) {
  const admission = await db.admission.findFirst({
    where: { id: admissionId, deletedAt: null },
    select: {
      isolationProtocol: {
        include: {
          disinfectionLogs: {
            orderBy: { performedAt: "desc" },
            include: { performedBy: { select: { name: true } } },
          },
        },
      },
      labResults: {
        orderBy: { resultDate: "desc" },
        select: {
          id: true,
          testType: true,
          testName: true,
          result: true,
          resultDate: true,
          isAbnormal: true,
        },
      },
    },
  });

  return {
    isolationProtocol: admission?.isolationProtocol ?? null,
    labResults: admission?.labResults ?? [],
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
  admissionId: string,
  today: Date,
  sevenDaysAgo: Date
): Promise<import("@/lib/logs-read-model").LogsTimelineEntry[]> {
  return getLogsTimelineEntries(admissionId, {
    medicationDate: today,
    feedingFromDate: sevenDaysAgo,
  });
}
