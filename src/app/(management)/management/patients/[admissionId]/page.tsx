import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { driveMediaUrl } from "@/lib/drive-url";
import { getTodayUTCDate } from "@/lib/date-utils";
import { CONDITION_CONFIG, WARD_CONFIG } from "@/lib/constants";
import {
  getManagementPatientTabLoadPlan,
  MANAGEMENT_PATIENT_TABS,
  normalizeManagementPatientTab,
} from "@/lib/management-patient-page-data";
import {
  getManagementPatientFoodData,
  getManagementPatientIsolationData,
  getManagementPatientLogsData,
  getManagementPatientMediaProofs,
  getManagementPatientMedsData,
  getManagementPatientOverviewData,
  getManagementPatientPageShell,
} from "@/lib/management-patient-page-queries";
import {
  getPatientBathData,
  getPatientLabsData,
  getPatientNotesData,
  getPatientPhotosData,
  getPatientVitalsData,
} from "@/lib/patient-page-queries";
import { LogsTab } from "@/components/patient/logs-tab";
import { cn } from "@/lib/utils";

interface ManagementPatientPageProps {
  params: Promise<{ admissionId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

function tabHref(admissionId: string, tab: string): string {
  return `/management/patients/${admissionId}?tab=${tab}`;
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export default async function ManagementPatientPage({
  params,
  searchParams,
}: ManagementPatientPageProps) {
  const { admissionId } = await params;
  const query = await searchParams;
  const tab = normalizeManagementPatientTab(query.tab);
  const loadPlan = getManagementPatientTabLoadPlan(tab);

  const today = getTodayUTCDate();
  const now = new Date();
  const nowMinutes = toMinutes(formatInTimeZone(now, "Asia/Kolkata", "HH:mm"));
  const updatedAtLabel = formatInTimeZone(now, "Asia/Kolkata", "dd MMM yyyy, HH:mm");

  const admission = await getManagementPatientPageShell(admissionId);

  if (!admission || admission.patient.deletedAt) notFound();

  const [
    overviewData,
    medsData,
    dietPlans,
    vitals,
    notes,
    labResults,
    bathLogs,
    isolationProtocol,
    patientMedia,
    proofs,
    logEntries,
  ] = await Promise.all([
    loadPlan.overview
      ? getManagementPatientOverviewData(admissionId, today)
      : Promise.resolve(null),
    loadPlan.meds
      ? getManagementPatientMedsData(admissionId, today)
      : Promise.resolve({ treatmentPlans: [], fluidTherapies: [] }),
    loadPlan.food
      ? getManagementPatientFoodData(admissionId, today)
      : Promise.resolve([]),
    loadPlan.vitals
      ? getPatientVitalsData(admissionId)
      : Promise.resolve([]),
    loadPlan.notes
      ? getPatientNotesData(admissionId)
      : Promise.resolve([]),
    loadPlan.labs
      ? getPatientLabsData(admissionId)
      : Promise.resolve([]),
    loadPlan.bath
      ? getPatientBathData(admissionId)
      : Promise.resolve([]),
    loadPlan.isolation
      ? getManagementPatientIsolationData(admissionId)
      : Promise.resolve(null),
    loadPlan.media
      ? getPatientPhotosData(admission.patientId)
      : Promise.resolve([]),
    loadPlan.media
      ? getManagementPatientMediaProofs(admissionId)
      : Promise.resolve([]),
    loadPlan.logs
      ? getManagementPatientLogsData(admissionId)
      : Promise.resolve([]),
  ]);

  const latestVital = overviewData?.vitalRecords[0] ?? null;
  const latestNote = overviewData?.clinicalNotes[0] ?? null;
  const activeTreatmentPlans = overviewData?.treatmentPlans ?? [];
  const activeDietPlans = overviewData?.dietPlans ?? [];

  const overdueMeds = activeTreatmentPlans.flatMap((plan) =>
    plan.scheduledTimes
      .map((slot) => {
        const todayAdmin = plan.administrations.find(
          (administration) => administration.scheduledTime === slot
        );
        if (todayAdmin?.wasAdministered || todayAdmin?.wasSkipped) return null;

        const late = nowMinutes - toMinutes(slot);
        if (late <= 30) return null;

        return {
          label: `${plan.drugName} (${slot})`,
          minutesLate: late,
        };
      })
      .filter(Boolean) as Array<{ label: string; minutesLate: number }>
  );

  const overdueFeeds = activeDietPlans.flatMap((plan) =>
    plan.feedingSchedules
      .map((schedule) => {
        const todayLog = schedule.feedingLogs[0] ?? null;
        if (todayLog && todayLog.status !== "PENDING") return null;

        const late = nowMinutes - toMinutes(schedule.scheduledTime);
        if (late <= 30) return null;

        return {
          label: `${schedule.foodType} (${schedule.scheduledTime})`,
          minutesLate: late,
        };
      })
      .filter(Boolean) as Array<{ label: string; minutesLate: number }>
  );

  const wardStyle = admission.ward ? WARD_CONFIG[admission.ward] : null;
  const conditionStyle = admission.condition
    ? CONDITION_CONFIG[admission.condition]
    : null;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/management"
            className="text-xs font-medium text-muted-foreground hover:underline"
          >
            ← Back to dashboard
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href={tabHref(admissionId, tab)}
              className="text-xs font-medium text-clinic-teal hover:underline"
            >
              Refresh
            </Link>
            <span className="text-xs text-muted-foreground">
              Updated {updatedAtLabel}
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {admission.patient.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {admission.patient.species} ·{" "}
              {admission.patient.breed || "Breed not specified"}
            </p>
            <p className="text-xs text-muted-foreground">
              Admission:{" "}
              {formatInTimeZone(
                admission.admissionDate,
                "Asia/Kolkata",
                "dd MMM yyyy, HH:mm"
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {admission.status}
            </span>
            {wardStyle && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  wardStyle.bg,
                  wardStyle.color
                )}
              >
                {wardStyle.label}
              </span>
            )}
            {conditionStyle && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  conditionStyle.bg,
                  conditionStyle.color
                )}
              >
                {conditionStyle.label}
              </span>
            )}
            {admission.cageNumber && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                Cage {admission.cageNumber}
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <p>Diagnosis: {admission.diagnosis || "Not set"}</p>
          <p>Chief complaint: {admission.chiefComplaint || "Not set"}</p>
          <p>Admitted by: {admission.admittedBy?.name ?? "Unknown"}</p>
          <p>Attending doctor: {admission.attendingDoctor || "Not assigned"}</p>
        </div>
      </section>

      <section className="overflow-x-auto rounded-xl border border-border bg-white p-2 shadow-sm">
        <div className="flex min-w-max gap-1">
          {MANAGEMENT_PATIENT_TABS.map((tabKey) => (
            <Link
              key={tabKey}
              href={tabHref(admissionId, tabKey)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wide",
                tab === tabKey
                  ? "bg-indigo-600 text-white"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {tabKey}
            </Link>
          ))}
        </div>
      </section>

      {tab === "overview" && (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">Active Med Plans</p>
              <p className="text-2xl font-semibold text-foreground">
                {activeTreatmentPlans.length}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">Overdue Med Slots</p>
              <p className="text-2xl font-semibold text-red-700">
                {overdueMeds.length}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">Overdue Feed Slots</p>
              <p className="text-2xl font-semibold text-orange-700">
                {overdueFeeds.length}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground">
                Latest Vitals
              </h2>
              {latestVital ? (
                <div className="mt-2 space-y-1 text-sm text-foreground">
                  <p>
                    {formatInTimeZone(
                      latestVital.recordedAt,
                      "Asia/Kolkata",
                      "dd MMM yyyy, HH:mm"
                    )}{" "}
                    by {latestVital.recordedBy.name}
                  </p>
                  <p className="text-muted-foreground">
                    Temp {latestVital.temperature ?? "-"}°C · HR{" "}
                    {latestVital.heartRate ?? "-"} · RR{" "}
                    {latestVital.respRate ?? "-"} · Pain{" "}
                    {latestVital.painScore ?? "-"}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  No vitals recorded yet.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground">
                Latest Clinical Note
              </h2>
              {latestNote ? (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-foreground">
                    {formatInTimeZone(
                      latestNote.recordedAt,
                      "Asia/Kolkata",
                      "dd MMM yyyy, HH:mm"
                    )}{" "}
                    by {latestNote.recordedBy.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {latestNote.content}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  No notes available.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {tab === "meds" && (
        <section className="space-y-3">
          {medsData.treatmentPlans.length === 0 &&
          medsData.fluidTherapies.length === 0 ? (
            <div className="rounded-xl border border-border bg-white p-4 text-sm text-muted-foreground shadow-sm">
              No active medication or IV fluid plans.
            </div>
          ) : (
            <>
              {medsData.treatmentPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-xl border border-border bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {plan.drugName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {plan.dose} · {plan.route} · {plan.frequency}
                      </p>
                    </div>
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                      ACTIVE
                    </span>
                  </div>

                  {plan.scheduledTimes.length > 0 && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {plan.scheduledTimes.map((slot) => {
                        const todayAdmin = plan.administrations.find(
                          (administration) => administration.scheduledTime === slot
                        );
                        const status = todayAdmin?.wasAdministered
                          ? "Given"
                          : todayAdmin?.wasSkipped
                            ? `Skipped${
                                todayAdmin.skipReason
                                  ? ` (${todayAdmin.skipReason})`
                                  : ""
                              }`
                            : "Pending";

                        return (
                          <div
                            key={`${plan.id}-${slot}`}
                            className="rounded-lg border border-border bg-slate-50 p-2"
                          >
                            <p className="text-xs font-medium text-foreground">
                              {slot}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {status}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              {medsData.fluidTherapies.length > 0 && (
                <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
                  <h2 className="text-sm font-semibold text-foreground">
                    Active IV Fluids
                  </h2>
                  <div className="mt-3 space-y-2">
                    {medsData.fluidTherapies.map((therapy) => (
                      <div
                        key={therapy.id}
                        className="rounded-lg border border-border bg-slate-50 p-3"
                      >
                        <p className="text-sm font-medium text-foreground">
                          {therapy.fluidType}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Rate: {therapy.rate}
                          {therapy.additives
                            ? ` · Additives: ${therapy.additives}`
                            : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Started:{" "}
                          {formatInTimeZone(
                            therapy.startTime,
                            "Asia/Kolkata",
                            "dd MMM yyyy, HH:mm"
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {tab === "food" && (
        <section className="space-y-3">
          {dietPlans.length === 0 ? (
            <div className="rounded-xl border border-border bg-white p-4 text-sm text-muted-foreground shadow-sm">
              No active diet plan.
            </div>
          ) : (
            dietPlans.map((plan) => (
              <div
                key={plan.id}
                className="rounded-xl border border-border bg-white p-4 shadow-sm"
              >
                <p className="text-sm font-semibold text-foreground">
                  {plan.dietType}
                </p>
                <p className="text-xs text-muted-foreground">
                  {plan.instructions || "No instructions"}
                </p>

                <div className="mt-3 space-y-2">
                  {plan.feedingSchedules.map((schedule) => {
                    const todayLog = schedule.feedingLogs[0] ?? null;
                    return (
                      <div
                        key={schedule.id}
                        className="rounded-lg border border-border bg-slate-50 p-3"
                      >
                        <p className="text-sm font-medium text-foreground">
                          {schedule.scheduledTime} · {schedule.foodType}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Portion: {schedule.portion}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Today: {todayLog ? todayLog.status : "PENDING"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {tab === "vitals" && (
        <section className="space-y-2">
          {vitals.length === 0 ? (
            <div className="rounded-xl border border-border bg-white p-4 text-sm text-muted-foreground shadow-sm">
              No vitals recorded.
            </div>
          ) : (
            vitals.map((vital) => (
              <div
                key={vital.id}
                className="rounded-xl border border-border bg-white p-4 shadow-sm"
              >
                <p className="text-xs text-muted-foreground">
                  {formatInTimeZone(
                    vital.recordedAt,
                    "Asia/Kolkata",
                    "dd MMM yyyy, HH:mm"
                  )}{" "}
                  by {vital.recordedBy.name}
                </p>
                <p className="mt-1 text-sm text-foreground">
                  Temp {vital.temperature ?? "-"}°C · HR{" "}
                  {vital.heartRate ?? "-"} · RR {vital.respRate ?? "-"} · Pain{" "}
                  {vital.painScore ?? "-"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Weight {vital.weight ?? "-"}kg · SpO2 {vital.spo2 ?? "-"} ·
                  CRT {vital.capillaryRefillTime ?? "-"}
                </p>
                {vital.notes && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {vital.notes}
                  </p>
                )}
              </div>
            ))
          )}
        </section>
      )}

      {tab === "notes" && (
        <section className="space-y-2">
          {notes.length === 0 ? (
            <div className="rounded-xl border border-border bg-white p-4 text-sm text-muted-foreground shadow-sm">
              No notes available.
            </div>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="rounded-xl border border-border bg-white p-4 shadow-sm"
              >
                <p className="text-xs text-muted-foreground">
                  {formatInTimeZone(
                    note.recordedAt,
                    "Asia/Kolkata",
                    "dd MMM yyyy, HH:mm"
                  )}{" "}
                  · {note.recordedBy.name} ({note.recordedBy.role})
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {note.category}
                </p>
                <p className="mt-1 text-sm text-foreground">{note.content}</p>
              </div>
            ))
          )}
        </section>
      )}

      {tab === "labs" && (
        <section className="space-y-2">
          {labResults.length === 0 ? (
            <div className="rounded-xl border border-border bg-white p-4 text-sm text-muted-foreground shadow-sm">
              No lab records.
            </div>
          ) : (
            labResults.map((lab) => (
              <div
                key={lab.id}
                className="rounded-xl border border-border bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {lab.testName}
                  </p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      lab.isAbnormal
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    )}
                  >
                    {lab.isAbnormal ? "ABNORMAL" : "NORMAL"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {lab.testType} ·{" "}
                  {formatInTimeZone(
                    lab.resultDate,
                    "Asia/Kolkata",
                    "dd MMM yyyy, HH:mm"
                  )}{" "}
                  · by {lab.createdBy.name}
                </p>
                <p className="mt-1 text-sm text-foreground">{lab.result}</p>
                {lab.notes && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {lab.notes}
                  </p>
                )}
                {lab.reportUrl && (
                  <a
                    href={lab.reportUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs text-clinic-teal hover:underline"
                  >
                    View report file
                  </a>
                )}
              </div>
            ))
          )}
        </section>
      )}

      {tab === "bath" && (
        <section className="space-y-2">
          {bathLogs.length === 0 ? (
            <div className="rounded-xl border border-border bg-white p-4 text-sm text-muted-foreground shadow-sm">
              No bath logs yet.
            </div>
          ) : (
            bathLogs.map((bath) => (
              <div
                key={bath.id}
                className="rounded-xl border border-border bg-white p-4 shadow-sm"
              >
                <p className="text-sm text-foreground">
                  {formatInTimeZone(
                    bath.bathedAt,
                    "Asia/Kolkata",
                    "dd MMM yyyy, HH:mm"
                  )}{" "}
                  by {bath.bathedBy.name}
                </p>
                {bath.notes && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {bath.notes}
                  </p>
                )}
              </div>
            ))
          )}
        </section>
      )}

      {tab === "isolation" && (
        <section className="space-y-3">
          {!isolationProtocol ? (
            <div className="rounded-xl border border-border bg-white p-4 text-sm text-muted-foreground shadow-sm">
              No isolation protocol for this admission.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-foreground">
                  {isolationProtocol.disease}
                </p>
                <p className="text-xs text-muted-foreground">
                  PCR: {isolationProtocol.pcrStatus}
                </p>
                <p className="text-xs text-muted-foreground">
                  Interval: {isolationProtocol.disinfectionInterval} · Cleared:{" "}
                  {isolationProtocol.isCleared ? "Yes" : "No"}
                </p>
                {isolationProtocol.biosecurityNotes && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {isolationProtocol.biosecurityNotes}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-foreground">
                  Disinfection Logs
                </h2>
                <div className="mt-2 space-y-2">
                  {isolationProtocol.disinfectionLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No disinfection logs.
                    </p>
                  ) : (
                    isolationProtocol.disinfectionLogs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-lg border border-border bg-slate-50 p-3"
                      >
                        <p className="text-sm text-foreground">
                          {formatInTimeZone(
                            log.performedAt,
                            "Asia/Kolkata",
                            "dd MMM yyyy, HH:mm"
                          )}{" "}
                          by {log.performedBy.name}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {tab === "media" && (
        <section className="space-y-4">
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">
              Patient Photos & Videos
            </h2>
            {patientMedia.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No media uploaded.
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {patientMedia.map((media) => (
                  <a
                    key={media.id}
                    href={driveMediaUrl(media.fileId)}
                    target="_blank"
                    rel="noreferrer"
                    className="overflow-hidden rounded-lg border border-border bg-slate-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={driveMediaUrl(media.fileId)}
                      alt={media.fileName}
                      className="h-28 w-full object-cover"
                    />
                    <div className="p-2">
                      <p className="truncate text-[11px] text-foreground">
                        {media.fileName}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {media.uploadedBy.name}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">
              Task Proof Attachments
            </h2>
            {proofs.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No proof attachments found.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {proofs.map((proof) => (
                  <div
                    key={proof.id}
                    className="rounded-lg border border-border bg-slate-50 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {proof.category}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {proof.fileName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatInTimeZone(
                            proof.createdAt,
                            "Asia/Kolkata",
                            "dd MMM yyyy, HH:mm"
                          )}{" "}
                          · {proof.uploadedBy.name}
                        </p>
                        {proof.skipReason && (
                          <p className="mt-1 text-xs text-amber-700">
                            Skip reason: {proof.skipReason}
                          </p>
                        )}
                      </div>
                      {proof.fileId !== "SKIPPED" && (
                        <a
                          href={driveMediaUrl(proof.fileId)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-clinic-teal hover:underline"
                        >
                          Open
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "logs" && (
        <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <LogsTab entries={logEntries} defaultFilter="all" />
        </section>
      )}
    </div>
  );
}
