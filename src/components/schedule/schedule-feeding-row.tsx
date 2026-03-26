"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { WARD_CONFIG } from "@/lib/constants";
import { FeedingLogSheet } from "@/components/patient/feeding-log-sheet";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedingLog {
  id: string;
  date: Date;
  status: string;
  amountConsumed: string | null;
  notes: string | null;
}

interface ScheduleFeedingRowProps {
  feedingScheduleId: string;
  scheduledTime: string;
  foodType: string;
  portion: string;
  todayLog?: FeedingLog | null;
  patientName: string;
  ward: string;
  cageNumber: string | null;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; row: string; text: string }
> = {
  EATEN: {
    label: "Eaten",
    dot: "bg-green-500",
    row: "bg-green-50 border-green-100",
    text: "text-green-700",
  },
  PARTIAL: {
    label: "Partial",
    dot: "bg-yellow-400",
    row: "bg-yellow-50 border-yellow-100",
    text: "text-yellow-700",
  },
  REFUSED: {
    label: "Refused",
    dot: "bg-red-500",
    row: "bg-red-50 border-red-100",
    text: "text-red-700",
  },
  SKIPPED: {
    label: "Skipped",
    dot: "bg-gray-300",
    row: "bg-gray-50 border-gray-200",
    text: "text-gray-400",
  },
  PENDING: {
    label: "Pending",
    dot: "bg-gray-200",
    row: "bg-white border-gray-100",
    text: "text-gray-500",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ScheduleFeedingRow({
  feedingScheduleId,
  scheduledTime,
  foodType,
  portion,
  todayLog,
  patientName,
  ward,
  cageNumber,
}: ScheduleFeedingRowProps) {
  const [logOpen, setLogOpen] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);

  const baseStatus = todayLog?.status ?? "PENDING";
  const displayStatus = optimisticStatus ?? baseStatus;
  const displayConfig = STATUS_CONFIG[displayStatus] ?? STATUS_CONFIG.PENDING;
  const wardConfig = WARD_CONFIG[ward] ?? WARD_CONFIG.GENERAL;

  function handleLogged(newStatus: string) {
    setOptimisticStatus(newStatus);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setLogOpen(true)}
        className={cn(
          "flex w-full items-start gap-3 rounded-lg border px-3 py-3 mb-2 text-left transition-colors active:opacity-80",
          displayConfig.row
        )}
      >
        {/* Status dot */}
        <span
          className={cn(
            "mt-1 h-3 w-3 flex-shrink-0 rounded-full",
            displayConfig.dot
          )}
        />

        {/* Info */}
        <div className="min-w-0 flex-1">
          {/* Patient name + ward badge */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs font-semibold text-gray-700 truncate">
              {patientName}
            </span>
            {cageNumber && (
              <span className="text-xs text-gray-400 flex-shrink-0">
                · {cageNumber}
              </span>
            )}
            <span
              className={cn(
                "ml-auto flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                wardConfig.bg,
                wardConfig.color
              )}
            >
              {wardConfig.label}
            </span>
          </div>

          <p className="text-sm font-medium text-gray-900">{foodType}</p>
          <p className="text-xs text-gray-500">{portion}</p>
        </div>

        {/* Status label */}
        <span className={cn("flex-shrink-0 text-xs font-medium self-center", displayConfig.text)}>
          {displayConfig.label}
        </span>
      </button>

      <FeedingLogSheet
        open={logOpen}
        onOpenChange={setLogOpen}
        feedingScheduleId={feedingScheduleId}
        scheduledTime={scheduledTime}
        foodType={foodType}
        portion={portion}
        currentStatus={displayStatus}
        onLogged={handleLogged}
      />
    </>
  );
}
