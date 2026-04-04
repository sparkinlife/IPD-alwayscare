import { NOTE_CATEGORY_LABELS, NOTE_ROLE_COLORS } from "@/lib/constants";

export interface LogsTimelineEntry {
  time: Date;
  icon: string;
  description: string;
  by: string;
  roleColor?: string;
}

export interface LogsTimelineData {
  medicationAdministrations: Array<{
    scheduledTime: string;
    wasAdministered: boolean;
    wasSkipped: boolean;
    skipReason: string | null;
    actualTime: Date | null;
    createdAt: Date;
    administeredBy: { name: string } | null;
    treatmentPlan: {
      drugName: string;
      dose: string;
      route: string;
    };
  }>;
  vitalRecords: Array<{
    recordedAt: Date;
    temperature: number | null;
    heartRate: number | null;
    respRate: number | null;
    painScore: number | null;
    weight: number | null;
    recordedBy: { name: string } | null;
  }>;
  feedingLogs: Array<{
    status: string;
    createdAt: Date;
    loggedBy: { name: string } | null;
    feedingSchedule: {
      scheduledTime: string;
      foodType: string;
    };
  }>;
  bathLogs: Array<{
    bathedAt: Date;
    bathedBy: { name: string } | null;
    notes: string | null;
  }>;
  clinicalNotes: Array<{
    recordedAt: Date;
    category: string;
    content: string;
    recordedBy: { name: string; role: string } | null;
  }>;
  disinfectionLogs: Array<{
    performedAt: Date;
    performedBy: { name: string } | null;
  }>;
  fluidTherapies: Array<{
    fluidType: string;
    rate: string;
    startTime: Date;
    endTime: Date | null;
    createdBy: { name: string } | null;
    rateChanges: Array<{
      oldRate: string;
      newRate: string;
      changedAt: Date;
      changedBy: { name: string } | null;
      reason: string | null;
    }>;
  }>;
}

function buildVitalDescription(vital: LogsTimelineData["vitalRecords"][number]): string {
  const parts: string[] = [];
  if (vital.temperature != null) parts.push(`Temp ${vital.temperature}°C`);
  if (vital.heartRate != null) parts.push(`HR ${vital.heartRate}`);
  if (vital.respRate != null) parts.push(`RR ${vital.respRate}`);
  if (vital.painScore != null) parts.push(`Pain ${vital.painScore}/10`);
  if (vital.weight != null) parts.push(`Wt ${vital.weight}kg`);
  return parts.length > 0 ? parts.join(", ") : "Vitals recorded";
}

const STATUS_LABELS: Record<string, string> = {
  EATEN: "Eaten",
  PARTIAL: "Partial",
  REFUSED: "Refused",
  PENDING: "Pending",
};

export function buildLogsTimelineEntries(data: LogsTimelineData): LogsTimelineEntry[] {
  const entries: LogsTimelineEntry[] = [];

  for (const administration of data.medicationAdministrations) {
    if (!administration.wasAdministered && !administration.wasSkipped) {
      continue;
    }

    const time = administration.actualTime ?? administration.createdAt;
    const statusLabel = administration.wasAdministered
      ? "Given"
      : `Skipped${administration.skipReason ? `: ${administration.skipReason}` : ""}`;

    entries.push({
      time,
      icon: "💊",
      description: `${administration.treatmentPlan.drugName} ${administration.treatmentPlan.dose} ${administration.treatmentPlan.route} — ${statusLabel}`,
      by: administration.administeredBy?.name ?? "—",
    });
  }

  for (const vital of data.vitalRecords) {
    entries.push({
      time: vital.recordedAt,
      icon: "🌡",
      description: buildVitalDescription(vital),
      by: vital.recordedBy?.name ?? "—",
    });
  }

  for (const feedingLog of data.feedingLogs) {
    if (feedingLog.status === "PENDING") continue;

    const statusLabel = STATUS_LABELS[feedingLog.status] ?? feedingLog.status;
    entries.push({
      time: feedingLog.createdAt,
      icon: "🍽",
      description: `${feedingLog.feedingSchedule.scheduledTime} ${feedingLog.feedingSchedule.foodType}: ${statusLabel}`,
      by: feedingLog.loggedBy?.name ?? "—",
    });
  }

  for (const bath of data.bathLogs) {
    entries.push({
      time: bath.bathedAt,
      icon: "🛁",
      description: bath.notes ? `Bath given — ${bath.notes}` : "Bath given",
      by: bath.bathedBy?.name ?? "—",
    });
  }

  for (const note of data.clinicalNotes) {
    const categoryLabel = NOTE_CATEGORY_LABELS[note.category] ?? note.category;
    const content =
      note.content.length > 100 ? `${note.content.slice(0, 100)}…` : note.content;
    const roleColor =
      NOTE_ROLE_COLORS[note.recordedBy?.role ?? ""] ?? "text-gray-500";

    entries.push({
      time: note.recordedAt,
      icon: "📝",
      description: `[${categoryLabel}] ${content}`,
      by: note.recordedBy?.name ?? "—",
      roleColor,
    });
  }

  for (const disinfectionLog of data.disinfectionLogs) {
    entries.push({
      time: disinfectionLog.performedAt,
      icon: "🧹",
      description: "Ward disinfection performed",
      by: disinfectionLog.performedBy?.name ?? "—",
    });
  }

  for (const fluid of data.fluidTherapies) {
    entries.push({
      time: fluid.startTime,
      icon: "💧",
      description: `IV Fluid started: ${fluid.fluidType} @ ${fluid.rate}`,
      by: fluid.createdBy?.name ?? "—",
    });

    if (fluid.endTime) {
      entries.push({
        time: fluid.endTime,
        icon: "⏹",
        description: `IV Fluid stopped: ${fluid.fluidType}`,
        by: fluid.createdBy?.name ?? "—",
      });
    }

    for (const change of fluid.rateChanges) {
      const reasonPart = change.reason ? ` (${change.reason})` : "";
      entries.push({
        time: change.changedAt,
        icon: "💧",
        description: `IV rate changed: ${change.oldRate} → ${change.newRate}${reasonPart}`,
        by: change.changedBy?.name ?? "—",
      });
    }
  }

  entries.sort((left, right) => right.time.getTime() - left.time.getTime());
  return entries;
}
