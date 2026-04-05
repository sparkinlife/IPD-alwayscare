import { isBathDue } from "@/lib/date-utils";

export interface DashboardSummaryRow {
  id: string;
  ward: string | null;
  condition: string | null;
  pendingMeds: number;
  upcomingFeedings: number;
  bathDue: boolean;
  admissionDate: Date;
}

export interface DashboardSummaryAdmissionRow {
  id: string;
  ward: string | null;
  condition: string | null;
  admissionDate: Date;
  bathLogs: Array<{ bathedAt: Date }>;
  treatmentPlans: Array<{
    scheduledTimes: string[];
    administrations: Array<{
      wasAdministered: boolean;
      wasSkipped: boolean;
    }>;
  }>;
  dietPlans: Array<{
    feedingSchedules: Array<{
      scheduledTime: string;
    }>;
  }>;
}

export interface DashboardQueueTreatmentPlan {
  drugName: string;
  scheduledTimes: string[];
  administrations: Array<{
    scheduledTime: string;
    wasAdministered: boolean;
    wasSkipped: boolean;
  }>;
}

export interface DashboardQueueAdmissionRow {
  id: string;
  cageNumber: string | null;
  condition: string | null;
  ward: string | null;
  diagnosis: string | null;
  attendingDoctor: string | null;
  admissionDate: Date;
  patient: {
    name: string;
    breed: string | null;
    age: string | null;
    weight: number | null;
  };
  vitalRecords: Array<{
    temperature: number | null;
    heartRate: number | null;
    weight: number | null;
  }>;
  bathLogs: Array<{
    bathedAt: Date;
  }>;
  treatmentPlans: DashboardQueueTreatmentPlan[];
}

export interface DashboardQueueAdmission {
  id: string;
  cageNumber: string | null;
  condition: string | null;
  ward: string | null;
  diagnosis: string | null;
  attendingDoctor: string | null;
  admissionDate: Date;
  bathReferenceDate: Date;
  patient: {
    name: string;
    breed: string | null;
    age: string | null;
    weight: number | null;
  };
  latestVital: {
    temperature: number | null;
    heartRate: number | null;
    weight: number | null;
  } | null;
  nextMedication: {
    drugName: string;
    scheduledTime: string;
  } | null;
}

export function buildDashboardStats(rows: DashboardSummaryRow[]) {
  return {
    totalActive: rows.length,
    criticalCount: rows.filter((row) => row.condition === "CRITICAL").length,
    pendingMedsCount: rows.reduce((sum, row) => sum + row.pendingMeds, 0),
    feedingsCount: rows.reduce((sum, row) => sum + row.upcomingFeedings, 0),
    bathsDueCount: rows.filter((row) => row.bathDue).length,
  };
}

function countPendingMeds(
  treatmentPlans: DashboardSummaryAdmissionRow["treatmentPlans"]
): number {
  return treatmentPlans.reduce((sum, plan) => {
    const completedCount = plan.administrations.filter(
      (administration) =>
        administration.wasAdministered || administration.wasSkipped
    ).length;

    return sum + Math.max(0, plan.scheduledTimes.length - completedCount);
  }, 0);
}

export function countUpcomingFeedings(
  dietPlans: DashboardSummaryAdmissionRow["dietPlans"],
  nowTime: string,
  laterTime: string
): number {
  return dietPlans.reduce((sum, plan) => {
    const upcomingCount = plan.feedingSchedules.filter((schedule) => {
      if (laterTime < nowTime) {
        return (
          schedule.scheduledTime >= nowTime ||
          schedule.scheduledTime <= laterTime
        );
      }

      return (
        schedule.scheduledTime >= nowTime &&
        schedule.scheduledTime <= laterTime
      );
    }).length;

    return sum + upcomingCount;
  }, 0);
}

export function getBathReferenceDate(
  admissionDate: Date,
  bathLogs: Array<{ bathedAt: Date }>
): Date {
  return bathLogs[0]?.bathedAt ?? admissionDate;
}

export function selectLatestVital(
  vitalRecords: DashboardQueueAdmissionRow["vitalRecords"]
): DashboardQueueAdmission["latestVital"] {
  return vitalRecords[0] ?? null;
}

export function selectNextMedication(
  treatmentPlans: DashboardQueueAdmissionRow["treatmentPlans"]
): DashboardQueueAdmission["nextMedication"] {
  return (
    treatmentPlans
      .flatMap((plan) => {
        const scheduledTimes =
          plan.scheduledTimes ?? plan.administrations.map((entry) => entry.scheduledTime);

        return scheduledTimes
          .filter((scheduledTime) => {
            const administration = plan.administrations.find(
              (entry) => entry.scheduledTime === scheduledTime
            );

            return (
              !administration ||
              (!administration.wasAdministered && !administration.wasSkipped)
            );
          })
          .map((scheduledTime) => ({
            drugName: plan.drugName,
            scheduledTime,
          }));
      })
      .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))[0] ?? null
  );
}

export function toDashboardSummaryRow(
  admission: DashboardSummaryAdmissionRow,
  nowTime: string,
  laterTime: string
): DashboardSummaryRow {
  const lastBathAt = getBathReferenceDate(admission.admissionDate, admission.bathLogs);

  return {
    id: admission.id,
    ward: admission.ward,
    condition: admission.condition,
    admissionDate: admission.admissionDate,
    pendingMeds: countPendingMeds(admission.treatmentPlans),
    upcomingFeedings: countUpcomingFeedings(
      admission.dietPlans,
      nowTime,
      laterTime
    ),
    bathDue: isBathDue(lastBathAt).isDue,
  };
}

export function toDashboardQueueAdmission(
  admission: DashboardQueueAdmissionRow
): DashboardQueueAdmission {
  return {
    id: admission.id,
    cageNumber: admission.cageNumber,
    condition: admission.condition,
    ward: admission.ward,
    diagnosis: admission.diagnosis,
    attendingDoctor: admission.attendingDoctor,
    admissionDate: admission.admissionDate,
    bathReferenceDate: getBathReferenceDate(
      admission.admissionDate,
      admission.bathLogs
    ),
    patient: admission.patient,
    latestVital: selectLatestVital(admission.vitalRecords),
    nextMedication: selectNextMedication(admission.treatmentPlans),
  };
}

export function sortDashboardQueue<
  T extends { condition: string | null; admissionDate: Date },
>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const aRank = a.condition === "CRITICAL" ? 0 : 1;
    const bRank = b.condition === "CRITICAL" ? 0 : 1;

    if (aRank !== bRank) {
      return aRank - bRank;
    }

    return b.admissionDate.getTime() - a.admissionDate.getTime();
  });
}

export function filterDashboardQueue<T extends { ward: string | null }>(
  rows: T[],
  wardFilter?: string
) {
  if (!wardFilter) {
    return rows;
  }

  return rows.filter((row) => row.ward === wardFilter);
}
