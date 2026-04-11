"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { toast } from "sonner";
import { driveMediaUrl } from "@/lib/drive-url";
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
import { Switch } from "@/components/ui/switch";
import {
  CONDITION_CONFIG,
  HANDLING_NOTE_LABELS,
  REGISTRATION_MODE_LABELS,
  SPAY_NEUTER_STATUS_LABELS,
  WARD_CONFIG,
} from "@/lib/constants";
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
    viralRisk: boolean | null;
    spayNeuterStatus: string | null;
    abcCandidate: boolean;
    patient: {
      id: string;
      patientNumber: string | null;
      name: string;
      breed: string | null;
      age: string | null;
      sex: string;
      weight: number | null;
      species: string;
      color: string | null;
      isStray: boolean;
      rescueLocation: string | null;
      locationGpsCoordinates: string | null;
      ambulancePersonName: string | null;
      handlingNote: string;
      registrationMode: string;
      registrationModeOther: string | null;
      rescuerInfo: string | null;
    };
  };
  isDoctor?: boolean;
  profilePhotoFileId?: string | null;
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
  const [isStray, setIsStray] = useState(patient.isStray);
  const [handlingNote, setHandlingNote] = useState(patient.handlingNote);
  const [registrationMode, setRegistrationMode] = useState(patient.registrationMode);

  useEffect(() => {
    if (!open) return;
    setSex(patient.sex);
    setIsStray(patient.isStray);
    setHandlingNote(patient.handlingNote);
    setRegistrationMode(patient.registrationMode);
  }, [open, patient.handlingNote, patient.isStray, patient.registrationMode, patient.sex]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.set("sex", sex);
    formData.set("isStray", String(isStray));
    formData.set("handlingNote", handlingNote);
    formData.set("registrationMode", registrationMode);
    if (registrationMode === "OTHER") {
      const otherInput = e.currentTarget.querySelector<HTMLInputElement>('[name="registrationModeOther"]');
      if (otherInput?.value) formData.set("registrationModeOther", otherInput.value);
    }
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
          <input type="hidden" name="isStray" value={String(isStray)} />
          <input type="hidden" name="handlingNote" value={handlingNote} />
          <input type="hidden" name="registrationMode" value={registrationMode} />
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
          <div className="space-y-1.5">
            <Label htmlFor="ep-ambulance">Ambulance Person Name</Label>
            <Input
              id="ep-ambulance"
              name="ambulancePersonName"
              defaultValue={patient.ambulancePersonName ?? ""}
              className="h-12"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-rescue">Rescue Location</Label>
            <Input
              id="ep-rescue"
              name="rescueLocation"
              defaultValue={patient.rescueLocation ?? ""}
              className="h-12"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-gps">GPS Coordinates</Label>
            <Input
              id="ep-gps"
              name="locationGpsCoordinates"
              defaultValue={patient.locationGpsCoordinates ?? ""}
              className="h-12"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Handling Note</Label>
            <Select
              value={handlingNote}
              onValueChange={(value) => setHandlingNote(value ?? "STANDARD")}
            >
              <SelectTrigger className="w-full h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="min-w-[16rem]" align="start">
                {Object.entries(HANDLING_NOTE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Mode of Registration</Label>
            <Select
              value={registrationMode}
              onValueChange={(v) => setRegistrationMode(v ?? "AMBULANCE")}
            >
              <SelectTrigger className="w-full h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="min-w-[16rem]" align="start">
                <SelectItem value="WALK_IN">Walk-in</SelectItem>
                <SelectItem value="AMBULANCE">Always Care Ambulance</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {registrationMode === "OTHER" && (
            <div className="space-y-1.5">
              <Label htmlFor="ep-registrationModeOther">Specify Mode</Label>
              <Input
                id="ep-registrationModeOther"
                name="registrationModeOther"
                defaultValue={patient.registrationModeOther ?? ""}
                className="h-12"
              />
            </div>
          )}
          <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Stray animal</Label>
              <p className="text-xs text-muted-foreground">
                Toggle when the patient arrived without a caretaker.
              </p>
            </div>
            <Switch checked={isStray} onCheckedChange={setIsStray} />
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
  const [viralRisk, setViralRisk] = useState(
    admission.viralRisk === null ? "" : admission.viralRisk ? "YES" : "NO"
  );
  const [spayNeuterStatus, setSpayNeuterStatus] = useState(
    admission.spayNeuterStatus ?? "UNKNOWN"
  );
  const [abcCandidate, setAbcCandidate] = useState(admission.abcCandidate);

  useEffect(() => {
    if (!open) return;
    setViralRisk(
      admission.viralRisk === null ? "" : admission.viralRisk ? "YES" : "NO"
    );
    setSpayNeuterStatus(admission.spayNeuterStatus ?? "UNKNOWN");
    setAbcCandidate(admission.abcCandidate);
  }, [
    admission.abcCandidate,
    admission.spayNeuterStatus,
    admission.viralRisk,
    open,
  ]);

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
          <input type="hidden" name="viralRisk" value={viralRisk} />
          <input
            type="hidden"
            name="spayNeuterStatus"
            value={spayNeuterStatus}
          />
          <input
            type="hidden"
            name="abcCandidate"
            value={String(abcCandidate)}
          />
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Viral Risk</Label>
              <Select value={viralRisk} onValueChange={(value) => setViralRisk(value ?? "")}>
                <SelectTrigger className="w-full h-12">
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="YES">Yes</SelectItem>
                  <SelectItem value="NO">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Spay / Neuter Status</Label>
              <Select
                value={spayNeuterStatus}
                onValueChange={(value) =>
                  setSpayNeuterStatus(value ?? "UNKNOWN")
                }
              >
                <SelectTrigger className="w-full h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SPAY_NEUTER_STATUS_LABELS).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">ABC Candidate</Label>
              <p className="text-xs text-muted-foreground">
                Keep this visible for the ABC workflow when needed.
              </p>
            </div>
            <Switch checked={abcCandidate} onCheckedChange={setAbcCandidate} />
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

export function PatientHeader({ admission, isDoctor, profilePhotoFileId }: PatientHeaderProps) {
  const { patient } = admission;
  const conditionCfg = admission.condition ? CONDITION_CONFIG[admission.condition] : null;
  const wardCfg = admission.ward ? WARD_CONFIG[admission.ward] : null;
  const daysIn = daysSince(admission.admissionDate);
  const [editPatientOpen, setEditPatientOpen] = useState(false);
  const [editAdmissionOpen, setEditAdmissionOpen] = useState(false);

  const sexLabel =
    patient.sex === "MALE" ? "M" : patient.sex === "FEMALE" ? "F" : "?";
  const handlingNoteLabel =
    HANDLING_NOTE_LABELS[patient.handlingNote] ?? "Standard";
  const spayNeuterLabel = admission.spayNeuterStatus
    ? SPAY_NEUTER_STATUS_LABELS[admission.spayNeuterStatus] ??
      admission.spayNeuterStatus
    : null;
  const registrationModeLabel =
    REGISTRATION_MODE_LABELS[patient.registrationMode] ?? patient.registrationMode;
  const registrationModeDisplay =
    patient.registrationMode === "OTHER" && patient.registrationModeOther
      ? `${registrationModeLabel} (${patient.registrationModeOther})`
      : registrationModeLabel;

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
        {/* Photo / placeholder */}
        {profilePhotoFileId ? (
          <img
            src={driveMediaUrl(profilePhotoFileId)}
            alt={patient.name}
            className="w-12 h-12 rounded-lg object-cover shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-xl shrink-0">
            🐾
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-clinic-teal">
            {patient.patientNumber ?? "Number pending"}
          </p>
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
            <Badge
              className="text-xs font-medium border border-sky-200 bg-sky-50 text-sky-700"
              variant="outline"
            >
              {handlingNoteLabel}
            </Badge>
            {admission.viralRisk !== null && (
              <Badge
                className={cn(
                  "text-xs font-medium border",
                  admission.viralRisk
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                )}
                variant="outline"
              >
                Viral risk: {admission.viralRisk ? "Yes" : "No"}
              </Badge>
            )}
            {admission.abcCandidate && (
              <Badge
                className="text-xs font-medium border border-violet-200 bg-violet-50 text-violet-700"
                variant="outline"
              >
                ABC candidate
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

          {(spayNeuterLabel ||
            patient.registrationMode ||
            patient.ambulancePersonName ||
            patient.rescueLocation) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
              <span>Registration: {registrationModeDisplay}</span>
              {spayNeuterLabel && <span>Spay / neuter: {spayNeuterLabel}</span>}
              {patient.ambulancePersonName && (
                <span>Ambulance: {patient.ambulancePersonName}</span>
              )}
              {patient.rescueLocation && (
                <span>Rescue location: {patient.rescueLocation}</span>
              )}
            </div>
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
