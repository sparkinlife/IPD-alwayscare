export const dynamic = "force-dynamic";

import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/db";
import { getTodayUTCDate } from "@/lib/date-utils";
import { hasAnyAbnormalVital } from "@/lib/vitals-thresholds";
import { cn } from "@/lib/utils";
import { AutoRefresh } from "@/components/management/auto-refresh";

interface ManagementPageProps {
  searchParams: Promise<{
    ward?: string;
    condition?: string;
  }>;
}

type OverdueItem = {
  admissionId: string;
  patientName: string;
  label: string;
  minutesLate: number;
  type: "MED" | "FOOD";
};

type ActivityItem = {
  admissionId: string;
  patientName: string;
  at: Date;
  title: string;
  detail: string;
};

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export default async function ManagementDashboardPage({
  searchParams,
}: ManagementPageProps) {
  const { ward, condition } = await searchParams;

  const today = getTodayUTCDate();
  const nowTime = formatInTimeZone(new Date(), "Asia/Kolkata", "HH:mm");
  const nowMinutes = toMinutes(nowTime);

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
        include: { recordedBy: { select: { name: true } } },
      },
      treatmentPlans: {
        where: { isActive: true, deletedAt: null },
        include: {
          administrations: {
            where: { scheduledDate: today },
            orderBy: { scheduledTime: "asc" },
            include: { administeredBy: { select: { name: true } } },
          },
        },
      },
      dietPlans: {
        where: { isActive: true, deletedAt: null },
        include: {
          feedingSchedules: {
            where: { isActive: true },
            include: {
              feedingLogs: {
                where: { date: today },
                include: { loggedBy: { select: { name: true } } },
              },
            },
          },
        },
      },
      clinicalNotes: {
        orderBy: { recordedAt: "desc" },
        take: 1,
        include: { recordedBy: { select: { name: true } } },
      },
    },
    orderBy: { admissionDate: "desc" },
  });

  const activeAdmissions = admissions.filter((a) => a.status === "ACTIVE");
  const registeredAdmissions = admissions.filter((a) => a.status === "REGISTERED");

  const filteredActiveAdmissions = activeAdmissions.filter((a) => {
    if (ward && a.ward !== ward) return false;
    if (condition && a.condition !== condition) return false;
    return true;
  });

  const overdueItems: OverdueItem[] = [];
  const activities: ActivityItem[] = [];

  for (const admission of activeAdmissions) {
    for (const plan of admission.treatmentPlans) {
      for (const slot of plan.scheduledTimes) {
        const done = plan.administrations.find(
          (adm) => adm.scheduledTime === slot && (adm.wasAdministered || adm.wasSkipped)
        );
        if (done) continue;

        const minutesLate = nowMinutes - toMinutes(slot);
        if (minutesLate > 30) {
          overdueItems.push({
            admissionId: admission.id,
            patientName: admission.patient.name,
            label: `${plan.drugName} (${slot})`,
            minutesLate,
            type: "MED",
          });
        }
      }

      for (const adm of plan.administrations) {
        if (!adm.wasAdministered && !adm.wasSkipped) continue;
        activities.push({
          admissionId: admission.id,
          patientName: admission.patient.name,
          at: adm.actualTime ?? adm.createdAt,
          title: adm.wasAdministered ? "Medication given" : "Medication skipped",
          detail: `${plan.drugName} · ${adm.scheduledTime}`,
        });
      }
    }

    for (const diet of admission.dietPlans) {
      for (const schedule of diet.feedingSchedules) {
        const todayLog = schedule.feedingLogs[0];
        const isDone = todayLog && todayLog.status !== "PENDING";
        const minutesLate = nowMinutes - toMinutes(schedule.scheduledTime);
        if (!isDone && minutesLate > 30) {
          overdueItems.push({
            admissionId: admission.id,
            patientName: admission.patient.name,
            label: `${schedule.foodType} (${schedule.scheduledTime})`,
            minutesLate,
            type: "FOOD",
          });
        }

        if (todayLog && todayLog.status !== "PENDING") {
          activities.push({
            admissionId: admission.id,
            patientName: admission.patient.name,
            at: todayLog.updatedAt,
            title: "Feeding logged",
            detail: `${schedule.foodType} · ${todayLog.status}`,
          });
        }
      }
    }

    const latestNote = admission.clinicalNotes[0];
    if (latestNote) {
      activities.push({
        admissionId: admission.id,
        patientName: admission.patient.name,
        at: latestNote.recordedAt,
        title: "Clinical note",
        detail: latestNote.content,
      });
    }

    const latestVital = admission.vitalRecords[0];
    if (latestVital) {
      activities.push({
        admissionId: admission.id,
        patientName: admission.patient.name,
        at: latestVital.recordedAt,
        title: "Vitals recorded",
        detail: [
          latestVital.temperature != null ? `Temp ${latestVital.temperature}°C` : null,
          latestVital.heartRate != null ? `HR ${latestVital.heartRate}` : null,
          latestVital.respRate != null ? `RR ${latestVital.respRate}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      });
    }
  }

  overdueItems.sort((a, b) => b.minutesLate - a.minutesLate);
  const overdueMeds = overdueItems.filter((x) => x.type === "MED");
  const overdueFeeds = overdueItems.filter((x) => x.type === "FOOD");

  const criticalAdmissions = activeAdmissions.filter((a) => {
    if (a.condition === "CRITICAL") return true;
    const v = a.vitalRecords[0];
    return v ? hasAnyAbnormalVital(v) : false;
  });

  const latestActivities = activities
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 12);

  const wardChoices = ["ALL", "GENERAL", "ISOLATION", "ICU"] as const;
  const conditionChoices = [
    "ALL",
    "CRITICAL",
    "GUARDED",
    "STABLE",
    "IMPROVING",
    "RECOVERED",
  ] as const;

  return (
    <div className="space-y-4">
      <AutoRefresh intervalMs={60_000} />

      <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-foreground">External Management Dashboard</h1>
            <p className="text-xs text-muted-foreground">
              Last refreshed at {formatInTimeZone(new Date(), "Asia/Kolkata", "dd MMM yyyy, HH:mm")}
            </p>
          </div>
          <Link
            href="/management"
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            Reset Filters
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <div className="rounded-lg border border-border bg-clinic-teal-light p-3">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-xl font-semibold text-clinic-teal">{activeAdmissions.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-amber-50 p-3">
            <p className="text-xs text-muted-foreground">Registered</p>
            <p className="text-xl font-semibold text-amber-700">{registeredAdmissions.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-red-50 p-3">
            <p className="text-xs text-muted-foreground">Critical</p>
            <p className="text-xl font-semibold text-red-700">{criticalAdmissions.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-red-50 p-3">
            <p className="text-xs text-muted-foreground">Overdue Meds</p>
            <p className="text-xl font-semibold text-red-700">{overdueMeds.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-orange-50 p-3">
            <p className="text-xs text-muted-foreground">Overdue Feedings</p>
            <p className="text-xl font-semibold text-orange-700">{overdueFeeds.length}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Filter Active Patients</h2>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {wardChoices.map((choice) => {
              const active = (ward ?? "ALL") === choice;
              const href =
                choice === "ALL"
                  ? `/management${condition ? `?condition=${condition}` : ""}`
                  : `/management?ward=${choice}${condition ? `&condition=${condition}` : ""}`;
              return (
                <Link
                  key={choice}
                  href={href}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    active
                      ? "border-clinic-teal bg-clinic-teal-light text-clinic-teal"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {choice}
                </Link>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            {conditionChoices.map((choice) => {
              const active = (condition ?? "ALL") === choice;
              const href =
                choice === "ALL"
                  ? `/management${ward ? `?ward=${ward}` : ""}`
                  : `/management?condition=${choice}${ward ? `&ward=${ward}` : ""}`;
              return (
                <Link
                  key={choice}
                  href={href}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    active
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {choice}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Overdue Medication Alerts</h2>
          <div className="mt-3 space-y-2">
            {overdueMeds.length === 0 ? (
              <p className="text-sm text-muted-foreground">No overdue medications right now.</p>
            ) : (
              overdueMeds.slice(0, 10).map((item, idx) => (
                <Link
                  key={`${item.admissionId}-${item.label}-${idx}`}
                  href={`/management/patients/${item.admissionId}?tab=meds`}
                  className="block rounded-lg border border-red-200 bg-red-50 p-3 hover:bg-red-100"
                >
                  <p className="text-sm font-medium text-red-700">{item.patientName}</p>
                  <p className="text-xs text-red-700/90">{item.label}</p>
                  <p className="text-xs text-red-700/90">{item.minutesLate} min overdue</p>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Overdue Feeding Alerts</h2>
          <div className="mt-3 space-y-2">
            {overdueFeeds.length === 0 ? (
              <p className="text-sm text-muted-foreground">No overdue feedings right now.</p>
            ) : (
              overdueFeeds.slice(0, 10).map((item, idx) => (
                <Link
                  key={`${item.admissionId}-${item.label}-${idx}`}
                  href={`/management/patients/${item.admissionId}?tab=food`}
                  className="block rounded-lg border border-orange-200 bg-orange-50 p-3 hover:bg-orange-100"
                >
                  <p className="text-sm font-medium text-orange-700">{item.patientName}</p>
                  <p className="text-xs text-orange-700/90">{item.label}</p>
                  <p className="text-xs text-orange-700/90">{item.minutesLate} min overdue</p>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Critical Patients</h2>
        <div className="mt-3 space-y-2">
          {criticalAdmissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No critical alerts at this time.</p>
          ) : (
            criticalAdmissions.map((admission) => (
              <Link
                key={admission.id}
                href={`/management/patients/${admission.id}?tab=vitals`}
                className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 hover:bg-red-100"
              >
                <div>
                  <p className="text-sm font-medium text-red-700">{admission.patient.name}</p>
                  <p className="text-xs text-red-700/90">
                    {admission.condition === "CRITICAL"
                      ? "Condition marked CRITICAL"
                      : "Latest vitals are abnormal"}
                  </p>
                </div>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                  {admission.ward ?? "UNASSIGNED"}
                </span>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Patients In IPD</h2>
          <span className="text-xs text-muted-foreground">{filteredActiveAdmissions.length} active</span>
        </div>

        <div className="mt-3 space-y-2">
          {filteredActiveAdmissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active patients match current filters.</p>
          ) : (
            filteredActiveAdmissions.map((admission) => (
              <Link
                key={admission.id}
                href={`/management/patients/${admission.id}?tab=overview`}
                className="block rounded-lg border border-border p-3 hover:bg-muted"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{admission.patient.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {admission.diagnosis || "Diagnosis pending"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      {admission.ward ?? "UNASSIGNED"}
                    </p>
                    {admission.cageNumber && (
                      <p className="text-[11px] text-muted-foreground">Cage {admission.cageNumber}</p>
                    )}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        {registeredAdmissions.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Awaiting Clinical Setup
            </p>
            <div className="mt-2 space-y-1.5">
              {registeredAdmissions.map((admission) => (
                <Link
                  key={admission.id}
                  href={`/management/patients/${admission.id}?tab=overview`}
                  className="block text-sm text-amber-800 hover:underline"
                >
                  {admission.patient.name} · registered by {admission.admittedBy.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Latest Activity</h2>
        <div className="mt-3 space-y-2">
          {latestActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity available.</p>
          ) : (
            latestActivities.map((item, idx) => (
              <Link
                key={`${item.admissionId}-${item.at.getTime()}-${idx}`}
                href={`/management/patients/${item.admissionId}?tab=logs`}
                className="block rounded-lg border border-border p-3 hover:bg-muted"
              >
                <p className="text-sm font-medium text-foreground">{item.patientName} · {item.title}</p>
                <p className="text-xs text-muted-foreground">{item.detail || "Update recorded"}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {formatInTimeZone(item.at, "Asia/Kolkata", "dd MMM yyyy, HH:mm")}
                </p>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
