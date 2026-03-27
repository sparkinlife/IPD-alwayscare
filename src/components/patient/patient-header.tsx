"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CONDITION_CONFIG, WARD_CONFIG } from "@/lib/constants";
import { daysSince, formatIST } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { updatePatient, updateAdmission } from "@/actions/admissions";

interface PatientHeaderProps {
  admission: {
    id: string;
    admissionDate: Date;
    ward: string | null;
    cageNumber: string | null;
    condition: string | null;
    diagnosis: string | null;
    chiefComplaint: string | null;
    diagnosisNotes: string | null;
    attendingDoctor: string | null;
    patient: {
      id: string;
      name: string;
      breed: string | null;
      age: string | null;
      sex: string;
      weight: number | null;
      species: string;
      color: string | null;
      isStray: boolean;
      rescueLocation: string | null;
      rescuerInfo: string | null;
    };
  };
  isDoctor?: boolean;
}

// ─── Edit Patient Sheet ──────────────────────────────────────────────────────

function EditPatientSheet({
  patient,
  open,
  onOpenChange,
}: {
  patient: PatientHeaderProps["admission"]["patient"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [sex, setSex] = useState(patient.sex);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.set("sex", sex);
    try {
      const result = await updatePatient(patient.id, formData);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Patient info updated");
        onOpenChange(false);
      }
    } catch {
      toast.error("Failed to update patient");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto pb-safe">
        <SheetHeader>
          <SheetTitle>Edit Patient</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="px-4 pb-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ep-name">Name *</Label>
            <Input id="ep-name" name="name" defaultValue={patient.name} required className="h-12" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ep-breed">Breed</Label>
              <Input id="ep-breed" name="breed" defaultValue={patient.breed ?? ""} className="h-12" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-age">Age</Label>
              <Input id="ep-age" name="age" defaultValue={patient.age ?? ""} className="h-12" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ep-weight">Weight (kg)</Label>
              <Input id="ep-weight" name="weight" type="number" step="0.1" defaultValue={patient.weight ?? ""} className="h-12" />
            </div>
            <div className="space-y-1.5">
              <Label>Sex</Label>
              <Select value={sex} onValueChange={(v) => setSex(v ?? sex)}>
                <SelectTrigger className="w-full h-12">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                  <SelectItem value="UNKNOWN">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-color">Color</Label>
            <Input id="ep-color" name="color" defaultValue={patient.color ?? ""} className="h-12" />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="isStray" defaultChecked={patient.isStray} className="h-4 w-4 rounded border-gray-300" />
              <span className="text-sm">Stray animal</span>
            </label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-rescue">Rescue Location</Label>
            <Input id="ep-rescue" name="rescueLocation" defaultValue={patient.rescueLocation ?? ""} className="h-12" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-rescuer">Rescuer Info</Label>
            <Input id="ep-rescuer" name="rescuerInfo" defaultValue={patient.rescuerInfo ?? ""} className="h-12" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading}>{loading ? "Saving..." : "Update Patient"}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Edit Admission Sheet ────────────────────────────────────────────────────

function EditAdmissionSheet({
  admission,
  open,
  onOpenChange,
}: {
  admission: PatientHeaderProps["admission"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      const result = await updateAdmission(admission.id, formData);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Admission info updated");
        onOpenChange(false);
      }
    } catch {
      toast.error("Failed to update admission");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto pb-safe">
        <SheetHeader>
          <SheetTitle>Edit Admission</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="px-4 pb-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ea-diagnosis">Diagnosis</Label>
            <Input id="ea-diagnosis" name="diagnosis" defaultValue={admission.diagnosis ?? ""} className="h-12" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ea-complaint">Chief Complaint</Label>
            <Input id="ea-complaint" name="chiefComplaint" defaultValue={admission.chiefComplaint ?? ""} className="h-12" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ea-diagNotes">Diagnosis Notes</Label>
            <Textarea id="ea-diagNotes" name="diagnosisNotes" rows={3} defaultValue={admission.diagnosisNotes ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ea-doctor">Attending Doctor</Label>
            <Input id="ea-doctor" name="attendingDoctor" defaultValue={admission.attendingDoctor ?? ""} className="h-12" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading}>{loading ? "Saving..." : "Update Admission"}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function PatientHeader({ admission, isDoctor }: PatientHeaderProps) {
  const { patient } = admission;
  const conditionCfg = admission.condition ? CONDITION_CONFIG[admission.condition] : null;
  const wardCfg = admission.ward ? WARD_CONFIG[admission.ward] : null;
  const daysIn = daysSince(admission.admissionDate);
  const [editPatientOpen, setEditPatientOpen] = useState(false);
  const [editAdmissionOpen, setEditAdmissionOpen] = useState(false);

  const sexLabel =
    patient.sex === "MALE" ? "M" : patient.sex === "FEMALE" ? "F" : "?";

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      {/* Back button */}
      <div className="flex items-center justify-between mb-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to dashboard
        </Link>
        {isDoctor && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setEditPatientOpen(true)}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"
            >
              <Pencil className="w-3 h-3" />
              Patient
            </button>
            <button
              type="button"
              onClick={() => setEditAdmissionOpen(true)}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"
            >
              <Pencil className="w-3 h-3" />
              Admission
            </button>
          </div>
        )}
      </div>

      {/* Main row */}
      <div className="flex items-start gap-3">
        {/* Photo placeholder */}
        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-xl shrink-0">
          {"\uD83D\uDC3E"}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Name + breed/age/sex */}
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-base font-bold text-gray-900 leading-tight">
              {patient.name}
            </span>
            {patient.breed && (
              <span className="text-sm text-gray-500">{patient.breed}</span>
            )}
            {patient.age && (
              <span className="text-sm text-gray-500">{patient.age}</span>
            )}
            <span className="text-sm text-gray-500">{sexLabel}</span>
          </div>

          {/* Weight */}
          {patient.weight != null && (
            <p className="text-sm text-gray-600 mt-0.5">{patient.weight} kg</p>
          )}

          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {conditionCfg && (
              <Badge
                className={cn(
                  "text-xs font-medium border",
                  conditionCfg.color,
                  conditionCfg.bg,
                  conditionCfg.border
                )}
                variant="outline"
              >
                {conditionCfg.label}
              </Badge>
            )}
            {wardCfg && (
              <Badge
                className={cn(
                  "text-xs font-medium",
                  wardCfg.color,
                  wardCfg.bg
                )}
                variant="outline"
              >
                {wardCfg.label}
              </Badge>
            )}
            {admission.cageNumber && (
              <span className="text-xs text-gray-500 font-medium">
                Cage {admission.cageNumber}
              </span>
            )}
          </div>

          {/* Diagnosis */}
          {admission.diagnosis && (
            <p className="text-sm text-gray-700 mt-1 font-medium">
              {admission.diagnosis}
            </p>
          )}

          {/* Bottom row: day count + doctor + admission date */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
            <span className="font-semibold text-clinic-teal">
              Day {daysIn === 0 ? 1 : daysIn + 1}
            </span>
            {admission.attendingDoctor && (
              <span>Dr. {admission.attendingDoctor}</span>
            )}
            <span>Admitted {formatIST(admission.admissionDate)}</span>
          </div>
        </div>
      </div>

      {/* Edit sheets */}
      {isDoctor && (
        <>
          <EditPatientSheet
            patient={patient}
            open={editPatientOpen}
            onOpenChange={setEditPatientOpen}
          />
          <EditAdmissionSheet
            admission={admission}
            open={editAdmissionOpen}
            onOpenChange={setEditAdmissionOpen}
          />
        </>
      )}
    </div>
  );
}
