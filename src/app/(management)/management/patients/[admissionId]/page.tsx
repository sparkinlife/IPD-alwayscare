import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getManagementPatientPageShell,
  getManagementPatientTodayData,
  getManagementPatientMediaProofs,
} from "@/lib/management-patient-page-queries";
import { getPatientNotesData, getPatientLabsData, getPatientPhotosData } from "@/lib/patient-page-queries";
import { getLogsTimelineEntries } from "@/lib/logs-queries";
import { normalizeManagementPatientTab, getManagementPatientTabLoadPlan } from "@/lib/management-patient-page-data";
import { getTodayUTCDate, formatIST, getNowTimeIST } from "@/lib/date-utils";
import { TodayTab } from "@/components/management/today-tab";
import type { TodayTabProps } from "@/components/management/today-tab";
import { HistoryTab } from "@/components/management/history-tab";
import { MediaGallery } from "@/components/management/media-gallery";
import { differenceInDays } from "date-fns";
import { ArrowLeft } from "lucide-react";

const CONDITION_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  GUARDED: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  STABLE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  IMPROVING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  RECOVERED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

const TABS = [
  { key: "today", label: "Today" },
  { key: "history", label: "History" },
  { key: "media", label: "Media" },
] as const;

interface Props {
  params: Promise<{ admissionId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function ManagementPatientPage({ params, searchParams }: Props) {
  const { admissionId } = await params;
  const query = await searchParams;
  const tab = normalizeManagementPatientTab(query.tab);
  const loadPlan = getManagementPatientTabLoadPlan(tab);
  const today = getTodayUTCDate();
  const shouldLoadProofs = loadPlan.history || loadPlan.media;

  const shell = await getManagementPatientPageShell(admissionId);
  if (!shell || shell.patient.deletedAt) notFound();

  const dayNum = differenceInDays(new Date(), shell.admissionDate) + 1;

  const [todayData, notes, labs, logEntries, patientPhotos, proofs] = await Promise.all([
    loadPlan.today ? getManagementPatientTodayData(admissionId, today) : Promise.resolve(null),
    loadPlan.history ? getPatientNotesData(admissionId) : Promise.resolve([]),
    loadPlan.history ? getPatientLabsData(admissionId) : Promise.resolve([]),
    loadPlan.history ? getLogsTimelineEntries(admissionId) : Promise.resolve([]),
    loadPlan.media ? getPatientPhotosData(shell.patientId) : Promise.resolve([]),
    shouldLoadProofs ? getManagementPatientMediaProofs(admissionId) : Promise.resolve([]),
  ]);
  const proofAttachments = proofs.map((proof) => ({
    fileId: proof.fileId,
    fileName: proof.fileName,
    category: proof.category,
    uploadedBy: proof.uploadedBy.name,
    createdAt: proof.createdAt,
    isSkipped: proof.fileId === "SKIPPED",
    skipReason: proof.skipReason,
  }));

  // Build Today tab props
  let todayProps: TodayTabProps | null = null;
  if (todayData?.admission) {
    const a = todayData.admission;
    const proofMap = todayData.proofByRecordId;

    const toMin = (hhmm: string) => {
      const [h, m] = hhmm.split(":").map(Number);
      return h * 60 + m;
    };
    const nowMinutes = toMin(getNowTimeIST());

    const meds = a.treatmentPlans.flatMap((plan) =>
      (plan.scheduledTimes as string[]).map((time) => {
        const admin = plan.administrations.find((adm) => adm.scheduledTime === time);
        return {
          time,
          drugName: plan.drugName,
          dose: plan.dose,
          route: plan.route,
          wasAdministered: admin?.wasAdministered ?? false,
          wasSkipped: admin?.wasSkipped ?? false,
          skipReason: admin?.skipReason ?? null,
          administeredBy: admin?.administeredBy?.name ?? null,
          actualTime: admin?.actualTime ?? null,
          proof: admin ? proofMap.get(admin.id) ?? null : null,
        };
      }),
    ).sort((a, b) => a.time.localeCompare(b.time));

    const feeds = a.dietPlans.flatMap((diet) =>
      diet.feedingSchedules.map((schedule) => {
        const log = schedule.feedingLogs[0];
        return {
          time: schedule.scheduledTime,
          foodType: schedule.foodType,
          portion: schedule.portion ?? "",
          status: log?.status ?? null,
          amountConsumed: log?.amountConsumed ?? null,
          loggedBy: log?.loggedBy?.name ?? null,
          proof: log ? proofMap.get(log.id) ?? null : null,
        };
      }),
    ).sort((a, b) => a.time.localeCompare(b.time));

    todayProps = {
      meds,
      medsGiven: meds.filter((m) => (m.wasAdministered || m.wasSkipped) && toMin(m.time) <= nowMinutes).length,
      medsTotal: meds.filter((m) => toMin(m.time) <= nowMinutes).length,
      feeds,
      feedsLogged: feeds.filter((f) => f.status && f.status !== "PENDING").length,
      feedsTotal: feeds.length,
      latestVitals: a.vitalRecords[0]
        ? {
            temperature: a.vitalRecords[0].temperature,
            heartRate: a.vitalRecords[0].heartRate,
            respRate: a.vitalRecords[0].respRate,
            painScore: a.vitalRecords[0].painScore,
            spo2: a.vitalRecords[0].spo2 ?? null,
            weight: a.vitalRecords[0].weight ?? null,
            recordedBy: a.vitalRecords[0].recordedBy.name,
            recordedAt: a.vitalRecords[0].recordedAt,
          }
        : null,
      bathLastDate: a.bathLogs[0]?.bathedAt ?? null,
      isolation: a.isolationProtocol
        ? {
            disease: a.isolationProtocol.disease,
            ppeRequired: a.isolationProtocol.ppeRequired as string[],
            disinfectant: a.isolationProtocol.disinfectant,
            disinfectionInterval: a.isolationProtocol.disinfectionInterval,
            lastDisinfection: a.isolationProtocol.disinfectionLogs[0]?.performedAt ?? null,
          }
        : null,
      fluidTherapies: a.fluidTherapies,
      patientName: shell.patient.name,
    };
  }

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b space-y-1">
        <Link href="/management" className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>
        <h1 className="text-lg font-bold">{shell.patient.name}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {shell.condition && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CONDITION_STYLES[shell.condition] ?? "bg-gray-100"}`}>
              {shell.condition}
            </span>
          )}
          {shell.ward && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted font-medium">
              {shell.ward} · {shell.cageNumber}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">Day {dayNum}</span>
        </div>
        <p className="text-sm text-muted-foreground">{shell.diagnosis}</p>
        <p className="text-xs text-muted-foreground">
          {shell.attendingDoctor} · Admitted {formatIST(shell.admissionDate)}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b px-4">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/management/patients/${admissionId}?tab=${t.key}`}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Tab Content */}
      <div className="px-4 pt-4">
        {tab === "today" && todayProps && <TodayTab {...todayProps} />}
        {tab === "today" && !todayProps && (
          <p className="text-sm text-muted-foreground py-8 text-center">No data available</p>
        )}
        {tab === "history" && (
          <HistoryTab
            notes={notes}
            labs={labs}
            logEntries={logEntries}
            proofAttachments={proofAttachments}
          />
        )}
        {tab === "media" && (
          <MediaGallery
            patientPhotos={patientPhotos}
            proofAttachments={proofAttachments}
            patientName={shell.patient.name}
          />
        )}
      </div>
    </div>
  );
}
