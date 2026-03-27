"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ProofUploadDialog, type ProofFile } from "@/components/ui/proof-upload-dialog";
import { logFeeding } from "@/actions/feeding";
import { saveProofAttachments, saveSkippedProof } from "@/actions/proof";
import { getTodayIST } from "@/lib/date-utils";

interface FeedingLogSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feedingScheduleId: string;
  scheduledTime: string;
  foodType: string;
  portion: string;
  currentStatus?: string;
  onLogged?: (status: string) => void;
  patientName?: string;
}

const STATUS_OPTIONS = [
  {
    value: "EATEN",
    label: "Eaten",
    description: "Fully consumed",
    activeClass: "bg-green-500 border-green-500 text-white",
    inactiveClass: "bg-white border-green-300 text-green-700 hover:bg-green-50",
  },
  {
    value: "PARTIAL",
    label: "Partial",
    description: "Partially eaten",
    activeClass: "bg-yellow-400 border-yellow-400 text-white",
    inactiveClass: "bg-white border-yellow-300 text-yellow-700 hover:bg-yellow-50",
  },
  {
    value: "REFUSED",
    label: "Refused",
    description: "Did not eat",
    activeClass: "bg-red-500 border-red-500 text-white",
    inactiveClass: "bg-white border-red-300 text-red-700 hover:bg-red-50",
  },
] as const;

export function FeedingLogSheet({
  open,
  onOpenChange,
  feedingScheduleId,
  scheduledTime,
  foodType,
  portion,
  currentStatus,
  onLogged,
  patientName = "Patient",
}: FeedingLogSheetProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>(
    currentStatus && currentStatus !== "PENDING" ? currentStatus : ""
  );
  const [amountConsumed, setAmountConsumed] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [proofDialogOpen, setProofDialogOpen] = useState(false);
  // Store pending form data for use after proof dialog
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

  function resetForm() {
    setSelectedStatus(currentStatus && currentStatus !== "PENDING" ? currentStatus : "");
    setAmountConsumed("");
    setNotes("");
    setPendingFormData(null);
  }

  function handleClose() {
    if (!loading) {
      onOpenChange(false);
      resetForm();
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedStatus) {
      toast.error("Please select a feeding status");
      return;
    }

    // Build form data and store it, then open proof dialog
    const formData = new FormData();
    formData.set("status", selectedStatus);
    formData.set("date", getTodayIST());
    if (selectedStatus === "PARTIAL" && amountConsumed) {
      formData.set("amountConsumed", amountConsumed);
    }
    if (notes) formData.set("notes", notes);

    setPendingFormData(formData);
    setProofDialogOpen(true);
  }

  async function submitWithProof(proofs: ProofFile[], skipReason?: string) {
    if (!pendingFormData) return;
    setLoading(true);
    try {
      const result = await logFeeding(feedingScheduleId, pendingFormData);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Feeding status recorded");
        const logId = (result as { id?: string })?.id ?? feedingScheduleId;
        if (proofs.length > 0) {
          saveProofAttachments(logId, "FeedingLog", "FOOD", proofs).catch(() => {});
        } else if (skipReason) {
          saveSkippedProof(logId, "FeedingLog", "FOOD", skipReason).catch(() => {});
        }
        onLogged?.(selectedStatus);
        onOpenChange(false);
        resetForm();
      }
    } catch {
      toast.error("Failed to record feeding status");
    } finally {
      setLoading(false);
    }
  }

  function handleProofComplete(proofs: ProofFile[]) {
    submitWithProof(proofs);
  }

  function handleProofSkip(reason: string) {
    submitWithProof([], reason);
  }

  const actionLabel = `${foodType} at ${scheduledTime} — ${selectedStatus || "feeding"}`;

  return (
    <>
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent side="bottom" className="pb-8">
          <SheetHeader>
            <SheetTitle>Log Feeding</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4 px-1">
            {/* Feeding info summary */}
            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
              <p className="text-sm font-medium text-gray-900">{foodType}</p>
              <p className="text-xs text-gray-500">
                {scheduledTime} — {portion}
              </p>
            </div>

            {/* Status buttons */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Feeding status *</Label>
              <div className="grid grid-cols-3 gap-2">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedStatus(option.value)}
                    className={cn(
                      "flex min-h-[44px] flex-col items-center justify-center rounded-lg border-2 px-2 py-3 text-center transition-colors",
                      selectedStatus === option.value
                        ? option.activeClass
                        : option.inactiveClass
                    )}
                  >
                    <span className="text-sm font-semibold">{option.label}</span>
                    <span
                      className={cn(
                        "text-xs mt-0.5",
                        selectedStatus === option.value ? "opacity-80" : "opacity-60"
                      )}
                    >
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount consumed — only when Partial */}
            {selectedStatus === "PARTIAL" && (
              <div className="space-y-1.5">
                <Label htmlFor="amountConsumed">Amount consumed</Label>
                <Input
                  id="amountConsumed"
                  placeholder="e.g. Half portion, 50g..."
                  value={amountConsumed}
                  onChange={(e) => setAmountConsumed(e.target.value)}
                />
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="feedingNotes">Notes</Label>
              <Textarea
                id="feedingNotes"
                rows={2}
                placeholder="Any observations..."
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
              <Button
                type="submit"
                className="flex-1"
                disabled={loading || !selectedStatus}
              >
                {loading ? "Saving..." : "Next: Upload Proof"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <ProofUploadDialog
        open={proofDialogOpen}
        onOpenChange={setProofDialogOpen}
        onComplete={handleProofComplete}
        onSkip={handleProofSkip}
        patientName={patientName}
        category="FOOD"
        actionLabel={actionLabel}
      />
    </>
  );
}
