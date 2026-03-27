"use client";

import { useState } from "react";
import { Plus, ChevronDown, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getTodayIST } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { createDietPlan, deleteFeeding } from "@/actions/feeding";
import { FeedingLogSheet } from "./feeding-log-sheet";
import { ActionsMenu } from "@/components/ui/actions-menu";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeedingLog {
  id: string;
  date: Date;
  status: string;
  amountConsumed: string | null;
  notes: string | null;
}

interface FeedingSchedule {
  id: string;
  scheduledTime: string;
  foodType: string;
  portion: string;
  feedingLogs: FeedingLog[];
}

interface DietPlan {
  id: string;
  dietType: string;
  instructions: string | null;
  isActive: boolean;
  createdAt: Date;
  createdBy: { name: string };
  feedingSchedules: FeedingSchedule[];
}

interface FoodTabProps {
  admissionId: string;
  dietPlans: DietPlan[];
  isDoctor: boolean;
  patientName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function getTodayLog(schedule: FeedingSchedule, today: string): FeedingLog | null {
  return (
    schedule.feedingLogs.find((log) => {
      const logDate =
        log.date instanceof Date
          ? log.date.toISOString().slice(0, 10)
          : String(log.date).slice(0, 10);
      return logDate === today;
    }) ?? null
  );
}

// ─── Diet Plan Form ────────────────────────────────────────────────────────────

interface ScheduleEntry {
  scheduledTime: string;
  foodType: string;
  portion: string;
}

function DietPlanSheet({
  admissionId,
  triggerLabel,
  triggerVariant = "outline",
  triggerClassName,
}: {
  admissionId: string;
  triggerLabel: React.ReactNode;
  triggerVariant?: "outline" | "default";
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dietType, setDietType] = useState("");
  const [instructions, setInstructions] = useState("");
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([
    { scheduledTime: "", foodType: "", portion: "" },
  ]);

  const DIET_SUGGESTIONS = [
    "Regular",
    "High Protein",
    "Low Fat",
    "Renal Diet",
    "Bland Diet",
    "Liquid Diet",
    "Soft Diet",
    "NPO (Nothing by Mouth)",
    "Force Feed",
  ];

  function resetForm() {
    setDietType("");
    setInstructions("");
    setSchedules([{ scheduledTime: "", foodType: "", portion: "" }]);
  }

  function addSchedule() {
    setSchedules((prev) => [...prev, { scheduledTime: "", foodType: "", portion: "" }]);
  }

  function removeSchedule(index: number) {
    setSchedules((prev) => prev.filter((_, i) => i !== index));
  }

  function updateSchedule(index: number, field: keyof ScheduleEntry, value: string) {
    setSchedules((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dietType) {
      toast.error("Diet type is required");
      return;
    }

    const validSchedules = schedules.filter(
      (s) => s.scheduledTime && s.foodType && s.portion
    );

    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("dietType", dietType);
      if (instructions) formData.set("instructions", instructions);
      formData.set("schedules", JSON.stringify(validSchedules));

      const result = await createDietPlan(admissionId, formData);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Diet plan created");
        resetForm();
        setOpen(false);
      }
    } catch {
      toast.error("Failed to create diet plan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <SheetTrigger
        render={
          <Button
            variant={triggerVariant}
            size="sm"
            className={triggerClassName}
          />
        }
      >
        {triggerLabel}
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8 max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create Diet Plan</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 px-1">
          {/* Diet Type */}
          <div className="space-y-1.5">
            <Label htmlFor="dietType">Diet Type *</Label>
            <Input
              id="dietType"
              list="diet-suggestions"
              placeholder="e.g. High Protein"
              value={dietType}
              onChange={(e) => setDietType(e.target.value)}
              required
            />
            <datalist id="diet-suggestions">
              {DIET_SUGGESTIONS.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>

          {/* Instructions */}
          <div className="space-y-1.5">
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea
              id="instructions"
              rows={2}
              placeholder="Feeding instructions, allergies, special notes..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>

          {/* Feeding Schedules */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Feeding Schedules</Label>
              <button
                type="button"
                onClick={addSchedule}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
              >
                <Plus className="h-3 w-3" />
                Add time
              </button>
            </div>

            {schedules.map((schedule, index) => (
              <div
                key={index}
                className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">
                    Schedule {index + 1}
                  </span>
                  {schedules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSchedule(index)}
                      className="text-gray-400 hover:text-red-500"
                      aria-label="Remove schedule"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor={`time-${index}`} className="text-xs">
                      Time
                    </Label>
                    <Input
                      id={`time-${index}`}
                      type="time"
                      value={schedule.scheduledTime}
                      onChange={(e) => updateSchedule(index, "scheduledTime", e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`food-${index}`} className="text-xs">
                      Food
                    </Label>
                    <Input
                      id={`food-${index}`}
                      placeholder="e.g. Kibble"
                      value={schedule.foodType}
                      onChange={(e) => updateSchedule(index, "foodType", e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`portion-${index}`} className="text-xs">
                      Portion
                    </Label>
                    <Input
                      id={`portion-${index}`}
                      placeholder="e.g. 100g"
                      value={schedule.portion}
                      onChange={(e) => updateSchedule(index, "portion", e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Creating..." : "Create Plan"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Feeding Row ──────────────────────────────────────────────────────────────

function FeedingRow({
  schedule,
  today,
  patientName,
}: {
  schedule: FeedingSchedule;
  today: string;
  patientName?: string;
}) {
  const todayLog = getTodayLog(schedule, today);
  const status = todayLog?.status ?? "PENDING";
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;

  const [logOpen, setLogOpen] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);

  const displayStatus = optimisticStatus ?? status;
  const displayConfig = STATUS_CONFIG[displayStatus] ?? STATUS_CONFIG.PENDING;

  function handleLogged(newStatus: string) {
    setOptimisticStatus(newStatus);
  }

  const isDone = displayStatus === "EATEN" || displayStatus === "SKIPPED";

  return (
    <>
      <button
        type="button"
        onClick={() => setLogOpen(true)}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg border px-3 py-3 mb-2 text-left transition-colors active:opacity-80",
          displayConfig.row
        )}
      >
        {/* Status dot */}
        <span
          className={cn(
            "h-3 w-3 flex-shrink-0 rounded-full",
            displayConfig.dot
          )}
        />

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm font-medium",
              isDone ? "text-gray-500" : "text-gray-900"
            )}
          >
            {schedule.foodType}
          </p>
          <p className="text-xs text-gray-500">
            {schedule.scheduledTime} · {schedule.portion}
          </p>
        </div>

        {/* Status label */}
        <span className={cn("flex-shrink-0 text-xs font-medium", displayConfig.text)}>
          {displayConfig.label}
        </span>
      </button>

      <FeedingLogSheet
        open={logOpen}
        onOpenChange={setLogOpen}
        feedingScheduleId={schedule.id}
        scheduledTime={schedule.scheduledTime}
        foodType={schedule.foodType}
        portion={schedule.portion}
        currentStatus={displayStatus}
        onLogged={handleLogged}
        patientName={patientName}
      />
    </>
  );
}

// ─── Feeding History ──────────────────────────────────────────────────────────

function FeedingHistory({ dietPlans, isDoctor }: { dietPlans: DietPlan[]; isDoctor: boolean }) {
  const [open, setOpen] = useState(false);

  const today = getTodayIST();

  // Collect all logs from all diet plans, excluding today
  const pastLogs: Array<{
    id: string;
    date: string;
    foodType: string;
    scheduledTime: string;
    status: string;
    amountConsumed: string | null;
    notes: string | null;
  }> = [];

  for (const plan of dietPlans) {
    for (const schedule of plan.feedingSchedules) {
      for (const log of schedule.feedingLogs) {
        const logDate =
          log.date instanceof Date
            ? log.date.toISOString().slice(0, 10)
            : String(log.date).slice(0, 10);

        // Only last 7 days, excluding today
        if (logDate < today) {
          const cutoff = new Date(today);
          cutoff.setDate(cutoff.getDate() - 7);
          const cutoffStr = cutoff.toISOString().slice(0, 10);
          if (logDate >= cutoffStr) {
            pastLogs.push({
              id: log.id,
              date: logDate,
              foodType: schedule.foodType,
              scheduledTime: schedule.scheduledTime,
              status: log.status,
              amountConsumed: log.amountConsumed,
              notes: log.notes,
            });
          }
        }
      }
    }
  }

  async function handleDeleteFeeding(logId: string) {
    try {
      const result = await deleteFeeding(logId);
      if (result && "error" in result && result.error) toast.error(result.error);
      else toast.success("Feeding log deleted");
    } catch {
      toast.error("Failed to delete feeding log");
    }
  }

  pastLogs.sort((a, b) => b.date.localeCompare(a.date) || a.scheduledTime.localeCompare(b.scheduledTime));

  if (pastLogs.length === 0) return null;

  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Feeding History (7 days)
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-gray-400 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="mt-3 space-y-1">
          {pastLogs.map((log) => {
            const config = STATUS_CONFIG[log.status] ?? STATUS_CONFIG.PENDING;
            return (
              <div
                key={log.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2",
                  config.row
                )}
              >
                <span className={cn("h-2.5 w-2.5 flex-shrink-0 rounded-full", config.dot)} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-700">{log.foodType}</p>
                  <p className="text-xs text-gray-400">
                    {log.date} · {log.scheduledTime}
                  </p>
                </div>
                <span className={cn("text-xs font-medium", config.text)}>
                  {config.label}
                </span>
                {isDoctor && (
                  <ActionsMenu
                    onDelete={() => handleDeleteFeeding(log.id)}
                    deleteConfirmMessage="Delete this feeding log? This action cannot be undone."
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FoodTab({ admissionId, dietPlans, isDoctor, patientName }: FoodTabProps) {
  const today = getTodayIST();
  const activePlan = dietPlans.find((p) => p.isActive) ?? null;
  const todaySchedules = activePlan?.feedingSchedules ?? [];

  return (
    <div className="space-y-1">
      {/* Active diet plan card */}
      {activePlan ? (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 mb-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Active Diet Plan
              </p>
              <p className="mt-0.5 text-base font-semibold text-gray-900">
                {activePlan.dietType}
              </p>
              {activePlan.instructions && (
                <p className="mt-1 text-sm text-gray-600">{activePlan.instructions}</p>
              )}
              <p className="mt-1 text-xs text-gray-400">
                By {activePlan.createdBy.name}
              </p>
            </div>

            {isDoctor && (
              <DietPlanSheet
                admissionId={admissionId}
                triggerLabel="Change Diet"
                triggerVariant="outline"
                triggerClassName="flex-shrink-0 gap-1"
              />
            )}
          </div>
        </div>
      ) : (
        /* No diet plan state */
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <UtensilsCrossed className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No diet plan assigned</p>
          <p className="text-xs text-gray-400 mt-0.5 mb-4">
            A diet plan will define what and when the patient eats.
          </p>
          {isDoctor && (
            <DietPlanSheet
              admissionId={admissionId}
              triggerLabel={
                <>
                  <Plus className="h-4 w-4" />
                  Create Diet Plan
                </>
              }
              triggerVariant="default"
              triggerClassName="gap-1.5"
            />
          )}
        </div>
      )}

      {/* Today's feeding schedule */}
      {todaySchedules.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {"Today's Schedule"}
          </p>
          {todaySchedules
            .slice()
            .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
            .map((schedule) => (
              <FeedingRow key={schedule.id} schedule={schedule} today={today} patientName={patientName} />
            ))}
        </div>
      )}

      {/* Empty schedule state — plan exists but no schedules */}
      {activePlan && todaySchedules.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-400">
          No feeding times scheduled for this diet plan.
        </p>
      )}

      {/* Feeding history (collapsible) */}
      <FeedingHistory dietPlans={dietPlans} isDoctor={isDoctor} />
    </div>
  );
}
