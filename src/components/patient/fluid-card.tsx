"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatDateTimeIST } from "@/lib/date-utils";
import { changeFluidRate, stopFluids, updateFluidTherapy } from "@/actions/fluids";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface FluidRateChange {
  id: string;
  oldRate: string;
  newRate: string;
  changedAt: Date;
  reason: string | null;
  changedBy: { name: string };
}

interface FluidTherapyData {
  id: string;
  fluidType: string;
  rate: string;
  additives: string | null;
  startTime: Date;
  notes: string | null;
  createdBy: { name: string };
  rateChanges: FluidRateChange[];
}

interface FluidCardProps {
  fluid: FluidTherapyData;
  isDoctor: boolean;
}

export function FluidCard({ fluid, isDoctor }: FluidCardProps) {
  const [changeRateOpen, setChangeRateOpen] = useState(false);
  const [stopOpen, setStopOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [newRate, setNewRate] = useState("");
  const [reason, setReason] = useState("");
  const [rateLoading, setRateLoading] = useState(false);
  const [stopLoading, setStopLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editFluidType, setEditFluidType] = useState(fluid.fluidType);
  const [editAdditives, setEditAdditives] = useState(fluid.additives ?? "");
  const [editNotes, setEditNotes] = useState(fluid.notes ?? "");

  async function handleChangeRate() {
    if (!newRate) {
      toast.error("New rate is required");
      return;
    }
    setRateLoading(true);
    try {
      const formData = new FormData();
      formData.set("newRate", newRate);
      formData.set("reason", reason);
      const result = await changeFluidRate(fluid.id, formData);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Fluid rate updated");
        setChangeRateOpen(false);
        setNewRate("");
        setReason("");
      }
    } catch {
      toast.error("Failed to update rate");
    } finally {
      setRateLoading(false);
    }
  }

  async function handleStopFluids() {
    setStopLoading(true);
    try {
      const result = await stopFluids(fluid.id);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Fluid therapy stopped");
        setStopOpen(false);
      }
    } catch {
      toast.error("Failed to stop fluids");
    } finally {
      setStopLoading(false);
    }
  }

  async function handleEditFluid(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editFluidType) {
      toast.error("Fluid type is required");
      return;
    }
    setEditLoading(true);
    try {
      const formData = new FormData();
      formData.set("fluidType", editFluidType);
      formData.set("additives", editAdditives);
      formData.set("notes", editNotes);
      const result = await updateFluidTherapy(fluid.id, formData);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Fluid therapy updated");
        setEditOpen(false);
      }
    } catch {
      toast.error("Failed to update fluid therapy");
    } finally {
      setEditLoading(false);
    }
  }

  return (
    <Card className="mb-4 overflow-hidden border-blue-200 bg-blue-50">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                IV Fluids
              </span>
              <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                Active
              </span>
            </div>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {fluid.fluidType}
            </p>
            <p className="text-sm text-gray-700">
              Rate: <span className="font-medium">{fluid.rate}</span>
            </p>
            {fluid.additives && (
              <p className="text-xs text-gray-500">+ {fluid.additives}</p>
            )}
            <p className="mt-1 text-xs text-gray-400">
              Started {formatDateTimeIST(new Date(fluid.startTime))} by{" "}
              {fluid.createdBy.name}
            </p>
          </div>

          {isDoctor && (
            <div className="flex flex-col gap-1.5 flex-shrink-0">
              {/* Edit Fluid */}
              <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => { setEditFluidType(fluid.fluidType); setEditAdditives(fluid.additives ?? ""); setEditNotes(fluid.notes ?? ""); setEditOpen(true); }}>
                Edit
              </Button>
              {/* Change Rate */}
              <Dialog open={changeRateOpen} onOpenChange={setChangeRateOpen}>
                <DialogTrigger
                  render={<Button size="sm" variant="outline" className="text-xs h-7 px-2" />}
                >
                  Change Rate
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Change Fluid Rate</DialogTitle>
                  </DialogHeader>
                  <div className="mt-2 space-y-4">
                    <div className="space-y-1.5">
                      <Label>Current Rate</Label>
                      <p className="text-sm font-medium text-gray-700">
                        {fluid.rate}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="newRate">New Rate *</Label>
                      <Input
                        id="newRate"
                        placeholder="e.g. 60 mL/hr"
                        value={newRate}
                        onChange={(e) => setNewRate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reason">Reason</Label>
                      <Textarea
                        id="reason"
                        placeholder="Reason for rate change..."
                        rows={2}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => setChangeRateOpen(false)}
                        disabled={rateLoading}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleChangeRate}
                        disabled={rateLoading || !newRate}
                      >
                        {rateLoading ? "Saving..." : "Update Rate"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Stop Fluids */}
              <Dialog open={stopOpen} onOpenChange={setStopOpen}>
                <DialogTrigger
                  render={
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 px-2 text-red-600 border-red-200 hover:bg-red-50"
                    />
                  }
                >
                  Stop Fluids
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Stop Fluid Therapy?</DialogTitle>
                  </DialogHeader>
                  <div className="mt-2 space-y-4">
                    <p className="text-sm text-gray-600">
                      This will mark the{" "}
                      <span className="font-medium">{fluid.fluidType}</span>{" "}
                      fluid therapy as stopped. This action cannot be undone.
                    </p>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => setStopOpen(false)}
                        disabled={stopLoading}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleStopFluids}
                        disabled={stopLoading}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        {stopLoading ? "Stopping..." : "Stop Fluids"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {/* Rate change history */}
        {fluid.rateChanges.length > 0 && (
          <div className="mt-3 border-t border-blue-100 pt-3">
            <button
              type="button"
              onClick={() => setHistoryOpen((prev) => !prev)}
              className="flex items-center gap-1 text-xs font-medium text-blue-600"
            >
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  historyOpen && "rotate-180"
                )}
              />
              Rate History ({fluid.rateChanges.length})
            </button>
            {historyOpen && (
              <ul className="mt-2 space-y-1.5">
                {fluid.rateChanges.map((rc) => (
                  <li key={rc.id} className="text-xs text-gray-600">
                    <span className="font-medium">
                      {rc.oldRate} → {rc.newRate}
                    </span>{" "}
                    by {rc.changedBy.name} at{" "}
                    {formatDateTimeIST(new Date(rc.changedAt))}
                    {rc.reason && (
                      <span className="text-gray-400"> — {rc.reason}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Edit Fluid Sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="bottom" className="pb-8">
          <SheetHeader>
            <SheetTitle>Edit Fluid Therapy</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleEditFluid} className="mt-4 space-y-4 px-1">
            <div className="space-y-1.5">
              <Label htmlFor="editFluidType">Fluid Type *</Label>
              <Input id="editFluidType" placeholder="e.g. Ringer's Lactate" value={editFluidType} onChange={(e) => setEditFluidType(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editAdditives">Additives</Label>
              <Input id="editAdditives" placeholder="e.g. KCl 20 mEq/L" value={editAdditives} onChange={(e) => setEditAdditives(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editFluidNotes">Notes</Label>
              <Textarea id="editFluidNotes" rows={2} placeholder="Special instructions..." value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setEditOpen(false)} disabled={editLoading}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={editLoading}>{editLoading ? "Saving..." : "Update"}</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
