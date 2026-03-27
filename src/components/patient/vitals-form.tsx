"use client";

import { useState } from "react";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProofUploadDialog, type ProofFile } from "@/components/ui/proof-upload-dialog";
import { recordVitals } from "@/actions/vitals";
import { saveProofAttachments, saveSkippedProof } from "@/actions/proof";
import { Activity } from "lucide-react";

interface LastVitals {
  temperature?: number | null;
  heartRate?: number | null;
  respRate?: number | null;
  painScore?: number | null;
  weight?: number | null;
  spo2?: number | null;
  bloodPressure?: string | null;
  capillaryRefillTime?: number | null;
  mucousMembraneColor?: string | null;
}

interface VitalsFormProps {
  admissionId: string;
  lastVitals?: LastVitals | null;
  patientName?: string;
}

export function VitalsForm({ admissionId, lastVitals, patientName = "Patient" }: VitalsFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mmcValue, setMmcValue] = useState(lastVitals?.mucousMembraneColor ?? "");
  const [proofDialogOpen, setProofDialogOpen] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (mmcValue) formData.set("mucousMembraneColor", mmcValue);

    // Store form data and open proof dialog
    setPendingFormData(formData);
    setProofDialogOpen(true);
  }

  async function submitWithProof(proofs: ProofFile[], skipReason?: string) {
    if (!pendingFormData) return;
    setLoading(true);

    const result = await recordVitals(admissionId, pendingFormData);
    setLoading(false);

    if (result?.success) {
      toast.success("Vitals recorded successfully");
      const recordId = (result as { id?: string })?.id ?? admissionId;
      if (proofs.length > 0) {
        saveProofAttachments(recordId, "VitalRecord", "VITALS", proofs).catch(() => {});
      } else if (skipReason) {
        saveSkippedProof(recordId, "VitalRecord", "VITALS", skipReason).catch(() => {});
      }
      setPendingFormData(null);
      setOpen(false);
    }
  }

  function handleProofComplete(proofs: ProofFile[]) {
    submitWithProof(proofs);
  }

  function handleProofSkip(reason: string) {
    submitWithProof([], reason);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button className="w-full gap-2" />
          }
        >
          <Activity className="w-4 h-4" />
          Record Vitals
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto pb-safe">
          <SheetHeader>
            <SheetTitle>Record Vitals</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="px-4 pb-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="temperature">Temperature</Label>
                <Input
                  id="temperature"
                  name="temperature"
                  type="number"
                  step="0.1"
                  placeholder="°C"
                  defaultValue={lastVitals?.temperature ?? ""}
                  className="h-12"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="heartRate">Heart Rate</Label>
                <Input
                  id="heartRate"
                  name="heartRate"
                  type="number"
                  placeholder="bpm"
                  defaultValue={lastVitals?.heartRate ?? ""}
                  className="h-12"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="respRate">Respiratory Rate</Label>
                <Input
                  id="respRate"
                  name="respRate"
                  type="number"
                  placeholder="/min"
                  defaultValue={lastVitals?.respRate ?? ""}
                  className="h-12"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="painScore">Pain Score</Label>
                <Input
                  id="painScore"
                  name="painScore"
                  type="number"
                  min={0}
                  max={10}
                  placeholder="0-10"
                  defaultValue={lastVitals?.painScore ?? ""}
                  className="h-12"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="weight">Weight</Label>
                <Input
                  id="weight"
                  name="weight"
                  type="number"
                  step="0.1"
                  placeholder="kg"
                  defaultValue={lastVitals?.weight ?? ""}
                  className="h-12"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="spo2">SpO2</Label>
                <Input
                  id="spo2"
                  name="spo2"
                  type="number"
                  step="0.1"
                  placeholder="%"
                  defaultValue={lastVitals?.spo2 ?? ""}
                  className="h-12"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bloodPressure">Blood Pressure</Label>
                <Input
                  id="bloodPressure"
                  name="bloodPressure"
                  type="text"
                  placeholder="e.g., 120/80"
                  defaultValue={lastVitals?.bloodPressure ?? ""}
                  className="h-12"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="capillaryRefillTime">CRT</Label>
                <Input
                  id="capillaryRefillTime"
                  name="capillaryRefillTime"
                  type="number"
                  step="0.1"
                  placeholder="seconds"
                  defaultValue={lastVitals?.capillaryRefillTime ?? ""}
                  className="h-12"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Mucous Membrane Color</Label>
              <Select
                value={mmcValue}
                onValueChange={(v) => setMmcValue(v ?? "")}
              >
                <SelectTrigger className="w-full h-12">
                  <SelectValue placeholder="Select color" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pink">Pink</SelectItem>
                  <SelectItem value="Pale">Pale</SelectItem>
                  <SelectItem value="White">White</SelectItem>
                  <SelectItem value="Yellow">Yellow</SelectItem>
                  <SelectItem value="Brick red">Brick red</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Additional observations..."
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
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
        category="VITALS"
        actionLabel="Vitals recorded"
      />
    </>
  );
}
