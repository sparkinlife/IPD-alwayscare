"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IsolationSetupForm } from "@/components/forms/isolation-setup-form";
import { clinicalSetup } from "@/actions/admissions";
import {
  FREQUENCY_LABELS,
  FREQUENCY_DEFAULT_TIMES,
  ROUTE_LABELS,
  COMMON_DRUGS,
} from "@/lib/constants";

interface Medication {
  drugName: string;
  dose: string;
  route: string;
  frequency: string;
  scheduledTimes: string[];
  notes: string;
}

interface FeedingScheduleEntry {
  scheduledTime: string;
  foodType: string;
  portion: string;
}

interface ClinicalSetupFormProps {
  admissionId: string;
  availableCages: Array<{ ward: string; cageNumber: string }>;
  activeDoctors: Array<{ id: string; name: string }>;
}

const emptyMed = (): Medication => ({
  drugName: "",
  dose: "",
  route: "PO",
  frequency: "SID",
  scheduledTimes: FREQUENCY_DEFAULT_TIMES["SID"],
  notes: "",
});

const emptyFeeding = (): FeedingScheduleEntry => ({
  scheduledTime: "08:00",
  foodType: "",
  portion: "",
});

export function ClinicalSetupForm({
  admissionId,
  availableCages,
  activeDoctors,
}: ClinicalSetupFormProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  // Core fields
  const [diagnosis, setDiagnosis] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [diagnosisNotes, setDiagnosisNotes] = useState("");
  const [ward, setWard] = useState("");
  const [cageNumber, setCageNumber] = useState("");
  const [condition, setCondition] = useState("");
  const [attendingDoctor, setAttendingDoctor] = useState("");

  // Treatment toggle
  const [showTreatment, setShowTreatment] = useState(false);

  // Medications
  const [medications, setMedications] = useState<Medication[]>([]);

  // Fluid therapy
  const [fluidType, setFluidType] = useState("");
  const [fluidRate, setFluidRate] = useState("");
  const [fluidAdditives, setFluidAdditives] = useState("");

  // Diet plan
  const [dietType, setDietType] = useState("");
  const [dietInstructions, setDietInstructions] = useState("");
  const [feedingSchedules, setFeedingSchedules] = useState<FeedingScheduleEntry[]>([]);

  // Initial notes
  const [initialNotes, setInitialNotes] = useState("");

  // Isolation protocol
  const [disease, setDisease] = useState("");
  const [ppeRequired, setPpeRequired] = useState<string[]>([]);
  const [disinfectant, setDisinfectant] = useState("Quaternary ammonium compound");
  const [disinfectionInterval, setDisinfectionInterval] = useState("Q4H");
  const [biosecurityNotes, setBiosecurityNotes] = useState("");

  // Filter cages by selected ward
  const cagesForWard = ward
    ? availableCages.filter((c) => c.ward === ward)
    : availableCages;

  // ── Medication helpers ──────────────────────────────────────────────────

  function addMedication() {
    setMedications((prev) => [...prev, emptyMed()]);
  }

  function removeMedication(index: number) {
    setMedications((prev) => prev.filter((_, i) => i !== index));
  }

  function updateMed<K extends keyof Medication>(
    index: number,
    key: K,
    value: Medication[K]
  ) {
    setMedications((prev) =>
      prev.map((m, i) => {
        if (i !== index) return m;
        const updated = { ...m, [key]: value };
        // Auto-populate scheduled times when frequency changes
        if (key === "frequency") {
          updated.scheduledTimes =
            FREQUENCY_DEFAULT_TIMES[value as string] ?? [];
        }
        return updated;
      })
    );
  }

  function updateScheduledTime(medIndex: number, timeIndex: number, value: string) {
    setMedications((prev) =>
      prev.map((m, i) => {
        if (i !== medIndex) return m;
        const newTimes = [...m.scheduledTimes];
        newTimes[timeIndex] = value;
        return { ...m, scheduledTimes: newTimes };
      })
    );
  }

  // ── Feeding schedule helpers ────────────────────────────────────────────

  function addFeeding() {
    setFeedingSchedules((prev) => [...prev, emptyFeeding()]);
  }

  function removeFeeding(index: number) {
    setFeedingSchedules((prev) => prev.filter((_, i) => i !== index));
  }

  function updateFeeding<K extends keyof FeedingScheduleEntry>(
    index: number,
    key: K,
    value: FeedingScheduleEntry[K]
  ) {
    setFeedingSchedules((prev) =>
      prev.map((f, i) => (i === index ? { ...f, [key]: value } : f))
    );
  }

  // ── Form submission ─────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!diagnosis || !ward || !cageNumber || !condition || !attendingDoctor) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (ward === "ISOLATION" && !disease) {
      toast.error("Disease name is required for isolation ward");
      return;
    }

    setIsPending(true);

    const formData = new FormData(e.currentTarget);

    // Serialize dynamic arrays as JSON
    if (medications.length > 0) {
      formData.set(
        "medications",
        JSON.stringify(
          medications.map((m) => ({
            drugName: m.drugName,
            dose: m.dose,
            route: m.route,
            frequency: m.frequency,
            scheduledTimes: m.scheduledTimes,
            notes: m.notes || undefined,
          }))
        )
      );
    }

    if (feedingSchedules.length > 0) {
      formData.set("feedingSchedules", JSON.stringify(feedingSchedules));
    }

    if (ward === "ISOLATION" && ppeRequired.length > 0) {
      formData.set("ppeRequired", JSON.stringify(ppeRequired));
    }

    try {
      const result = await clinicalSetup(admissionId, formData);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        setIsPending(false);
      }
      // On success the server action redirects — no need to navigate here
    } catch (error) {
      // redirect() throws in server actions on success.
      if (
        error &&
        typeof error === "object" &&
        "digest" in error &&
        typeof (error as { digest?: unknown }).digest === "string" &&
        (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
      ) {
        return;
      }
      setIsPending(false);
      toast.error("Failed to complete admission. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* ── Core clinical fields ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clinical Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Hidden controlled values */}
          <input type="hidden" name="ward" value={ward} />
          <input type="hidden" name="cageNumber" value={cageNumber} />
          <input type="hidden" name="condition" value={condition} />
          <input type="hidden" name="attendingDoctor" value={attendingDoctor} />
          {ward === "ISOLATION" && (
            <>
              <input type="hidden" name="disease" value={disease} />
              <input type="hidden" name="disinfectant" value={disinfectant} />
              <input type="hidden" name="disinfectionInterval" value={disinfectionInterval} />
            </>
          )}

          {/* Diagnosis */}
          <div className="space-y-1.5">
            <Label htmlFor="diagnosis">
              Diagnosis <span className="text-red-500">*</span>
            </Label>
            <Input
              id="diagnosis"
              name="diagnosis"
              required
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="e.g., Canine Parvovirus"
              className="h-11"
            />
          </div>

          {/* Chief Complaint */}
          <div className="space-y-1.5">
            <Label htmlFor="chiefComplaint">Chief Complaint</Label>
            <Input
              id="chiefComplaint"
              name="chiefComplaint"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="e.g., Vomiting and lethargy for 3 days"
              className="h-11"
            />
          </div>

          {/* Diagnosis Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="diagnosisNotes">Diagnosis Notes</Label>
            <Textarea
              id="diagnosisNotes"
              name="diagnosisNotes"
              value={diagnosisNotes}
              onChange={(e) => setDiagnosisNotes(e.target.value)}
              placeholder="Additional clinical findings..."
              rows={3}
            />
          </div>

          {/* Ward + Cage */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>
                Ward <span className="text-red-500">*</span>
              </Label>
              <Select
                value={ward}
                onValueChange={(v) => {
                  setWard(v ?? "");
                  setCageNumber(""); // Reset cage when ward changes
                }}
              >
                <SelectTrigger className="h-11">
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
              <Label>
                Cage Number <span className="text-red-500">*</span>
              </Label>
              <Select
                value={cageNumber}
                onValueChange={(v) => setCageNumber(v ?? "")}
                disabled={!ward}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder={ward ? "Select cage" : "Select ward first"} />
                </SelectTrigger>
                <SelectContent>
                  {cagesForWard.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      No available cages
                    </SelectItem>
                  ) : (
                    cagesForWard.map((c) => (
                      <SelectItem key={c.cageNumber} value={c.cageNumber}>
                        {c.cageNumber}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Condition + Attending Doctor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>
                Initial Condition <span className="text-red-500">*</span>
              </Label>
              <Select value={condition} onValueChange={(v) => setCondition(v ?? "")}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="GUARDED">Guarded</SelectItem>
                  <SelectItem value="STABLE">Stable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>
                Attending Doctor <span className="text-red-500">*</span>
              </Label>
              <Select value={attendingDoctor} onValueChange={(v) => setAttendingDoctor(v ?? "")}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select doctor" />
                </SelectTrigger>
                <SelectContent>
                  {activeDoctors.map((d) => (
                    <SelectItem key={d.id} value={d.name}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Isolation Protocol ────────────────────────────────────────── */}
      {ward === "ISOLATION" && (
        <IsolationSetupForm
          disease={disease}
          onDiseaseChange={setDisease}
          ppeRequired={ppeRequired}
          onPpeChange={setPpeRequired}
          disinfectant={disinfectant}
          onDisinfectantChange={setDisinfectant}
          disinfectionInterval={disinfectionInterval}
          onDisinfectionIntervalChange={setDisinfectionInterval}
          biosecurityNotes={biosecurityNotes}
          onBiosecurityNotesChange={setBiosecurityNotes}
        />
      )}
      {ward === "ISOLATION" && (
        <input type="hidden" name="biosecurityNotes" value={biosecurityNotes} />
      )}

      {/* ── Initial Treatment (collapsible) ──────────────────────────── */}
      <div>
        <button
          type="button"
          onClick={() => setShowTreatment((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <span>
            {showTreatment ? "Hide" : "Add"} Initial Treatment
          </span>
          <span className="text-lg leading-none">{showTreatment ? "−" : "+"}</span>
        </button>

        {showTreatment && (
          <div className="mt-4 space-y-5">
            {/* ── Medications ──────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Medications</CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addMedication}
                  >
                    + Add Medication
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {medications.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No medications added yet.
                  </p>
                )}
                {medications.map((med, idx) => (
                  <div
                    key={idx}
                    className="space-y-3 rounded-lg border p-4 bg-gray-50 relative"
                  >
                    <button
                      type="button"
                      onClick={() => removeMedication(idx)}
                      className="absolute right-3 top-3 text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Medication {idx + 1}
                    </p>

                    {/* Drug Name */}
                    <div className="space-y-1.5">
                      <Label>Drug Name</Label>
                      <Input
                        list={`drugs-${idx}`}
                        value={med.drugName}
                        onChange={(e) => updateMed(idx, "drugName", e.target.value)}
                        placeholder="e.g., Ceftriaxone"
                        className="h-10 bg-white"
                      />
                      <datalist id={`drugs-${idx}`}>
                        {COMMON_DRUGS.map((d) => (
                          <option key={d} value={d} />
                        ))}
                      </datalist>
                    </div>

                    {/* Dose + Route */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Dose</Label>
                        <Input
                          value={med.dose}
                          onChange={(e) => updateMed(idx, "dose", e.target.value)}
                          placeholder="e.g., 50mg/kg"
                          className="h-10 bg-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Route</Label>
                        <Select
                          value={med.route}
                          onValueChange={(v) => { if (v) updateMed(idx, "route", v); }}
                        >
                          <SelectTrigger className="h-10 bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ROUTE_LABELS).map(([k, label]) => (
                              <SelectItem key={k} value={k}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Frequency */}
                    <div className="space-y-1.5">
                      <Label>Frequency</Label>
                      <Select
                        value={med.frequency}
                        onValueChange={(v) => { if (v) updateMed(idx, "frequency", v); }}
                      >
                        <SelectTrigger className="h-10 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(FREQUENCY_LABELS).map(([k, label]) => (
                            <SelectItem key={k} value={k}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Scheduled Times */}
                    {med.scheduledTimes.length > 0 && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Scheduled Times
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {med.scheduledTimes.map((t, tIdx) => (
                            <input
                              key={tIdx}
                              type="time"
                              value={t}
                              onChange={(e) =>
                                updateScheduledTime(idx, tIdx, e.target.value)
                              }
                              className="h-9 rounded-md border px-2 text-sm bg-white"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-1.5">
                      <Label>Notes</Label>
                      <Input
                        value={med.notes}
                        onChange={(e) => updateMed(idx, "notes", e.target.value)}
                        placeholder="Optional notes"
                        className="h-10 bg-white"
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* ── Fluid Therapy ──────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fluid Therapy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="fluidType">Fluid Type</Label>
                    <Input
                      id="fluidType"
                      name="fluidType"
                      value={fluidType}
                      onChange={(e) => setFluidType(e.target.value)}
                      placeholder="e.g., Ringer's Lactate"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fluidRate">Rate</Label>
                    <Input
                      id="fluidRate"
                      name="fluidRate"
                      value={fluidRate}
                      onChange={(e) => setFluidRate(e.target.value)}
                      placeholder="e.g., 10 mL/kg/hr"
                      className="h-11"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fluidAdditives">Additives</Label>
                  <Input
                    id="fluidAdditives"
                    name="fluidAdditives"
                    value={fluidAdditives}
                    onChange={(e) => setFluidAdditives(e.target.value)}
                    placeholder="e.g., KCl 20 mEq/L"
                    className="h-11"
                  />
                </div>
              </CardContent>
            </Card>

            {/* ── Diet Plan ─────────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Diet Plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="dietType">Diet Type</Label>
                  <Input
                    id="dietType"
                    name="dietType"
                    value={dietType}
                    onChange={(e) => setDietType(e.target.value)}
                    placeholder="e.g., Prescription GI diet, NPO, Liquid only"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dietInstructions">Instructions</Label>
                  <Textarea
                    id="dietInstructions"
                    name="dietInstructions"
                    value={dietInstructions}
                    onChange={(e) => setDietInstructions(e.target.value)}
                    placeholder="Feeding instructions..."
                    rows={2}
                  />
                </div>

                {/* Feeding Schedules */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Feeding Schedule</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addFeeding}
                    >
                      + Add Feeding
                    </Button>
                  </div>

                  {feedingSchedules.map((f, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-3 gap-2 items-end rounded-lg border p-3 bg-gray-50"
                    >
                      <div className="space-y-1">
                        <Label className="text-xs">Time</Label>
                        <input
                          type="time"
                          value={f.scheduledTime}
                          onChange={(e) =>
                            updateFeeding(idx, "scheduledTime", e.target.value)
                          }
                          className="h-10 w-full rounded-md border px-2 text-sm bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Food Type</Label>
                        <Input
                          value={f.foodType}
                          onChange={(e) =>
                            updateFeeding(idx, "foodType", e.target.value)
                          }
                          placeholder="e.g., Royal Canin GI"
                          className="h-10 bg-white"
                        />
                      </div>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">Portion</Label>
                          <Input
                            value={f.portion}
                            onChange={(e) =>
                              updateFeeding(idx, "portion", e.target.value)
                            }
                            placeholder="e.g., 100g"
                            className="h-10 bg-white"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFeeding(idx)}
                          className="h-10 px-2 text-xs text-red-500 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ── Initial Notes ──────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Initial Clinical Note</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  id="initialNotes"
                  name="initialNotes"
                  value={initialNotes}
                  onChange={(e) => setInitialNotes(e.target.value)}
                  placeholder="Initial examination findings, treatment plan rationale..."
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ── Submit ───────────────────────────────────────────────────── */}
      <Button
        type="submit"
        className="w-full h-12 text-base"
        disabled={isPending}
      >
        {isPending ? "Saving…" : "Complete Admission"}
      </Button>
    </form>
  );
}
