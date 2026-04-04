import { db } from "@/lib/db";
import type { LogsAdmission } from "@/lib/logs-read-model";

export async function getManagementPatientPageShell(admissionId: string) {
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
      attendingDoctor: true,
      status: true,
      admittedBy: {
        select: { name: true },
      },
      patient: {
        select: {
          id: true,
          name: true,
          species: true,
          breed: true,
          deletedAt: true,
        },
      },
    },
  });
}

export async function getManagementPatientOverviewData(
  admissionId: string,
  today: Date
) {
  return db.admission.findFirst({
    where: { id: admissionId, deletedAt: null },
    select: {
      vitalRecords: {
        orderBy: { recordedAt: "desc" },
        take: 1,
        include: { recordedBy: { select: { name: true } } },
      },
      clinicalNotes: {
        orderBy: { recordedAt: "desc" },
        take: 1,
        include: { recordedBy: { select: { name: true } } },
      },
      treatmentPlans: {
        where: { isActive: true, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          drugName: true,
          scheduledTimes: true,
          administrations: {
            where: { scheduledDate: today },
            orderBy: { scheduledTime: "asc" },
            select: {
              scheduledTime: true,
              wasAdministered: true,
              wasSkipped: true,
            },
          },
        },
      },
      dietPlans: {
        where: { isActive: true, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          feedingSchedules: {
            where: { isActive: true },
            select: {
              id: true,
              foodType: true,
              scheduledTime: true,
              feedingLogs: {
                where: { date: today },
                orderBy: { date: "desc" },
                select: {
                  id: true,
                  date: true,
                  status: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function getManagementPatientMedsData(
  admissionId: string,
  today: Date
) {
  const admission = await db.admission.findFirst({
    where: { id: admissionId, deletedAt: null },
    select: {
      treatmentPlans: {
        where: { isActive: true, deletedAt: null },
        include: {
          administrations: {
            where: { scheduledDate: today },
            orderBy: { scheduledTime: "asc" },
            include: { administeredBy: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      fluidTherapies: {
        where: { isActive: true },
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

export async function getManagementPatientFoodData(
  admissionId: string,
  today: Date
) {
  const admission = await db.admission.findFirst({
    where: { id: admissionId, deletedAt: null },
    select: {
      dietPlans: {
        where: { isActive: true, deletedAt: null },
        include: {
          feedingSchedules: {
            where: { isActive: true },
            include: {
              feedingLogs: {
                where: { date: today },
                orderBy: { date: "desc" },
                select: {
                  id: true,
                  date: true,
                  status: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return admission?.dietPlans ?? [];
}

export async function getManagementPatientIsolationData(admissionId: string) {
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
    },
  });

  return admission?.isolationProtocol ?? null;
}

export async function getManagementPatientMediaProofs(admissionId: string) {
  const admission = await db.admission.findFirst({
    where: { id: admissionId, deletedAt: null },
    select: {
      vitalRecords: {
        select: { id: true },
      },
      treatmentPlans: {
        where: { deletedAt: null },
        select: {
          administrations: {
            select: { id: true },
          },
        },
      },
      dietPlans: {
        where: { deletedAt: null },
        select: {
          feedingSchedules: {
            select: {
              feedingLogs: {
                select: { id: true },
              },
            },
          },
        },
      },
      bathLogs: {
        select: { id: true },
      },
      labResults: {
        select: { id: true },
      },
      fluidTherapies: {
        select: { id: true },
      },
      isolationProtocol: {
        select: {
          disinfectionLogs: {
            select: { id: true },
          },
        },
      },
    },
  });

  if (!admission) return [];

  const recordIds = Array.from(
    new Set([
      ...admission.vitalRecords.map((record) => record.id),
      ...admission.treatmentPlans.flatMap((plan) =>
        plan.administrations.map((administration) => administration.id)
      ),
      ...admission.dietPlans.flatMap((plan) =>
        plan.feedingSchedules.flatMap((schedule) =>
          schedule.feedingLogs.map((log) => log.id)
        )
      ),
      ...admission.bathLogs.map((record) => record.id),
      ...admission.labResults.map((record) => record.id),
      ...admission.fluidTherapies.map((record) => record.id),
      ...(admission.isolationProtocol?.disinfectionLogs.map((record) => record.id) ??
        []),
    ])
  );

  if (recordIds.length === 0) return [];

  return db.proofAttachment.findMany({
    where: { recordId: { in: recordIds } },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getManagementPatientLogsData(
  admissionId: string
): Promise<LogsAdmission | null> {
  return db.admission.findFirst({
    where: { id: admissionId, deletedAt: null },
    select: {
      id: true,
      treatmentPlans: {
        where: { deletedAt: null },
        select: {
          drugName: true,
          dose: true,
          route: true,
          administrations: {
            orderBy: [{ scheduledDate: "desc" }, { scheduledTime: "asc" }],
            select: {
              scheduledTime: true,
              wasAdministered: true,
              wasSkipped: true,
              skipReason: true,
              actualTime: true,
              createdAt: true,
              administeredBy: { select: { name: true } },
            },
          },
        },
      },
      vitalRecords: {
        orderBy: { recordedAt: "desc" },
        select: {
          recordedAt: true,
          temperature: true,
          heartRate: true,
          respRate: true,
          painScore: true,
          weight: true,
          recordedBy: { select: { name: true } },
        },
      },
      dietPlans: {
        where: { deletedAt: null },
        select: {
          feedingSchedules: {
            select: {
              scheduledTime: true,
              foodType: true,
              feedingLogs: {
                orderBy: { date: "desc" },
                select: {
                  status: true,
                  createdAt: true,
                  loggedBy: { select: { name: true } },
                },
              },
            },
          },
        },
      },
      bathLogs: {
        orderBy: { bathedAt: "desc" },
        select: {
          bathedAt: true,
          notes: true,
          bathedBy: { select: { name: true } },
        },
      },
      clinicalNotes: {
        orderBy: { recordedAt: "desc" },
        select: {
          recordedAt: true,
          category: true,
          content: true,
          recordedBy: { select: { name: true, role: true } },
        },
      },
      isolationProtocol: {
        select: {
          disinfectionLogs: {
            orderBy: { performedAt: "desc" },
            select: {
              performedAt: true,
              performedBy: { select: { name: true } },
            },
          },
        },
      },
      fluidTherapies: {
        select: {
          fluidType: true,
          rate: true,
          startTime: true,
          endTime: true,
          createdBy: { select: { name: true } },
          rateChanges: {
            orderBy: { changedAt: "desc" },
            select: {
              oldRate: true,
              newRate: true,
              changedAt: true,
              changedBy: { select: { name: true } },
              reason: true,
            },
          },
        },
      },
    },
  });
}
