import { formatInTimeZone } from "date-fns-tz";
import type { LogsTimelineEntry } from "@/lib/logs-read-model";

const IST_ZONE = "Asia/Kolkata";

export interface ManagementHistoryLabRecord {
  id: string;
  testName: string;
  testType: string;
  result: string;
  isAbnormal: boolean;
  resultDate: Date | null;
  notes: string | null;
}

export interface ManagementHistoryProofAttachment {
  fileId: string;
  fileName: string;
  category: string;
  uploadedBy: string;
  createdAt: Date;
  isSkipped: boolean;
  skipReason: string | null;
}

export interface ManagementHistoryStreamMedia {
  fileId: string;
  fileName: string;
  categoryLabel: string;
  isSkipped: boolean;
  skipReason: string | null;
}

export interface ManagementHistoryStreamItem {
  key: string;
  time: Date | null;
  timeLabel: string;
  icon: string;
  kindLabel: string;
  tone: "default" | "success" | "warning" | "note";
  title: string;
  description: string | null;
  meta: string | null;
  media?: ManagementHistoryStreamMedia | null;
}

export interface ManagementHistoryDaySection {
  key: string;
  label: string;
  dateLabel: string;
  items: ManagementHistoryStreamItem[];
}

interface BuildManagementHistoryInput {
  labs: ManagementHistoryLabRecord[];
  logEntries: LogsTimelineEntry[];
  proofAttachments?: ManagementHistoryProofAttachment[];
}

function getISTDateKey(date: Date): string {
  return formatInTimeZone(date, IST_ZONE, "yyyy-MM-dd");
}

function getSectionLabel(dateKey: string, now: Date): string {
  const todayKey = getISTDateKey(now);
  if (dateKey === todayKey) return "Today";

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (dateKey === getISTDateKey(yesterday)) return "Yesterday";

  return formatInTimeZone(new Date(`${dateKey}T00:00:00+05:30`), IST_ZONE, "dd MMM yyyy");
}

function getActivityKind(icon: string): Pick<ManagementHistoryStreamItem, "kindLabel" | "tone"> {
  switch (icon) {
    case "💊":
      return { kindLabel: "Medication", tone: "success" };
    case "🍽":
      return { kindLabel: "Feeding", tone: "success" };
    case "🌡":
      return { kindLabel: "Vitals", tone: "default" };
    case "📝":
      return { kindLabel: "Note", tone: "note" };
    case "🧹":
      return { kindLabel: "Disinfection", tone: "warning" };
    case "🛁":
      return { kindLabel: "Bath", tone: "default" };
    case "💧":
    case "⏹":
      return { kindLabel: "Fluid", tone: "default" };
    default:
      return { kindLabel: "Activity", tone: "default" };
  }
}

function getProofKind(category: string): {
  categoryLabel: string;
  kindLabel: string;
  tone: ManagementHistoryStreamItem["tone"];
} {
  switch (category.toUpperCase()) {
    case "MEDS":
      return { categoryLabel: "Medication", kindLabel: "Medication Proof", tone: "success" };
    case "FOOD":
      return { categoryLabel: "Feeding", kindLabel: "Feeding Proof", tone: "success" };
    case "VITALS":
      return { categoryLabel: "Vitals", kindLabel: "Vitals Proof", tone: "default" };
    case "BATH":
      return { categoryLabel: "Bath", kindLabel: "Bath Proof", tone: "default" };
    case "DISINFECTION":
      return { categoryLabel: "Disinfection", kindLabel: "Disinfection Proof", tone: "warning" };
    case "PROCEDURE":
      return { categoryLabel: "Procedure", kindLabel: "Procedure Proof", tone: "default" };
    case "LAB":
    case "LABS":
      return { categoryLabel: "Lab", kindLabel: "Lab Proof", tone: "warning" };
    default:
      return { categoryLabel: "Proof", kindLabel: "Proof", tone: "default" };
  }
}

export function buildManagementHistoryDaySections(
  input: BuildManagementHistoryInput,
  now: Date = new Date()
): ManagementHistoryDaySection[] {
  const activityItems: ManagementHistoryStreamItem[] = input.logEntries.map((entry, index) => {
    const { kindLabel, tone } = getActivityKind(entry.icon);

    return {
      key: `activity-${entry.time.toISOString()}-${index}`,
      time: entry.time,
      timeLabel: formatInTimeZone(entry.time, IST_ZONE, "HH:mm"),
      icon: entry.icon,
      kindLabel,
      tone,
      title: entry.description,
      description: null,
      meta: entry.by && entry.by !== "—" ? `By ${entry.by}` : null,
      media: null,
    };
  });

  const labItems: ManagementHistoryStreamItem[] = input.labs.map((lab) => {
    const time = lab.resultDate;
    const metaParts = [lab.isAbnormal ? "Abnormal" : "Normal", lab.notes ?? ""].filter(Boolean);

    return {
      key: `lab-${lab.id}`,
      time,
      timeLabel: time ? formatInTimeZone(time, IST_ZONE, "HH:mm") : "--:--",
      icon: "🧪",
      kindLabel: "Lab",
      tone: lab.isAbnormal ? "warning" : "success",
      title: lab.testName,
      description: lab.result,
      meta: metaParts.length > 0 ? metaParts.join(" · ") : null,
      media: null,
    };
  });

  const proofItems: ManagementHistoryStreamItem[] = (input.proofAttachments ?? []).map(
    (proof, index) => {
      const { categoryLabel, kindLabel, tone } = getProofKind(proof.category);

      return {
        key: `proof-${proof.fileId}-${proof.createdAt.toISOString()}-${index}`,
        time: proof.createdAt,
        timeLabel: formatInTimeZone(proof.createdAt, IST_ZONE, "HH:mm"),
        icon: "📷",
        kindLabel,
        tone,
        title: proof.isSkipped ? "Photo skipped" : "Photo uploaded",
        description: proof.isSkipped ? proof.skipReason : proof.fileName,
        meta: proof.uploadedBy ? `By ${proof.uploadedBy}` : null,
        media: {
          fileId: proof.fileId,
          fileName: proof.fileName,
          categoryLabel,
          isSkipped: proof.isSkipped,
          skipReason: proof.skipReason,
        },
      };
    }
  );

  const grouped = new Map<string, ManagementHistoryStreamItem[]>();

  for (const item of [...activityItems, ...labItems, ...proofItems]) {
    const dateKey = item.time ? getISTDateKey(item.time) : "undated";
    const existing = grouped.get(dateKey) ?? [];
    existing.push(item);
    grouped.set(dateKey, existing);
  }

  return Array.from(grouped.entries())
    .sort(([leftKey], [rightKey]) => {
      if (leftKey === "undated") return 1;
      if (rightKey === "undated") return -1;
      return rightKey.localeCompare(leftKey);
    })
    .map(([dateKey, items]) => ({
      key: dateKey,
      label: dateKey === "undated" ? "Undated" : getSectionLabel(dateKey, now),
      dateLabel:
        dateKey === "undated"
          ? "Result date unavailable"
          : formatInTimeZone(new Date(`${dateKey}T00:00:00+05:30`), IST_ZONE, "dd MMM yyyy"),
      items: items.sort((left, right) => {
        const leftTime = left.time?.getTime() ?? 0;
        const rightTime = right.time?.getTime() ?? 0;
        return rightTime - leftTime;
      }),
    }));
}
