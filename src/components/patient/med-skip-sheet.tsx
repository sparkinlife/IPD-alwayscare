"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { COMMON_SKIP_REASONS } from "@/lib/constants";
import { skipDose } from "@/actions/medications";

interface MedSkipSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  treatmentPlanId: string;
  drugName: string;
  dose: string;
  scheduledDate: string;
  scheduledTime: string;
  onSkipped?: () => void;
}

export function MedSkipSheet({
  open,
  onOpenChange,
  treatmentPlanId,
  drugName,
  dose,
  scheduledDate,
  scheduledTime,
  onSkipped,
}: MedSkipSheetProps) {
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [loading, setLoading] = useState(false);

  const finalReason = selectedReason || customReason;

  async function handleConfirmSkip() {
    if (!finalReason) {
      toast.error("Please select or enter a skip reason");
      return;
    }
    setLoading(true);
    try {
      const result = await skipDose(
        treatmentPlanId,
        scheduledDate,
        scheduledTime,
        finalReason
      );
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Dose marked as skipped");
        onSkipped?.();
        onOpenChange(false);
        setSelectedReason("");
        setCustomReason("");
      }
    } catch {
      toast.error("Failed to skip dose");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (!loading) {
      onOpenChange(false);
      setSelectedReason("");
      setCustomReason("");
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle>Skip Dose</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4 px-1">
          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <p className="text-sm font-medium text-gray-900">{drugName}</p>
            <p className="text-xs text-gray-500">
              {dose} — scheduled {scheduledTime}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Reason for skipping</Label>
            <div className="flex flex-wrap gap-2">
              {COMMON_SKIP_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => {
                    setSelectedReason(reason === selectedReason ? "" : reason);
                    setCustomReason("");
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                    selectedReason === reason
                      ? "bg-gray-800 text-white border-gray-800"
                      : "bg-white text-gray-700 border-gray-300 hover:border-gray-500"
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="customReason" className="text-sm">
              Or enter custom reason
            </Label>
            <Input
              id="customReason"
              placeholder="Type reason..."
              value={customReason}
              onChange={(e) => {
                setCustomReason(e.target.value);
                if (e.target.value) setSelectedReason("");
              }}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleConfirmSkip}
              disabled={loading || !finalReason}
            >
              {loading ? "Saving..." : "Confirm Skip"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
