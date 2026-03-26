"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
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
import {
  COMMON_DRUGS,
  ROUTE_LABELS,
  FREQUENCY_LABELS,
  FREQUENCY_DEFAULT_TIMES,
} from "@/lib/constants";
import { prescribeMedication } from "@/actions/medications";

interface PrescribeMedFormProps {
  admissionId: string;
}

export function PrescribeMedForm({ admissionId }: PrescribeMedFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [drugName, setDrugName] = useState("");
  const [dose, setDose] = useState("");
  const [calculatedDose, setCalculatedDose] = useState("");
  const [route, setRoute] = useState("");
  const [frequency, setFrequency] = useState("");
  const [scheduledTimes, setScheduledTimes] = useState<string[]>([]);
  const [newTime, setNewTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  // Auto-populate scheduled times when frequency changes
  useEffect(() => {
    if (frequency && FREQUENCY_DEFAULT_TIMES[frequency]) {
      setScheduledTimes([...FREQUENCY_DEFAULT_TIMES[frequency]]);
    }
  }, [frequency]);

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

  function resetForm() {
    setDrugName("");
    setDose("");
    setCalculatedDose("");
    setRoute("");
    setFrequency("");
    setScheduledTimes([]);
    setNewTime("");
    setEndDate("");
    setNotes("");
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
      formData.set("endDate", endDate);
      formData.set("notes", notes);

      const result = await prescribeMedication(admissionId, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Medication prescribed");
        resetForm();
        setOpen(false);
      }
    } catch {
      toast.error("Failed to prescribe medication");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <SheetTrigger
        render={
          <Button size="sm" className="gap-1.5" />
        }
      >
        <Plus className="h-4 w-4" />
        Add Medication
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto pb-8">
        <SheetHeader>
          <SheetTitle>Prescribe Medication</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 px-1">
          {/* Drug Name */}
          <div className="space-y-1.5">
            <Label htmlFor="drugName">Drug Name *</Label>
            <Input
              id="drugName"
              list="drug-suggestions"
              placeholder="e.g. Ceftriaxone"
              value={drugName}
              onChange={(e) => setDrugName(e.target.value)}
              required
            />
            <datalist id="drug-suggestions">
              {COMMON_DRUGS.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>

          {/* Dose */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dose">Dose *</Label>
              <Input
                id="dose"
                placeholder="e.g. 25 mg/kg"
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="calculatedDose">Calculated Dose</Label>
              <Input
                id="calculatedDose"
                placeholder="e.g. 500 mg"
                value={calculatedDose}
                onChange={(e) => setCalculatedDose(e.target.value)}
              />
            </div>
          </div>

          {/* Route */}
          <div className="space-y-1.5">
            <Label>Route *</Label>
            <Select value={route} onValueChange={(v) => setRoute(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select route" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROUTE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Frequency */}
          <div className="space-y-1.5">
            <Label>Frequency *</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {key} — {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Scheduled Times */}
          <div className="space-y-1.5">
            <Label>Scheduled Times</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {scheduledTimes.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTime(t)}
                    className="ml-0.5 text-gray-400 hover:text-gray-700"
                    aria-label={`Remove ${t}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {scheduledTimes.length === 0 && (
                <span className="text-xs text-gray-400">No times set</span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={addTime}>
                Add
              </Button>
            </div>
          </div>

          {/* End Date */}
          <div className="space-y-1.5">
            <Label htmlFor="endDate">End Date (optional)</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Special instructions..."
              rows={2}
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
              {loading ? "Prescribing..." : "Prescribe"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
