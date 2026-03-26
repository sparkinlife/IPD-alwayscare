"use client";

import { useState } from "react";
import { Droplets } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { logBath } from "@/actions/baths";
import { WARD_CONFIG } from "@/lib/constants";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BathDuePatient {
  admissionId: string;
  patientName: string;
  ward: string;
  cageNumber: string | null;
  daysSinceLast: number;
  isOverdue: boolean;
}

interface BathDueSectionProps {
  patients: BathDuePatient[];
}

// ─── Log Bath Sheet ───────────────────────────────────────────────────────────

function LogBathSheet({
  admissionId,
  patientName,
  open,
  onOpenChange,
}: {
  admissionId: string;
  patientName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      if (notes) formData.set("notes", notes);
      const result = await logBath(admissionId, formData);
      if (result?.success) {
        toast.success(`Bath logged for ${patientName}`);
        setNotes("");
        onOpenChange(false);
      } else {
        toast.error("Failed to log bath");
      }
    } catch {
      toast.error("Failed to log bath");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (!loading) {
      onOpenChange(false);
      setNotes("");
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle>Log Bath — {patientName}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 px-1">
          <div className="space-y-1.5">
            <Label htmlFor={`bath-notes-${admissionId}`}>Notes (optional)</Label>
            <Textarea
              id={`bath-notes-${admissionId}`}
              rows={3}
              placeholder="Any observations, shampoo used, condition of coat..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Saving..." : "Confirm Bath"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Patient Row ──────────────────────────────────────────────────────────────

function BathDueRow({ patient }: { patient: BathDuePatient }) {
  const [bathOpen, setBathOpen] = useState(false);
  const wardConfig = WARD_CONFIG[patient.ward] ?? WARD_CONFIG.GENERAL;

  const badgeClass = patient.isOverdue
    ? "bg-red-100 text-red-700"
    : "bg-orange-100 text-orange-700";
  const badgeLabel = patient.isOverdue ? "Overdue" : "Due";

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border border-orange-100 bg-white px-3 py-3">
        {/* Droplets icon */}
        <Droplets
          className={cn(
            "h-5 w-5 flex-shrink-0",
            patient.isOverdue ? "text-red-500" : "text-orange-500"
          )}
        />

        {/* Patient info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-gray-900 truncate">
              {patient.patientName}
            </span>
            {patient.cageNumber && (
              <span className="text-xs text-gray-400 flex-shrink-0">
                · {patient.cageNumber}
              </span>
            )}
            <span
              className={cn(
                "flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                wardConfig.bg,
                wardConfig.color
              )}
            >
              {wardConfig.label}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {patient.daysSinceLast} day{patient.daysSinceLast === 1 ? "" : "s"} since last bath
          </p>
        </div>

        {/* Badge + button */}
        <div className="flex flex-shrink-0 items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-semibold",
              badgeClass
            )}
          >
            {badgeLabel}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBathOpen(true)}
            className="gap-1"
          >
            <Droplets className="h-3.5 w-3.5" />
            Log Bath
          </Button>
        </div>
      </div>

      <LogBathSheet
        admissionId={patient.admissionId}
        patientName={patient.patientName}
        open={bathOpen}
        onOpenChange={setBathOpen}
      />
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BathDueSection({ patients }: BathDueSectionProps) {
  if (patients.length === 0) return null;

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 mb-4">
      <div className="flex items-center gap-2 mb-2.5">
        <Droplets className="h-4 w-4 text-orange-600" />
        <h2 className="text-sm font-semibold text-orange-800">
          Bath Due ({patients.length})
        </h2>
      </div>
      <div className="space-y-2">
        {patients.map((patient) => (
          <BathDueRow key={patient.admissionId} patient={patient} />
        ))}
      </div>
    </div>
  );
}
