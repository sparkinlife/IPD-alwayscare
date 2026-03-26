"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { administerDose } from "@/actions/medications";
import { WARD_CONFIG } from "@/lib/constants";
import { isOverdueByMinutes, formatTimeIST } from "@/lib/date-utils";
import { MedSkipSheet } from "@/components/patient/med-skip-sheet";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Administration {
  id: string;
  wasAdministered: boolean;
  wasSkipped: boolean;
  skipReason: string | null;
  actualTime: Date | null;
  administeredBy?: { name: string } | null;
}

interface TreatmentPlanMin {
  id: string;
  drugName: string;
  dose: string;
  route: string;
}

interface ScheduleMedRowProps {
  treatmentPlan: TreatmentPlanMin;
  scheduledDate: string;
  scheduledTime: string;
  administration?: Administration | null;
  patientName: string;
  ward: string;
  cageNumber: string | null;
}

const ROUTE_ABBR: Record<string, string> = {
  PO: "PO",
  IV: "IV",
  SC: "SC",
  IM: "IM",
  TOPICAL: "TOP",
  NEBULIZER: "NEB",
  RECTAL: "PR",
  OPHTHALMIC: "OU",
  OTIC: "AU",
  OTHER: "—",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ScheduleMedRow({
  treatmentPlan,
  scheduledDate,
  scheduledTime,
  administration,
  patientName,
  ward,
  cageNumber,
}: ScheduleMedRowProps) {
  const [optimisticAdmin, setOptimisticAdmin] = useState<
    Administration | null | undefined
  >(administration);
  const [checkLoading, setCheckLoading] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);

  const isAdministered = optimisticAdmin?.wasAdministered === true;
  const isSkipped = optimisticAdmin?.wasSkipped === true;
  const isOverdue =
    !isAdministered &&
    !isSkipped &&
    isOverdueByMinutes(scheduledTime, 30);

  const wardConfig = WARD_CONFIG[ward] ?? WARD_CONFIG.GENERAL;
  const routeAbbr = ROUTE_ABBR[treatmentPlan.route] ?? treatmentPlan.route;

  async function handleCheck() {
    if (isAdministered || checkLoading) return;
    setCheckLoading(true);
    setOptimisticAdmin({
      id: "optimistic",
      wasAdministered: true,
      wasSkipped: false,
      skipReason: null,
      actualTime: new Date(),
      administeredBy: null,
    });
    try {
      const result = await administerDose(
        treatmentPlan.id,
        scheduledDate,
        scheduledTime
      );
      if (result?.error) {
        toast.error(result.error);
        setOptimisticAdmin(administration);
      } else {
        toast.success("Dose administered");
      }
    } catch {
      toast.error("Failed to record dose");
      setOptimisticAdmin(administration);
    } finally {
      setCheckLoading(false);
    }
  }

  function handleSkipped() {
    setOptimisticAdmin({
      id: "optimistic-skip",
      wasAdministered: false,
      wasSkipped: true,
      skipReason: "Skipped",
      actualTime: null,
      administeredBy: null,
    });
  }

  let rowBg = "bg-white border-gray-100";
  if (isAdministered) rowBg = "bg-green-50 border-green-100";
  else if (isSkipped) rowBg = "bg-gray-50 border-gray-200";
  else if (isOverdue) rowBg = "bg-red-50 border-red-100";

  return (
    <>
      <div className={cn("flex items-center gap-3 rounded-lg border p-3 mb-2", rowBg)}>
        {/* Checkbox */}
        <button
          type="button"
          onClick={handleCheck}
          disabled={isAdministered || isSkipped || checkLoading}
          className={cn(
            "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400",
            isAdministered || isSkipped
              ? "cursor-default"
              : "cursor-pointer active:scale-95"
          )}
          aria-label={isAdministered ? "Administered" : "Mark as administered"}
        >
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md border-2 transition-colors",
              isAdministered
                ? "border-green-500 bg-green-500 text-white"
                : isSkipped
                ? "border-gray-300 bg-gray-200 text-gray-400"
                : isOverdue
                ? "border-red-400 bg-white text-transparent"
                : "border-gray-300 bg-white text-transparent",
              checkLoading && "opacity-50"
            )}
          >
            {isAdministered && <Check className="h-4 w-4" />}
          </span>
        </button>

        {/* Med info with patient — tap to open skip sheet */}
        <button
          type="button"
          onClick={() => {
            if (!isAdministered && !isSkipped) setSkipOpen(true);
          }}
          disabled={isAdministered || isSkipped}
          className={cn(
            "flex min-w-0 flex-1 flex-col text-left",
            !isAdministered && !isSkipped ? "cursor-pointer" : "cursor-default"
          )}
        >
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

          {/* Drug info */}
          <span
            className={cn(
              "truncate text-sm font-medium",
              isSkipped && "line-through text-gray-400",
              isAdministered && "text-green-800"
            )}
          >
            {treatmentPlan.drugName}
          </span>
          <span
            className={cn(
              "text-xs",
              isSkipped ? "text-gray-400" : "text-gray-500"
            )}
          >
            {treatmentPlan.dose} · {routeAbbr}
          </span>

          {isAdministered && optimisticAdmin?.actualTime && (
            <span className="mt-0.5 text-xs text-green-600">
              Given{optimisticAdmin.administeredBy ? ` by ${optimisticAdmin.administeredBy.name}` : ""}{" "}
              at {formatTimeIST(new Date(optimisticAdmin.actualTime))}
            </span>
          )}

          {isSkipped && optimisticAdmin?.skipReason && (
            <span className="mt-0.5 text-xs text-gray-400">
              {optimisticAdmin.skipReason}
            </span>
          )}
        </button>

        {/* Overdue indicator */}
        {isOverdue && (
          <div className="flex flex-shrink-0 flex-col items-center">
            <AlertCircle className="h-4 w-4 text-red-500" />
          </div>
        )}
      </div>

      <MedSkipSheet
        open={skipOpen}
        onOpenChange={setSkipOpen}
        treatmentPlanId={treatmentPlan.id}
        drugName={treatmentPlan.drugName}
        dose={treatmentPlan.dose}
        scheduledDate={scheduledDate}
        scheduledTime={scheduledTime}
        onSkipped={handleSkipped}
      />
    </>
  );
}
