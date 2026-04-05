import { formatInTimeZone } from "date-fns-tz";
import { cacheLife, cacheTag } from "next/cache";
import {
  CLINICAL_LIVE_PROFILE,
  dashboardQueueTag,
  dashboardSetupTag,
  dashboardSummaryTag,
} from "@/lib/clinical-cache";
import {
  buildDashboardStats,
  toDashboardQueueAdmission,
  toDashboardSummaryRow,
  type DashboardQueueAdmissionRow,
  type DashboardSummaryAdmissionRow,
} from "@/lib/dashboard-data";
import { db } from "@/lib/db";

const IST_ZONE = "Asia/Kolkata";
const FEEDING_WINDOW_HOURS = 2;

export type { DashboardQueueAdmission } from "@/lib/dashboard-data";

export interface DashboardSecondaryData {
  registeredAdmissions: Array<{
    id: string;
    admissionDate: Date;
    patient: {
      id: string;
      name: string;
      species: string;
      breed: string | null;
      age: string | null;
      weight: number | null;
      sex: string;
      color: string | null;
      isStray: boolean;
      rescueLocation: string | null;
      rescuerInfo: string | null;
    };
    admittedBy: { name: string };
  }>;
  isolationAdmissions: Array<{
    id: string;
    patient: {
      name: string;
    };
    isolationProtocol: {
      disease: string;
      ppeRequired: string[];
    } | null;
  }>;
}

export async function getDashboardSummary(today: Date) {
  "use cache";

  cacheLife(CLINICAL_LIVE_PROFILE);
  cacheTag(dashboardSummaryTag());

  const now = new Date();
  const twoHoursLater = new Date(
    now.getTime() + FEEDING_WINDOW_HOURS * 60 * 60 * 1000
  );
  const nowTime = formatInTimeZone(now, IST_ZONE, "HH:mm");
  const laterTime = formatInTimeZone(twoHoursLater, IST_ZONE, "HH:mm");

  const admissions = await db.admission.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      patient: { deletedAt: null },
    },
    orderBy: { admissionDate: "desc" },
    select: {
      id: true,
      ward: true,
      condition: true,
      admissionDate: true,
      treatmentPlans: {
        where: { isActive: true, deletedAt: null },
        select: {
          scheduledTimes: true,
          administrations: {
            where: { scheduledDate: today },
            select: {
              wasAdministered: true,
              wasSkipped: true,
            },
          },
        },
      },
      bathLogs: {
        orderBy: { bathedAt: "desc" },
        take: 1,
        select: { bathedAt: true },
      },
      dietPlans: {
        where: { isActive: true, deletedAt: null },
        select: {
          feedingSchedules: {
            where: { isActive: true },
            select: { scheduledTime: true },
          },
        },
      },
    },
  });

  const rows = admissions.map((admission) =>
    toDashboardSummaryRow(admission as DashboardSummaryAdmissionRow, nowTime, laterTime)
  );

  return buildDashboardStats(rows);
}

export async function getDashboardQueue(today: Date) {
  "use cache";

  cacheLife(CLINICAL_LIVE_PROFILE);
  cacheTag(dashboardQueueTag());

  const admissions = await db.admission.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      patient: { deletedAt: null },
    },
    orderBy: { admissionDate: "desc" },
    select: {
      id: true,
      cageNumber: true,
      condition: true,
      ward: true,
      diagnosis: true,
      attendingDoctor: true,
      admissionDate: true,
      patient: {
        select: {
          name: true,
          breed: true,
          age: true,
          weight: true,
        },
      },
      vitalRecords: {
        orderBy: { recordedAt: "desc" },
        take: 1,
        select: {
          temperature: true,
          heartRate: true,
          weight: true,
        },
      },
      bathLogs: {
        orderBy: { bathedAt: "desc" },
        take: 1,
        select: {
          bathedAt: true,
        },
      },
      treatmentPlans: {
        where: { isActive: true, deletedAt: null },
        select: {
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
    },
  });

  return admissions.map((admission) =>
    toDashboardQueueAdmission(admission as DashboardQueueAdmissionRow)
  );
}

export async function getDashboardSecondaryData(): Promise<DashboardSecondaryData> {
  "use cache";

  cacheLife(CLINICAL_LIVE_PROFILE);
  cacheTag(dashboardSetupTag());

  const [registeredAdmissions, isolationAdmissions] = await Promise.all([
    db.admission.findMany({
      where: {
        status: "REGISTERED",
        deletedAt: null,
        patient: { deletedAt: null },
      },
      orderBy: { admissionDate: "desc" },
      select: {
        id: true,
        admissionDate: true,
        admittedBy: {
          select: { name: true },
        },
        patient: {
          select: {
            id: true,
            name: true,
            species: true,
            breed: true,
            age: true,
            weight: true,
            sex: true,
            color: true,
            isStray: true,
            rescueLocation: true,
            rescuerInfo: true,
          },
        },
      },
    }),
    db.admission.findMany({
      where: {
        status: "ACTIVE",
        ward: "ISOLATION",
        deletedAt: null,
        patient: { deletedAt: null },
      },
      orderBy: { admissionDate: "desc" },
      select: {
        id: true,
        patient: {
          select: {
            name: true,
          },
        },
        isolationProtocol: {
          select: {
            disease: true,
            ppeRequired: true,
          },
        },
      },
    }),
  ]);

  return {
    registeredAdmissions,
    isolationAdmissions,
  };
}
