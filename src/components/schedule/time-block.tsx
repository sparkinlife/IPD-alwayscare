import { cn } from "@/lib/utils";
import { isOverdueByMinutes } from "@/lib/date-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimeBlockProps {
  hour: string; // "08:00" format
  children: React.ReactNode;
  taskCount: number;
  doneCount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getBlockStatus(
  hour: string,
  taskCount: number,
  doneCount: number
): "completed" | "overdue" | "current" | "upcoming" {
  if (taskCount === 0) return "upcoming";

  const allDone = doneCount === taskCount;
  if (allDone) return "completed";

  // Check if any task in this hour is overdue (30+ min past)
  const isHourOverdue = isOverdueByMinutes(hour, 30);
  if (isHourOverdue) return "overdue";

  // Check if current hour (within ±60 min)
  const now = new Date();
  const [hh, mm] = hour.split(":").map(Number);
  const hourMinutes = hh * 60 + mm;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (Math.abs(hourMinutes - nowMinutes) <= 60) return "current";

  return "upcoming";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TimeBlock({ hour, children, taskCount, doneCount }: TimeBlockProps) {
  if (taskCount === 0) return null;

  const status = getBlockStatus(hour, taskCount, doneCount);

  const statusConfig = {
    completed: {
      label: "Completed",
      labelClass: "text-green-600 bg-green-50",
      headerClass: "border-green-100 bg-green-50/40",
      timeClass: "text-green-800",
    },
    overdue: {
      label: "OVERDUE",
      labelClass: "text-red-600 bg-red-50 font-bold",
      headerClass: "border-red-100 bg-red-50/40",
      timeClass: "text-red-700 font-bold",
    },
    current: {
      label: "Now",
      labelClass: "text-blue-600 bg-blue-50 font-semibold",
      headerClass: "border-blue-100 bg-blue-50/40",
      timeClass: "text-blue-800 font-bold",
    },
    upcoming: {
      label: "Upcoming",
      labelClass: "text-gray-400 bg-gray-50",
      headerClass: "border-gray-100 bg-gray-50/10",
      timeClass: "text-gray-500",
    },
  } as const;

  const config = statusConfig[status];

  return (
    <div className="mb-4">
      {/* Hour header */}
      <div
        className={cn(
          "flex items-center justify-between rounded-t-lg border-x border-t px-3 py-2",
          config.headerClass
        )}
      >
        <span className={cn("text-sm font-semibold", config.timeClass)}>
          {hour}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs",
            config.labelClass
          )}
        >
          {config.label}
        </span>
      </div>

      {/* Tasks */}
      <div className="rounded-b-lg border-x border-b border-gray-100 px-3 py-2">
        {children}
      </div>
    </div>
  );
}
