"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DischargeForm } from "./discharge-form";
import { updateCondition, transferWard, archivePatient } from "@/actions/admissions";
import { Activity, ArrowRightLeft, Archive } from "lucide-react";

interface AvailableCage {
  ward: string;
  cageNumber: string;
}

interface DoctorActionsProps {
  admissionId: string;
  currentCondition: string | null;
  currentWard: string | null;
  availableCages: AvailableCage[];
}

export function DoctorActions({
  admissionId,
  currentCondition,
  currentWard,
  availableCages,
}: DoctorActionsProps) {
  // Update Condition state
  const [conditionOpen, setConditionOpen] = useState(false);
  const [newCondition, setNewCondition] = useState(currentCondition ?? "");
  const [conditionLoading, setConditionLoading] = useState(false);

  // Archive state
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);

  // Transfer Ward state
  const [transferOpen, setTransferOpen] = useState(false);
  const [selectedWard, setSelectedWard] = useState(currentWard ?? "");
  const [selectedCage, setSelectedCage] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);

  const filteredCages = availableCages.filter((c) => c.ward === selectedWard);

  async function handleConditionUpdate() {
    if (!newCondition) return;
    setConditionLoading(true);
    try {
      await updateCondition(admissionId, newCondition);
      toast.success("Condition updated");
      setConditionOpen(false);
    } catch {
      toast.error("Failed to update condition");
    } finally {
      setConditionLoading(false);
    }
  }

  async function handleTransfer() {
    if (!selectedWard || !selectedCage) return;
    setTransferLoading(true);
    const result = await transferWard(admissionId, selectedWard, selectedCage);
    setTransferLoading(false);
    if (result && "error" in result && result.error) {
      toast.error(result.error);
    } else {
      toast.success("Patient transferred");
      setTransferOpen(false);
    }
  }

  async function handleArchive() {
    setArchiveLoading(true);
    try {
      await archivePatient(admissionId);
    } catch (err) {
      if (err && typeof err === "object" && "digest" in err) throw err;
      toast.error("Failed to archive patient");
    } finally {
      setArchiveLoading(false);
      setArchiveOpen(false);
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 flex gap-2 z-10">
      {/* Update Condition */}
      <Sheet open={conditionOpen} onOpenChange={setConditionOpen}>
        <SheetTrigger
          render={
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" />
          }
        >
          <Activity className="w-4 h-4" />
          <span className="text-xs">Condition</span>
        </SheetTrigger>
        <SheetContent side="bottom" className="pb-8">
          <SheetHeader>
            <SheetTitle>Update Condition</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4 px-4">
            <div className="space-y-1.5">
              <Label>New Condition</Label>
              <Select
                value={newCondition}
                onValueChange={(v) => setNewCondition(v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="GUARDED">Guarded</SelectItem>
                  <SelectItem value="STABLE">Stable</SelectItem>
                  <SelectItem value="IMPROVING">Improving</SelectItem>
                  <SelectItem value="RECOVERED">Recovered</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={handleConditionUpdate}
              disabled={conditionLoading || !newCondition}
            >
              {conditionLoading ? "Saving..." : "Save Condition"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Transfer Ward */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogTrigger
          render={
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" />
          }
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span className="text-xs">Transfer</span>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Transfer Ward</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <div className="space-y-1.5">
              <Label>New Ward</Label>
              <Select
                value={selectedWard}
                onValueChange={(v) => {
                  setSelectedWard(v ?? "");
                  setSelectedCage("");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select ward" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GENERAL">General</SelectItem>
                  <SelectItem value="ISOLATION">Isolation</SelectItem>
                  <SelectItem value="ICU">ICU</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Cage</Label>
              <Select
                value={selectedCage}
                onValueChange={(v) => setSelectedCage(v ?? "")}
                disabled={!selectedWard || filteredCages.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      !selectedWard
                        ? "Select ward first"
                        : filteredCages.length === 0
                        ? "No available cages"
                        : "Select cage"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredCages.map((c) => (
                    <SelectItem key={c.cageNumber} value={c.cageNumber}>
                      Cage {c.cageNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button
                variant="outline"
                onClick={() => setTransferOpen(false)}
                disabled={transferLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleTransfer}
                disabled={transferLoading || !selectedWard || !selectedCage}
              >
                {transferLoading ? "Transferring..." : "Transfer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive */}
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogTrigger
          render={
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" />
          }
        >
          <Archive className="w-4 h-4" />
          <span className="text-xs">Archive</span>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Archive this patient?</DialogTitle>
            <DialogDescription>
              They will be removed from the dashboard but records are preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setArchiveOpen(false)}
              disabled={archiveLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleArchive}
              disabled={archiveLoading}
            >
              {archiveLoading ? "Archiving..." : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discharge */}
      <DischargeForm admissionId={admissionId} />
    </div>
  );
}
