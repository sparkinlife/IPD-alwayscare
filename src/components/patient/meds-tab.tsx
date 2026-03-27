"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getTodayIST, isOverdueByMinutes } from "@/lib/date-utils";
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
import { MedCheckoff } from "./med-checkoff";
import { FluidCard } from "./fluid-card";
import { PrescribeMedForm } from "./prescribe-med-form";
import { stopMedication, updateMedication, deleteMedication } from "@/actions/medications";
import { startFluidTherapy } from "@/actions/fluids";
import { ActionsMenu } from "@/components/ui/actions-menu";
import {
  COMMON_DRUGS,
  ROUTE_LABELS,
  FREQUENCY_LABELS,
  FREQUENCY_DEFAULT_TIMES,
} from "@/lib/constants";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Administration {
  id: string;
  treatmentPlanId: string;
  scheduledDate: Date;
  scheduledTime: string;
  wasAdministered: boolean;
  wasSkipped: boolean;
  skipReason: string | null;
  actualTime: Date | null;
  administeredBy?: { name: string } | null;
}

interface TreatmentPlan {
  id: string;
  drugName: string;
  dose: string;
  calculatedDose: string | null;
  route: string;
  frequency: string;
  scheduledTimes: string[];
  isActive: boolean;
  startDate: Date;
  endDate: Date | null;
  notes: string | null;
  createdBy: { name: string };
  administrations: Administration[];
}

interface FluidRateChange {
  id: string;
  oldRate: string;
  newRate: string;
  changedAt: Date;
  reason: string | null;
  changedBy: { name: string };
}

interface FluidTherapy {
  id: string;
  fluidType: string;
  rate: string;
  additives: string | null;
  startTime: Date;
  endTime: Date | null;
  isActive: boolean;
  notes: string | null;
  createdBy: { name: string };
  rateChanges: FluidRateChange[];
}

interface MedsTabProps {
  admissionId: string;
  treatmentPlans: TreatmentPlan[];
  fluidTherapies: FluidTherapy[];
  isDoctor: boolean;
  patientName: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface DoseSlot {
  treatmentPlan: TreatmentPlan;
  scheduledTime: string;
  administration: Administration | null;
}

interface TimeGroup {
  time: string;
  slots: DoseSlot[];
}

function getAdministrationForSlot(
  plan: TreatmentPlan,
  today: string,
  scheduledTime: string
): Administration | null {
  return (
    plan.administrations.find((a) => {
      const aDate =
        a.scheduledDate instanceof Date
          ? a.scheduledDate.toISOString().slice(0, 10)
          : String(a.scheduledDate).slice(0, 10);
      return aDate === today && a.scheduledTime === scheduledTime;
    }) ?? null
  );
}

function buildTimeGroups(plans: TreatmentPlan[], today: string): TimeGroup[] {
  const groupMap = new Map<string, DoseSlot[]>();

  for (const plan of plans) {
    if (!plan.isActive) continue;
    for (const scheduledTime of plan.scheduledTimes) {
      const administration = getAdministrationForSlot(plan, today, scheduledTime);
      const slot: DoseSlot = { treatmentPlan: plan, scheduledTime, administration };
      const existing = groupMap.get(scheduledTime) ?? [];
      existing.push(slot);
      groupMap.set(scheduledTime, existing);
    }
  }

  const sortedTimes = Array.from(groupMap.keys()).sort();
  return sortedTimes.map((time) => ({
    time,
    slots: groupMap.get(time)!,
  }));
}

function getGroupStatus(
  group: TimeGroup
): "completed" | "overdue" | "current" | "upcoming" {
  const allDone = group.slots.every(
    (s) => s.administration?.wasAdministered || s.administration?.wasSkipped
  );
  if (allDone) return "completed";

  const hasOverdue = group.slots.some(
    (s) =>
      !s.administration?.wasAdministered &&
      !s.administration?.wasSkipped &&
      isOverdueByMinutes(s.scheduledTime, 30)
  );
  if (hasOverdue) return "overdue";

  const now = new Date();
  const [hh, mm] = group.time.split(":").map(Number);
  const scheduledMinutes = hh * 60 + mm;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (Math.abs(scheduledMinutes - nowMinutes) <= 60) return "current";

  return "upcoming";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StoppedMedRow({ plan, isDoctor, onDelete }: { plan: TreatmentPlan; isDoctor: boolean; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 mb-1.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-400 line-through">
          {plan.drugName}
        </p>
        <p className="text-xs text-gray-400">
          {plan.dose} · {plan.route}
        </p>
      </div>
      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
        <span className="text-xs text-gray-400">Stopped</span>
        {isDoctor && (
          <ActionsMenu
            onDelete={onDelete}
            deleteLabel="Delete"
            deleteConfirmMessage="Delete this stopped medication record? This action cannot be undone."
          />
        )}
      </div>
    </div>
  );
}

function ActivePlanSimpleRow({
  plan,
  isDoctor,
  onEdit,
  onDelete,
}: {
  plan: TreatmentPlan;
  isDoctor: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [stopLoading, setStopLoading] = useState(false);

  async function handleStop() {
    setStopLoading(true);
    try {
      const result = await stopMedication(plan.id);
      if (result && "error" in result && result.error) toast.error(result.error);
      else toast.success("Medication stopped");
    } catch {
      toast.error("Failed to stop medication");
    } finally {
      setStopLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2.5 mb-1.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-800">{plan.drugName}</p>
        <p className="text-xs text-gray-500">
          {plan.dose} · {plan.route} · <span className="italic">{plan.frequency}</span>
        </p>
        {plan.notes && <p className="text-xs text-gray-400 mt-0.5">{plan.notes}</p>}
      </div>
      {isDoctor && (
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleStop}
            disabled={stopLoading}
            className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
          >
            {stopLoading ? "Stopping..." : "Stop"}
          </button>
          <ActionsMenu
            onEdit={onEdit}
            onDelete={onDelete}
            deleteConfirmMessage="Delete this medication? This action cannot be undone."
          />
        </div>
      )}
    </div>
  );
}

function StartFluidsButton({ admissionId }: { admissionId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fluidType, setFluidType] = useState("");
  const [rate, setRate] = useState("");
  const [additives, setAdditives] = useState("");
  const [notes, setNotes] = useState("");

  const FLUID_SUGGESTIONS = [
    "Ringer's Lactate (RL)",
    "Normal Saline (NS)",
    "D5W",
    "D5NS",
    "Half NS",
    "D5RL",
    "Hartmann's Solution",
  ];

  function resetForm() {
    setFluidType("");
    setRate("");
    setAdditives("");
    setNotes("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!fluidType || !rate) {
      toast.error("Fluid type and rate are required");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("fluidType", fluidType);
      formData.set("rate", rate);
      formData.set("additives", additives);
      formData.set("notes", notes);
      const result = await startFluidTherapy(admissionId, formData);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Fluid therapy started");
        resetForm();
        setOpen(false);
      }
    } catch {
      toast.error("Failed to start fluid therapy");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <SheetTrigger
        render={<Button variant="outline" size="sm" className="mb-3 w-full gap-1.5" />}
      >
        <Plus className="h-4 w-4" />
        Start IV Fluid Therapy
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle>Start Fluid Therapy</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 px-1">
          <div className="space-y-1.5">
            <Label htmlFor="fluidType">Fluid Type *</Label>
            <Input
              id="fluidType"
              list="fluid-suggestions"
              placeholder="e.g. Ringer's Lactate"
              value={fluidType}
              onChange={(e) => setFluidType(e.target.value)}
              required
            />
            <datalist id="fluid-suggestions">
              {FLUID_SUGGESTIONS.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="startRate">Rate *</Label>
            <Input
              id="startRate"
              placeholder="e.g. 50 mL/hr"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="startAdditives">Additives</Label>
            <Input
              id="startAdditives"
              placeholder="e.g. KCl 20 mEq/L"
              value={additives}
              onChange={(e) => setAdditives(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="startNotes">Notes</Label>
            <Textarea
              id="startNotes"
              rows={2}
              placeholder="Special instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => { setOpen(false); resetForm(); }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Starting..." : "Start Fluids"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Edit Medication Sheet ──────────────────────────────────────────────────

function EditMedSheet({
  plan,
  open,
  onOpenChange,
}: {
  plan: TreatmentPlan;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [drugName, setDrugName] = useState(plan.drugName);
  const [dose, setDose] = useState(plan.dose);
  const [calculatedDose, setCalculatedDose] = useState(plan.calculatedDose ?? "");
  const [route, setRoute] = useState(plan.route);
  const [frequency, setFrequency] = useState(plan.frequency);
  const [scheduledTimes, setScheduledTimes] = useState<string[]>([...plan.scheduledTimes]);
  const [newTime, setNewTime] = useState("");
  const [notes, setNotes] = useState(plan.notes ?? "");

  useEffect(() => {
    if (open) {
      setDrugName(plan.drugName);
      setDose(plan.dose);
      setCalculatedDose(plan.calculatedDose ?? "");
      setRoute(plan.route);
      setFrequency(plan.frequency);
      setScheduledTimes([...plan.scheduledTimes]);
      setNotes(plan.notes ?? "");
    }
  }, [open, plan]);

  function addTime() {
    const t = newTime.trim();
    if (t && !scheduledTimes.includes(t)) {
      setScheduledTimes((prev) => [...prev, t].sort());
      setNewTime("");
    }
  }

  function removeTime(t: string) {
    setScheduledTimes((prev) => prev.filter((x) => x !== t));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!drugName || !dose || !route || !frequency) {
      toast.error("Drug name, dose, route, and frequency are required");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("drugName", drugName);
      formData.set("dose", dose);
      formData.set("calculatedDose", calculatedDose);
      formData.set("route", route);
      formData.set("frequency", frequency);
      formData.set("scheduledTimes", JSON.stringify(scheduledTimes));
      formData.set("notes", notes);

      const result = await updateMedication(plan.id, formData);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Medication updated");
        onOpenChange(false);
      }
    } catch {
      toast.error("Failed to update medication");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto pb-8">
        <SheetHeader>
          <SheetTitle>Edit Medication</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 px-1">
          <div className="space-y-1.5">
            <Label htmlFor="edit-drugName">Drug Name *</Label>
            <Input id="edit-drugName" list="edit-drug-suggestions" placeholder="e.g. Ceftriaxone" value={drugName} onChange={(e) => setDrugName(e.target.value)} required />
            <datalist id="edit-drug-suggestions">
              {COMMON_DRUGS.map((d) => <option key={d} value={d} />)}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-dose">Dose *</Label>
              <Input id="edit-dose" placeholder="e.g. 25 mg/kg" value={dose} onChange={(e) => setDose(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-calcDose">Calculated Dose</Label>
              <Input id="edit-calcDose" placeholder="e.g. 500 mg" value={calculatedDose} onChange={(e) => setCalculatedDose(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Route *</Label>
            <Select value={route} onValueChange={(v) => setRoute(v ?? route)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select route" /></SelectTrigger>
              <SelectContent>
                {Object.entries(ROUTE_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Frequency *</Label>
            <Select value={frequency} onValueChange={(v) => {
              setFrequency(v ?? frequency);
              if (v && FREQUENCY_DEFAULT_TIMES[v]) setScheduledTimes([...FREQUENCY_DEFAULT_TIMES[v]]);
            }}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select frequency" /></SelectTrigger>
              <SelectContent>
                {Object.entries(FREQUENCY_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{key} — {label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Scheduled Times</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {scheduledTimes.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                  {t}
                  <button type="button" onClick={() => removeTime(t)} className="ml-0.5 text-gray-400 hover:text-gray-700" aria-label={`Remove ${t}`}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {scheduledTimes.length === 0 && <span className="text-xs text-gray-400">No times set</span>}
            </div>
            <div className="flex gap-2">
              <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="flex-1" />
              <Button type="button" variant="outline" size="sm" onClick={addTime}>Add</Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-medNotes">Notes</Label>
            <Textarea id="edit-medNotes" placeholder="Special instructions..." rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading}>{loading ? "Saving..." : "Update"}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MedsTab({
  admissionId,
  treatmentPlans,
  fluidTherapies,
  isDoctor,
  patientName,
}: MedsTabProps) {
  const [stoppedOpen, setStoppedOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<TreatmentPlan | null>(null);
  const today = getTodayIST();

  async function handleDeleteMed(planId: string) {
    try {
      const result = await deleteMedication(planId);
      if (result && "error" in result && result.error) toast.error(result.error);
      else toast.success("Medication deleted");
    } catch {
      toast.error("Failed to delete medication");
    }
  }

  const activeFluid = fluidTherapies.find((f) => f.isActive) ?? null;
  const activePlans = treatmentPlans.filter((p) => p.isActive);
  const stoppedPlans = treatmentPlans.filter((p) => !p.isActive);

  const scheduledPlans = activePlans.filter((p) => p.scheduledTimes.length > 0);
  const unscheduledPlans = activePlans.filter((p) => p.scheduledTimes.length === 0);

  const timeGroups = buildTimeGroups(scheduledPlans, today);

  const statusConfig = {
    completed: {
      label: "Completed",
      labelClass: "text-green-600 bg-green-50",
      headerClass: "border-green-100 bg-green-50/30",
    },
    overdue: {
      label: "OVERDUE",
      labelClass: "text-red-600 bg-red-50 font-bold",
      headerClass: "border-red-100 bg-red-50/30",
    },
    current: {
      label: "Pending",
      labelClass: "text-gray-700 bg-gray-50",
      headerClass: "border-gray-100 bg-gray-50/30",
    },
    upcoming: {
      label: "Upcoming",
      labelClass: "text-gray-400 bg-gray-50",
      headerClass: "border-gray-100",
    },
  } as const;

  return (
    <div className="space-y-1">
      {/* Active Fluid Therapy */}
      {activeFluid && <FluidCard fluid={activeFluid} isDoctor={isDoctor} />}

      {/* Start Fluids button (doctor, no active fluid) */}
      {isDoctor && !activeFluid && <StartFluidsButton admissionId={admissionId} />}

      {/* Medications header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">Medications</h2>
        {isDoctor && <PrescribeMedForm admissionId={admissionId} />}
      </div>

      {/* Empty state */}
      {activePlans.length === 0 && (
        <p className="py-6 text-center text-sm text-gray-400">
          No active medications
        </p>
      )}

      {/* Time-grouped scheduled meds */}
      {timeGroups.map((group) => {
        const status = getGroupStatus(group);
        const config = statusConfig[status];
        return (
          <div key={group.time} className="mb-4">
            <div
              className={cn(
                "flex items-center justify-between rounded-t-lg border-x border-t px-3 py-2",
                config.headerClass
              )}
            >
              <span className="text-sm font-semibold text-gray-800">
                {group.time}
              </span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs", config.labelClass)}>
                {config.label}
              </span>
            </div>
            <div className="rounded-b-lg border-x border-b border-gray-100 px-3 py-2">
              {group.slots.map((slot) => (
                <MedCheckoff
                  key={`${slot.treatmentPlan.id}-${slot.scheduledTime}`}
                  treatmentPlan={slot.treatmentPlan}
                  scheduledDate={today}
                  scheduledTime={slot.scheduledTime}
                  administration={slot.administration}
                  isDoctor={isDoctor}
                  patientName={patientName}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* PRN / unscheduled active meds */}
      {unscheduledPlans.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            As Needed / Other
          </p>
          {unscheduledPlans.map((plan) => (
            <ActivePlanSimpleRow
              key={plan.id}
              plan={plan}
              isDoctor={isDoctor}
              onEdit={() => setEditPlan(plan)}
              onDelete={() => handleDeleteMed(plan.id)}
            />
          ))}
        </div>
      )}

      {/* Stopped medications collapsible */}
      {stoppedPlans.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => setStoppedOpen((prev) => !prev)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Stopped Medications ({stoppedPlans.length})
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-gray-400 transition-transform",
                stoppedOpen && "rotate-180"
              )}
            />
          </button>
          {stoppedOpen && (
            <div className="mt-2">
              {stoppedPlans.map((plan) => (
                <StoppedMedRow key={plan.id} plan={plan} isDoctor={isDoctor} onDelete={() => handleDeleteMed(plan.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Medication Sheet */}
      {editPlan && (
        <EditMedSheet
          plan={editPlan}
          open={!!editPlan}
          onOpenChange={(open) => { if (!open) setEditPlan(null); }}
        />
      )}
    </div>
  );
}
