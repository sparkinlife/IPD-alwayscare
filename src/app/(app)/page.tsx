export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isBathDue, getTodayUTCDate } from "@/lib/date-utils";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { IsolationAlert } from "@/components/dashboard/isolation-alert";
import { PendingSetup } from "@/components/dashboard/pending-setup";
import { PatientCard } from "@/components/dashboard/patient-card";
import { WardFilter } from "@/components/dashboard/ward-filter";

interface DashboardPageProps {
  searchParams: Promise<{ ward?: string }>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { ward: wardFilter } = await searchParams;

  
  const today = getTodayUTCDate();

  const admissions = await db.admission.findMany({
    where: {
      status: { in: ["ACTIVE", "REGISTERED"] },
      deletedAt: null,
      patient: { deletedAt: null },
    },
    include: {
      patient: true,
      admittedBy: { select: { name: true } },
      vitalRecords: {
        orderBy: { recordedAt: "desc" },
        take: 1,
      },
      treatmentPlans: {
        where: { isActive: true },
        include: {
          administrations: {
            where: { scheduledDate: today },
          },
        },
      },
      bathLogs: {
        orderBy: { bathedAt: "desc" },
        take: 1,
      },
      dietPlans: {
        where: { isActive: true },
        include: {
          feedingSchedules: true,
        },
      },
      isolationProtocol: {
        select: { disease: true, ppeRequired: true },
      },
    },
    orderBy: { admissionDate: "desc" },
  });

  const activeAdmissions = admissions.filter((a) => a.status === "ACTIVE");
  const registeredAdmissions = admissions.filter(
    (a) => a.status === "REGISTERED"
  );
  const isolationAdmissions = activeAdmissions.filter(
    (a) => a.ward === "ISOLATION"
  );

  // Compute summary stats
  const criticalCount = activeAdmissions.filter(
    (a) => a.condition === "CRITICAL"
  ).length;

  const pendingMedsCount = activeAdmissions.reduce((sum, a) => {
    return sum + a.treatmentPlans.reduce((planSum, plan) => {
      if (!plan.isActive) return planSum;
      const totalSlots = plan.scheduledTimes.length;
      const doneSlots = plan.administrations.filter(
        (adm) => adm.wasAdministered || adm.wasSkipped
      ).length;
      return planSum + Math.max(0, totalSlots - doneSlots);
    }, 0);
  }, 0);

  // Feedings in next ~2 hours (IST-aware)
  const nowTimeStr = formatInTimeZone(new Date(), "Asia/Kolkata", "HH:mm");
  const twoHoursLater = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const laterTimeStr = formatInTimeZone(twoHoursLater, "Asia/Kolkata", "HH:mm");

  const feedingsCount = activeAdmissions.reduce((sum, a) => {
    return (
      sum +
      a.dietPlans.reduce((planSum, plan) => {
        const upcoming = plan.feedingSchedules.filter((s) => {
          if (laterTimeStr < nowTimeStr) {
            // Crosses midnight: show feedings from now to midnight OR midnight to laterTime
            return s.scheduledTime >= nowTimeStr || s.scheduledTime <= laterTimeStr;
          }
          return s.scheduledTime >= nowTimeStr && s.scheduledTime <= laterTimeStr;
        }).length;
        return planSum + upcoming;
      }, 0)
    );
  }, 0);

  const bathsDueCount = activeAdmissions.filter((a) => {
    const ref =
      a.bathLogs.length > 0 ? a.bathLogs[0].bathedAt : a.admissionDate;
    return isBathDue(ref).isDue;
  }).length;

  const stats = {
    totalActive: activeAdmissions.length,
    criticalCount,
    pendingMedsCount,
    feedingsCount,
    bathsDueCount,
  };

  // Sort active admissions: CRITICAL first, then by admissionDate desc
  const sortedActive = [...activeAdmissions].sort((a, b) => {
    const aIsCritical = a.condition === "CRITICAL" ? 0 : 1;
    const bIsCritical = b.condition === "CRITICAL" ? 0 : 1;
    if (aIsCritical !== bIsCritical) return aIsCritical - bIsCritical;
    return (
      new Date(b.admissionDate).getTime() - new Date(a.admissionDate).getTime()
    );
  });

  // Group by ward: General first, then Isolation, then others
  const wardOrder = ["GENERAL", "ISOLATION", "ICU"];
  const generalPatients = sortedActive.filter((a) => a.ward === "GENERAL");
  const isolationPatients = sortedActive.filter((a) => a.ward === "ISOLATION");
  const otherPatients = sortedActive.filter(
    (a) => a.ward !== "GENERAL" && a.ward !== "ISOLATION"
  );

  // Apply ward filter from URL
  let filteredAdmissions = sortedActive;
  if (wardFilter) {
    filteredAdmissions = sortedActive.filter(a => a.ward === wardFilter);
  }

  const isDoctor = session.role === "DOCTOR";

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <SummaryCards stats={stats} />

      <IsolationAlert admissions={isolationAdmissions} />

      <PendingSetup admissions={registeredAdmissions} isDoctor={isDoctor} />

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          Active Patients
          {activeAdmissions.length > 0 && (
            <span className="ml-1.5 text-muted-foreground font-normal">
              ({activeAdmissions.length})
            </span>
          )}
        </h2>
        <Suspense fallback={null}>
          <WardFilter />
        </Suspense>
      </div>

      {filteredAdmissions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {wardFilter
              ? `No ${wardFilter.toLowerCase()} ward patients`
              : "No active admissions"}
          </p>
        </div>
      ) : wardFilter ? (
        // Filtered view — flat list
        <div className="space-y-3">
          {filteredAdmissions.map((admission) => (
            <PatientCard key={admission.id} admission={admission} />
          ))}
        </div>
      ) : (
        // Grouped view: General → Isolation → Others
        <div className="space-y-4">
          {generalPatients.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-clinic-teal">
                General Ward
              </p>
              <div className="space-y-3">
                {generalPatients.map((admission) => (
                  <PatientCard key={admission.id} admission={admission} />
                ))}
              </div>
            </section>
          )}

          {isolationPatients.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-clinic-red">
                Isolation Ward
              </p>
              <div className="space-y-3">
                {isolationPatients.map((admission) => (
                  <PatientCard key={admission.id} admission={admission} />
                ))}
              </div>
            </section>
          )}

          {otherPatients.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Other
              </p>
              <div className="space-y-3">
                {otherPatients.map((admission) => (
                  <PatientCard key={admission.id} admission={admission} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
