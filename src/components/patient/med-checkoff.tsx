"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, AlertCircle, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { administerDose, undoAdministration } from "@/actions/medications";
import { saveProofAttachments, saveSkippedProof } from "@/actions/proof";
import { MedSkipSheet } from "./med-skip-sheet";
import { ProofUploadDialog, type ProofFile } from "@/components/ui/proof-upload-dialog";
import { isOverdueByMinutes, formatTimeIST } from "@/lib/date-utils";

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

interface MedCheckoffProps {
  treatmentPlan: TreatmentPlanMin;
  scheduledDate: string;
  scheduledTime: string;
  administration?: Administration | null;
  isDoctor?: boolean;
  patientName: string;
  staffName?: string;
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

export function MedCheckoff({
  treatmentPlan,
  scheduledDate,
  scheduledTime,
  administration,
  isDoctor,
  patientName,
  staffName,
}: MedCheckoffProps) {
  const [optimisticAdmin, setOptimisticAdmin] = useState<
    Administration | null | undefined
  >(administration);
  const [checkLoading, setCheckLoading] = useState(false);
  const [undoLoading, setUndoLoading] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [proofDialogOpen, setProofDialogOpen] = useState(false);
  const [proofViewOpen, setProofViewOpen] = useState(false);

  const isAdministered = optimisticAdmin?.wasAdministered === true;
  const isSkipped = optimisticAdmin?.wasSkipped === true;
  const isOverdue =
    !isAdministered &&
    !isSkipped &&
    isOverdueByMinutes(scheduledTime, 30);

  function handleCheck() {
    if (isAdministered || checkLoading) return;
    // Open proof dialog instead of immediately calling server
    setProofDialogOpen(true);
  }

  async function handleProofComplete(proofs: ProofFile[]) {
    setCheckLoading(true);
    // Optimistic update — include staff name immediately
    setOptimisticAdmin({
      id: "optimistic",
      wasAdministered: true,
      wasSkipped: false,
      skipReason: null,
      actualTime: new Date(),
      administeredBy: staffName ? { name: staffName } : null,
    });
    try {
      const result = await administerDose(
        treatmentPlan.id,
        scheduledDate,
        scheduledTime
      );
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        setOptimisticAdmin(administration);
      } else {
        toast.success("Dose administered");
        const recordId = (result as { id?: string })?.id;
        // Update optimistic state with REAL ID so undo button shows immediately
        if (recordId) {
          setOptimisticAdmin({
            id: recordId,
            wasAdministered: true,
            wasSkipped: false,
            skipReason: null,
            actualTime: new Date(),
            administeredBy: staffName ? { name: staffName } : null,
          });
        }
        // Save proofs with the REAL administration ID
        if (recordId && proofs.length > 0) {
          const proofResult = await saveProofAttachments(recordId, "MedicationAdministration", "MEDS", proofs);
          if (proofResult && "error" in proofResult && proofResult.error) {
            toast.warning("Action recorded but proof save failed — please retry upload");
          }
        }
      }
    } catch {
      toast.error("Failed to record dose");
      setOptimisticAdmin(administration);
    } finally {
      setCheckLoading(false);
    }
  }

  async function handleProofSkip(reason: string) {
    setCheckLoading(true);
    setOptimisticAdmin({
      id: "optimistic",
      wasAdministered: true,
      wasSkipped: false,
      skipReason: null,
      actualTime: new Date(),
      administeredBy: staffName ? { name: staffName } : null,
    });
    try {
      const result = await administerDose(
        treatmentPlan.id,
        scheduledDate,
        scheduledTime
      );
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        setOptimisticAdmin(administration);
      } else {
        toast.success("Dose administered");
        const recordId = (result as { id?: string })?.id;
        // Update with real ID so undo shows immediately
        if (recordId) {
          setOptimisticAdmin({
            id: recordId,
            wasAdministered: true,
            wasSkipped: false,
            skipReason: null,
            actualTime: new Date(),
            administeredBy: staffName ? { name: staffName } : null,
          });
          const proofResult = await saveSkippedProof(recordId, "MedicationAdministration", "MEDS", reason);
          if (proofResult && "error" in proofResult && proofResult.error) {
            toast.warning("Action recorded but proof save failed — please retry upload");
          }
        }
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

  async function handleUndo() {
    if (!optimisticAdmin || optimisticAdmin.id.startsWith("optimistic")) return;
    setUndoLoading(true);
    try {
      const result = await undoAdministration(optimisticAdmin.id);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Administration undone");
        setOptimisticAdmin(null);
      }
    } catch {
      toast.error("Failed to undo administration");
    } finally {
      setUndoLoading(false);
    }
  }

  let rowBg = "bg-white border-gray-100";
  if (isAdministered) rowBg = "bg-green-50 border-green-100";
  else if (isSkipped) rowBg = "bg-gray-50 border-gray-200";
  else if (isOverdue) rowBg = "bg-red-50 border-red-100";

  const routeAbbr = ROUTE_ABBR[treatmentPlan.route] ?? treatmentPlan.route;

  const actionLabel = `${treatmentPlan.drugName} ${treatmentPlan.dose} at ${scheduledTime}`;

  return (
    <>
      <div className={cn("flex items-center gap-3 rounded-lg border p-3 mb-2", rowBg)}>
        {/* Checkbox hit area */}
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

        {/* Med info — tap to view proofs if completed */}
        <button
          type="button"
          onClick={() => {
            if (isAdministered || isSkipped) {
              setProofViewOpen(true);
            }
          }}
          disabled={!isAdministered && !isSkipped}
          className={cn(
            "flex min-w-0 flex-1 flex-col text-left",
            (isAdministered || isSkipped) ? "cursor-pointer" : "cursor-default"
          )}
        >
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

          {(isAdministered || isSkipped) && (
            <span className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
              <Camera className="h-3 w-3" />
              View proofs
            </span>
          )}
        </button>

        {/* Skip button — only on pending/overdue meds */}
        {!isAdministered && !isSkipped && (
          <button
            type="button"
            onClick={() => setSkipOpen(true)}
            disabled={checkLoading}
            className="flex-shrink-0 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 active:scale-95 disabled:opacity-50"
          >
            Skip
          </button>
        )}

        {/* Undo button (doctor only) */}
        {isDoctor && (isAdministered || isSkipped) && optimisticAdmin && !optimisticAdmin.id.startsWith("optimistic") && (
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoLoading}
            className="flex-shrink-0 text-xs text-gray-400 hover:text-gray-700 disabled:opacity-50"
          >
            {undoLoading ? "..." : "Undo"}
          </button>
        )}

        {/* Overdue indicator */}
        {isOverdue && (
          <div className="flex flex-shrink-0 flex-col items-center">
            <AlertCircle className="h-4 w-4 text-red-500" />
          </div>
        )}
      </div>

      {/* Proof upload dialog (new action) */}
      <ProofUploadDialog
        open={proofDialogOpen}
        onOpenChange={setProofDialogOpen}
        onComplete={handleProofComplete}
        onSkip={handleProofSkip}
        patientName={patientName}
        category="MEDS"
        actionLabel={actionLabel}
      />

      {/* Proof viewer (completed action) */}
      {optimisticAdmin && !optimisticAdmin.id.startsWith("optimistic") && (
        <ProofUploadDialog
          open={proofViewOpen}
          onOpenChange={setProofViewOpen}
          mode="view"
          recordId={optimisticAdmin.id}
          recordType="MedicationAdministration"
          category="MEDS"
          patientName={patientName}
          actionLabel={actionLabel}
          isDoctor={isDoctor}
          onComplete={async (proofs) => {
            if (proofs.length > 0 && optimisticAdmin?.id) {
              await saveProofAttachments(optimisticAdmin.id, "MedicationAdministration", "MEDS", proofs);
              toast.success("Photos added");
            }
          }}
          onSkip={() => {}}
        />
      )}

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
