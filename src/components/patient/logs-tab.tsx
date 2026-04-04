"use client";

import { useState, useMemo } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { formatTimeIST, getTodayIST } from "@/lib/date-utils";
import { NOTE_ROLE_COLORS, NOTE_CATEGORY_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { LogsAdmission } from "@/lib/logs-read-model";

const IST_ZONE = "Asia/Kolkata";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LogsTabProps {
  defaultFilter?: "today" | "all";
  admission: LogsAdmission;
}

interface LogEntry {
  time: Date;
  icon: string;
  description: string;
  by: string;
  roleColor?: string;
}

interface TimeBucket {
  key: string;
  dateLabel: string;
  hourLabel: string;
  sortTime: number;
  entries: LogEntry[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getISTDateStr(date: Date): string {
  return formatInTimeZone(date, IST_ZONE, "yyyy-MM-dd");
}

function getISTHour(date: Date): number {
  return parseInt(formatInTimeZone(date, IST_ZONE, "HH"), 10);
}

function buildVitalDescription(v: LogsTabProps["admission"]["vitalRecords"][number]): string {
  const parts: string[] = [];
  if (v.temperature != null) parts.push(`Temp ${v.temperature}°C`);
  if (v.heartRate != null) parts.push(`HR ${v.heartRate}`);
  if (v.respRate != null) parts.push(`RR ${v.respRate}`);
  if (v.painScore != null) parts.push(`Pain ${v.painScore}/10`);
  if (v.weight != null) parts.push(`Wt ${v.weight}kg`);
  return parts.length > 0 ? parts.join(", ") : "Vitals recorded";
}

const STATUS_LABELS: Record<string, string> = {
  EATEN: "Eaten",
  PARTIAL: "Partial",
  REFUSED: "Refused",
  PENDING: "Pending",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function LogsTab({ admission, defaultFilter = "today" }: LogsTabProps) {
  const [selectedDate, setSelectedDate] = useState<string>(
    defaultFilter === "all" ? "" : getTodayIST()
  );

  // Flatten all records into log entries
  const allEntries = useMemo<LogEntry[]>(() => {
    const entries: LogEntry[] = [];

    // Medication administrations
    for (const plan of admission.treatmentPlans) {
      for (const adm of plan.administrations) {
        if (!adm.wasAdministered && !adm.wasSkipped) continue;
        const time = adm.actualTime ?? adm.createdAt;
        const statusLabel = adm.wasAdministered
          ? "Given"
          : `Skipped${adm.skipReason ? `: ${adm.skipReason}` : ""}`;
        entries.push({
          time,
          icon: "💊",
          description: `${plan.drugName} ${plan.dose} ${plan.route} — ${statusLabel}`,
          by: adm.administeredBy?.name ?? "—",
        });
      }
    }

    // Vital records
    for (const v of admission.vitalRecords) {
      entries.push({
        time: v.recordedAt,
        icon: "🌡",
        description: buildVitalDescription(v),
        by: v.recordedBy?.name ?? "—",
      });
    }

    // Feeding logs (non-PENDING)
    for (const plan of admission.dietPlans) {
      for (const schedule of plan.feedingSchedules) {
        for (const log of schedule.feedingLogs) {
          if (log.status === "PENDING") continue;
          const statusLabel = STATUS_LABELS[log.status] ?? log.status;
          entries.push({
            time: log.createdAt,
            icon: "🍽",
            description: `${schedule.scheduledTime} ${schedule.foodType}: ${statusLabel}`,
            by: log.loggedBy?.name ?? "—",
          });
        }
      }
    }

    // Bath logs
    for (const bath of admission.bathLogs) {
      entries.push({
        time: bath.bathedAt,
        icon: "🛁",
        description: bath.notes ? `Bath given — ${bath.notes}` : "Bath given",
        by: bath.bathedBy?.name ?? "—",
      });
    }

    // Clinical notes
    for (const note of admission.clinicalNotes) {
      const categoryLabel = NOTE_CATEGORY_LABELS[note.category] ?? note.category;
      const content =
        note.content.length > 100
          ? note.content.slice(0, 100) + "…"
          : note.content;
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

    // Disinfection logs
    if (admission.isolationProtocol) {
      for (const log of admission.isolationProtocol.disinfectionLogs) {
        entries.push({
          time: log.performedAt,
          icon: "🧹",
          description: "Ward disinfection performed",
          by: log.performedBy?.name ?? "—",
        });
      }
    }

    // Fluid therapies — start events and rate changes and stop events
    for (const fluid of admission.fluidTherapies) {
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

    // Sort descending by time
    entries.sort((a, b) => b.time.getTime() - a.time.getTime());
    return entries;
  }, [admission]);

  // Filter to selected date (IST). Empty date = all history.
  const filteredEntries = useMemo(
    () =>
      selectedDate
        ? allEntries.filter((e) => getISTDateStr(e.time) === selectedDate)
        : allEntries,
    [allEntries, selectedDate]
  );

  // Group by IST date+hour (descending order — newest bucket first)
  const groupedByHour = useMemo<TimeBucket[]>(() => {
    const map = new Map<string, TimeBucket>();
    for (const entry of filteredEntries) {
      const dateKey = getISTDateStr(entry.time);
      const dateLabel = formatInTimeZone(entry.time, IST_ZONE, "dd MMM yyyy");
      const hour = getISTHour(entry.time);
      const hourLabel = `${String(hour).padStart(2, "0")}:00 – ${String((hour + 1) % 24).padStart(2, "0")}:00`;
      const key = `${dateKey}-${String(hour).padStart(2, "0")}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          dateLabel,
          hourLabel,
          sortTime: entry.time.getTime(),
          entries: [],
        });
      }

      const bucket = map.get(key)!;
      bucket.entries.push(entry);
      if (entry.time.getTime() > bucket.sortTime) {
        bucket.sortTime = entry.time.getTime();
      }
    }

    return Array.from(map.values()).sort((a, b) => b.sortTime - a.sortTime);
  }, [filteredEntries]);

  return (
    <div className="space-y-4">
      {/* Date picker + summary */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label
            htmlFor="logs-date"
            className="text-sm font-medium text-gray-700"
          >
            Date
          </label>
          <input
            id="logs-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-clinic-teal focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => setSelectedDate("")}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-medium border transition-colors",
              selectedDate === ""
                ? "border-clinic-teal bg-clinic-teal-light text-clinic-teal"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            )}
          >
            All history
          </button>
          <button
            type="button"
            onClick={() => setSelectedDate(getTodayIST())}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-medium border transition-colors",
              selectedDate === getTodayIST()
                ? "border-clinic-teal bg-clinic-teal-light text-clinic-teal"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            )}
          >
            Today
          </button>
        </div>
        {filteredEntries.length > 0 && (
          <span className="text-xs text-muted-foreground bg-gray-100 px-2.5 py-1 rounded-full">
            {filteredEntries.length} activit{filteredEntries.length === 1 ? "y" : "ies"}
          </span>
        )}
      </div>

      {/* Timeline */}
      {filteredEntries.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No activity logged for this date
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByHour.map((bucket) => {
            const headerLabel =
              selectedDate === ""
                ? `${bucket.dateLabel} · ${bucket.hourLabel}`
                : bucket.hourLabel;
            return (
              <div key={bucket.key}>
                {/* Hour header */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {headerLabel}
                  </span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>

                {/* Entries in this hour */}
                <div className="relative">
                  {/* Timeline vertical line */}
                  <div className="absolute left-[22px] top-0 bottom-0 w-px bg-gray-200" />

                  <div className="space-y-3">
                    {bucket.entries.map((entry, idx) => (
                      <div key={idx} className="relative flex gap-3 pl-11">
                        {/* Timeline dot */}
                        <div className="absolute left-[18px] top-2 w-2.5 h-2.5 rounded-full bg-white border-2 border-gray-300" />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2">
                            {/* Time */}
                            <span className="text-xs tabular-nums text-gray-400 shrink-0 pt-0.5 w-10">
                              {formatTimeIST(entry.time)}
                            </span>

                            {/* Icon + description */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-1.5">
                                <span className="text-base leading-tight shrink-0">
                                  {entry.icon}
                                </span>
                                <span className="text-sm leading-snug text-gray-800">
                                  {entry.description}
                                </span>
                              </div>
                              {entry.by && (
                                <p
                                  className={cn(
                                    "text-xs mt-0.5 ml-6",
                                    entry.roleColor ?? "text-gray-400"
                                  )}
                                >
                                  by {entry.by}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
