"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardList, Pencil, Trash2 } from "lucide-react";
import { formatRelative } from "@/lib/date-utils";
import { cancelRegistration, editRegisteredPatient } from "@/actions/admissions";
import { HANDLING_NOTE_LABELS, REGISTRATION_MODE_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface RegisteredAdmission {
  id: string;
  admissionDate: Date;
  patient: {
    id: string;
    patientNumber: string | null;
    name: string;
    species: string;
    breed: string | null;
    age: string | null;
    weight: number | null;
    sex: string;
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
  admittedBy: { name: string };
}

interface PendingSetupProps {
  admissions: RegisteredAdmission[];
  isDoctor: boolean;
}

/* ------------------------------------------------------------------ */
/*  Edit Sheet                                                         */
/* ------------------------------------------------------------------ */

function EditRegisteredSheet({
  admission,
  open,
  onOpenChange,
}: {
  admission: RegisteredAdmission;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [species, setSpecies] = React.useState(admission.patient.species);
  const [sex, setSex] = React.useState(admission.patient.sex);
  const [isStray, setIsStray] = React.useState(admission.patient.isStray);
  const [handlingNote, setHandlingNote] = React.useState(
    admission.patient.handlingNote
  );
  const [registrationMode, setRegistrationMode] = React.useState(
    admission.patient.registrationMode
  );

  // Reset form state when sheet opens with fresh admission data
  React.useEffect(() => {
    if (open) {
      setSpecies(admission.patient.species);
      setSex(admission.patient.sex);
      setIsStray(admission.patient.isStray);
      setHandlingNote(admission.patient.handlingNote);
      setRegistrationMode(admission.patient.registrationMode);
      setError(null);
    }
  }, [open, admission]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("species", species);
    formData.set("sex", sex);
    formData.set("isStray", String(isStray));
    formData.set("handlingNote", handlingNote);
    formData.set("registrationMode", registrationMode);
    if (registrationMode === "OTHER") {
      const otherInput = e.currentTarget.querySelector<HTMLInputElement>('[name="registrationModeOther"]');
      if (otherInput?.value) formData.set("registrationModeOther", otherInput.value);
    }

    const result = await editRegisteredPatient(admission.id, formData);
    setLoading(false);

    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Patient</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pb-4">
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="edit-name"
              name="name"
              required
              defaultValue={admission.patient.name}
            />
          </div>

          {/* Species + Sex */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Species</Label>
              <Select value={species} onValueChange={(v) => setSpecies(v ?? "DOG")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DOG">Dog</SelectItem>
                  <SelectItem value="CAT">Cat</SelectItem>
                  <SelectItem value="BIRD">Bird</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Sex</Label>
              <Select value={sex} onValueChange={(v) => setSex(v ?? "UNKNOWN")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                  <SelectItem value="UNKNOWN">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Breed */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-breed">Breed</Label>
            <Input
              id="edit-breed"
              name="breed"
              defaultValue={admission.patient.breed ?? ""}
            />
          </div>

          {/* Age + Weight */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-age">Age</Label>
              <Input
                id="edit-age"
                name="age"
                defaultValue={admission.patient.age ?? ""}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-weight">Weight (kg)</Label>
              <Input
                id="edit-weight"
                name="weight"
                type="number"
                step="0.1"
                min="0"
                defaultValue={admission.patient.weight ?? ""}
              />
            </div>
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-color">Color / Markings</Label>
            <Input
              id="edit-color"
              name="color"
              defaultValue={admission.patient.color ?? ""}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-ambulancePersonName">Ambulance Person Name</Label>
            <Input
              id="edit-ambulancePersonName"
              name="ambulancePersonName"
              defaultValue={admission.patient.ambulancePersonName ?? ""}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-rescueLocation">Rescue Location</Label>
            <Input
              id="edit-rescueLocation"
              name="rescueLocation"
              defaultValue={admission.patient.rescueLocation ?? ""}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-locationGpsCoordinates">GPS Coordinates</Label>
            <Input
              id="edit-locationGpsCoordinates"
              name="locationGpsCoordinates"
              defaultValue={admission.patient.locationGpsCoordinates ?? ""}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-rescuerInfo">Rescuer Info</Label>
            <Input
              id="edit-rescuerInfo"
              name="rescuerInfo"
              defaultValue={admission.patient.rescuerInfo ?? ""}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Handling Note</Label>
            <Select
              value={handlingNote}
              onValueChange={(value) => setHandlingNote(value ?? "STANDARD")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="min-w-[16rem]" align="start">
                <SelectItem value="STANDARD">Standard</SelectItem>
                <SelectItem value="GENTLE">Gentle</SelectItem>
                <SelectItem value="ADVANCED_HANDLER_ONLY">
                  Advanced handler only
                </SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" name="handlingNote" value={handlingNote} />
          </div>

          <div className="space-y-1.5">
            <Label>Mode of Registration</Label>
            <Select
              value={registrationMode}
              onValueChange={(v) => setRegistrationMode(v ?? "AMBULANCE")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WALK_IN">Walk-in</SelectItem>
                <SelectItem value="AMBULANCE">Always Care Ambulance</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" name="registrationMode" value={registrationMode} />
          </div>

          {registrationMode === "OTHER" && (
            <div className="space-y-1.5">
              <Label htmlFor="edit-registrationModeOther">Specify Mode</Label>
              <Input
                id="edit-registrationModeOther"
                name="registrationModeOther"
                defaultValue={admission.patient.registrationModeOther ?? ""}
              />
            </div>
          )}

          {/* Is Stray */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Stray animal?</p>
            </div>
            <Switch checked={isStray} onCheckedChange={setIsStray} />
          </div>

          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/*  Cancel Dialog                                                      */
/* ------------------------------------------------------------------ */

function CancelRegistrationDialog({
  admission,
  open,
  onOpenChange,
}: {
  admission: RegisteredAdmission;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) setError(null);
  }, [open]);

  async function handleDelete() {
    setLoading(true);
    setError(null);

    const result = await cancelRegistration(admission.id);
    setLoading(false);

    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Registration</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          This will permanently remove{" "}
          <span className="font-semibold text-foreground">
            {admission.patient.name}
          </span>{" "}
          from the system.
        </p>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function PendingSetup({ admissions, isDoctor }: PendingSetupProps) {
  const [editAdmission, setEditAdmission] =
    React.useState<RegisteredAdmission | null>(null);
  const [cancelAdmission, setCancelAdmission] =
    React.useState<RegisteredAdmission | null>(null);

  if (admissions.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <ClipboardList className="h-5 w-5 shrink-0 text-amber-600" />
        <span className="font-semibold text-amber-800">
          Awaiting Clinical Setup
        </span>
        <span className="ml-auto rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
          {admissions.length}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {admissions.map((admission) => (
          <div
            key={admission.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-white/70 px-3 py-2.5 ring-1 ring-amber-200"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {admission.patient.name}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {admission.patient.patientNumber ?? "Number pending"}
                {" · "}
                {HANDLING_NOTE_LABELS[admission.patient.handlingNote] ?? "Standard"}
                {" · "}
                {REGISTRATION_MODE_LABELS[admission.patient.registrationMode] ?? admission.patient.registrationMode}
                {admission.patient.registrationMode === "OTHER" && admission.patient.registrationModeOther
                  ? ` (${admission.patient.registrationModeOther})`
                  : ""}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {[
                  admission.patient.breed,
                  admission.patient.age,
                  admission.patient.weight
                    ? `${admission.patient.weight} kg`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="text-xs text-muted-foreground">
                Registered by {admission.admittedBy.name} &middot;{" "}
                {formatRelative(admission.admissionDate)}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setEditAdmission(admission)}
                aria-label={`Edit ${admission.patient.name}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setCancelAdmission(admission)}
                aria-label={`Cancel registration for ${admission.patient.name}`}
              >
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </Button>

              {isDoctor && (
                <Link
                  href={`/patients/${admission.id}/setup`}
                  className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-600 active:bg-amber-700"
                >
                  Complete Setup
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Sheet */}
      {editAdmission && (
        <EditRegisteredSheet
          admission={editAdmission}
          open={!!editAdmission}
          onOpenChange={(open) => {
            if (!open) setEditAdmission(null);
          }}
        />
      )}

      {/* Cancel Dialog */}
      {cancelAdmission && (
        <CancelRegistrationDialog
          admission={cancelAdmission}
          open={!!cancelAdmission}
          onOpenChange={(open) => {
            if (!open) setCancelAdmission(null);
          }}
        />
      )}
    </div>
  );
}
