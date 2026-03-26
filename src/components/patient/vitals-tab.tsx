"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  checkTemperature,
  checkHeartRate,
  checkRespRate,
  checkPainScore,
  checkCRT,
} from "@/lib/vitals-thresholds";
import { formatDateTimeIST } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { VitalsForm } from "./vitals-form";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { updateVitals, deleteVitals } from "@/actions/vitals";

interface VitalRecord {
  id: string;
  recordedAt: Date;
  temperature?: number | null;
  heartRate?: number | null;
  respRate?: number | null;
  painScore?: number | null;
  weight?: number | null;
  bloodPressure?: string | null;
  spo2?: number | null;
  capillaryRefillTime?: number | null;
  mucousMembraneColor?: string | null;
  notes?: string | null;
  recordedBy?: { name: string } | null;
}

interface VitalsTabProps {
  admissionId: string;
  vitals: VitalRecord[];
  isDoctor?: boolean;
}

function VitalRow({
  label,
  value,
  unit,
  flag,
}: {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  flag?: { isAbnormal: boolean; label: string };
}) {
  if (value == null || value === "") return null;

  const isAbnormal = flag?.isAbnormal ?? false;

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className={cn("text-sm font-medium", isAbnormal && "text-red-600")}>
          {value}
          {unit && <span className="text-xs ml-0.5">{unit}</span>}
        </span>
        {flag && flag.label && flag.label !== "Normal" && (
          <span
            className={cn(
              "text-xs font-semibold",
              isAbnormal ? "text-red-600" : "text-green-600"
            )}
          >
            {flag.label}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Edit Vitals Sheet ─────────────────────────────────────────────────────────

function EditVitalsSheet({
  vital,
  open,
  onOpenChange,
}: {
  vital: VitalRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [mmcValue, setMmcValue] = useState(vital.mucousMembraneColor ?? "");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    if (mmcValue) formData.set("mucousMembraneColor", mmcValue);

    try {
      const result = await updateVitals(vital.id, formData);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Vitals updated");
        onOpenChange(false);
      }
    } catch {
      toast.error("Failed to update vitals");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto pb-safe">
        <SheetHeader>
          <SheetTitle>Edit Vitals</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="px-4 pb-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-temperature">Temperature</Label>
              <Input id="edit-temperature" name="temperature" type="number" step="0.1" placeholder="C" defaultValue={vital.temperature ?? ""} className="h-12" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-heartRate">Heart Rate</Label>
              <Input id="edit-heartRate" name="heartRate" type="number" placeholder="bpm" defaultValue={vital.heartRate ?? ""} className="h-12" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-respRate">Respiratory Rate</Label>
              <Input id="edit-respRate" name="respRate" type="number" placeholder="/min" defaultValue={vital.respRate ?? ""} className="h-12" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-painScore">Pain Score</Label>
              <Input id="edit-painScore" name="painScore" type="number" min={0} max={10} placeholder="0-10" defaultValue={vital.painScore ?? ""} className="h-12" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-weight">Weight</Label>
              <Input id="edit-weight" name="weight" type="number" step="0.1" placeholder="kg" defaultValue={vital.weight ?? ""} className="h-12" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-spo2">SpO2</Label>
              <Input id="edit-spo2" name="spo2" type="number" step="0.1" placeholder="%" defaultValue={vital.spo2 ?? ""} className="h-12" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-bp">Blood Pressure</Label>
              <Input id="edit-bp" name="bloodPressure" type="text" placeholder="e.g., 120/80" defaultValue={vital.bloodPressure ?? ""} className="h-12" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-crt">CRT</Label>
              <Input id="edit-crt" name="capillaryRefillTime" type="number" step="0.1" placeholder="seconds" defaultValue={vital.capillaryRefillTime ?? ""} className="h-12" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Mucous Membrane Color</Label>
            <Select value={mmcValue} onValueChange={(v) => setMmcValue(v ?? "")}>
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
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea id="edit-notes" name="notes" placeholder="Additional observations..." rows={3} defaultValue={vital.notes ?? ""} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading}>{loading ? "Saving..." : "Update Vitals"}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function VitalsTab({ admissionId, vitals, isDoctor }: VitalsTabProps) {
  const latest = vitals[0] ?? null;
  const [editVital, setEditVital] = useState<VitalRecord | null>(null);

  async function handleDelete(vitalId: string) {
    try {
      const result = await deleteVitals(vitalId);
      if (result && "error" in result && result.error) toast.error(result.error);
      else toast.success("Vital record deleted");
    } catch {
      toast.error("Failed to delete vital record");
    }
  }

  return (
    <div className="space-y-4">
      {/* Latest vitals */}
      {latest ? (
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Latest Vitals</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDateTimeIST(latest.recordedAt)} IST
                  {latest.recordedBy && ` · ${latest.recordedBy.name}`}
                </p>
              </div>
              {isDoctor && (
                <ActionsMenu
                  onEdit={() => setEditVital(latest)}
                  onDelete={() => handleDelete(latest.id)}
                  deleteConfirmMessage="Delete this vital record? This action cannot be undone."
                />
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <VitalRow label="Temperature" value={latest.temperature} unit="C" flag={checkTemperature(latest.temperature)} />
            <VitalRow label="Heart Rate" value={latest.heartRate} unit=" bpm" flag={checkHeartRate(latest.heartRate)} />
            <VitalRow label="Resp Rate" value={latest.respRate} unit=" /min" flag={checkRespRate(latest.respRate)} />
            <VitalRow label="Pain Score" value={latest.painScore != null ? `${latest.painScore}/10` : null} flag={checkPainScore(latest.painScore)} />
            <VitalRow label="Weight" value={latest.weight} unit=" kg" />
            <VitalRow label="SpO2" value={latest.spo2} unit="%" />
            <VitalRow label="Blood Pressure" value={latest.bloodPressure} />
            <VitalRow label="CRT" value={latest.capillaryRefillTime} unit=" sec" flag={checkCRT(latest.capillaryRefillTime)} />
            <VitalRow label="Mucous Membrane" value={latest.mucousMembraneColor} />
            {latest.notes && (
              <div className="pt-2">
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="text-sm mt-0.5">{latest.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No vitals recorded yet</p>
          </CardContent>
        </Card>
      )}

      {/* 48h trend placeholder */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>48h Trend</CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Vitals trend chart — coming in Phase 3
          </p>
        </CardContent>
      </Card>

      {/* Vitals history */}
      {vitals.length > 1 && (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Date/Time</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Temp</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">HR</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">RR</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Pain</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Wt</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">By</th>
                    {isDoctor && <th className="px-1 py-2 w-8"></th>}
                  </tr>
                </thead>
                <tbody>
                  {vitals.slice(1).map((v) => (
                    <tr key={v.id} className="border-b last:border-0">
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {formatDateTimeIST(v.recordedAt)}
                      </td>
                      <td className={cn(
                        "px-3 py-2 text-right whitespace-nowrap",
                        checkTemperature(v.temperature).isAbnormal && "text-red-600 font-medium"
                      )}>
                        {v.temperature != null ? `${v.temperature}C` : "\u2014"}
                      </td>
                      <td className={cn(
                        "px-3 py-2 text-right",
                        checkHeartRate(v.heartRate).isAbnormal && "text-red-600 font-medium"
                      )}>
                        {v.heartRate ?? "\u2014"}
                      </td>
                      <td className={cn(
                        "px-3 py-2 text-right",
                        checkRespRate(v.respRate).isAbnormal && "text-red-600 font-medium"
                      )}>
                        {v.respRate ?? "\u2014"}
                      </td>
                      <td className={cn(
                        "px-3 py-2 text-right",
                        checkPainScore(v.painScore).isAbnormal && "text-red-600 font-medium"
                      )}>
                        {v.painScore != null ? `${v.painScore}/10` : "\u2014"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {v.weight != null ? `${v.weight}kg` : "\u2014"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[80px]">
                        {v.recordedBy?.name ?? "\u2014"}
                      </td>
                      {isDoctor && (
                        <td className="px-1 py-1">
                          <ActionsMenu
                            onEdit={() => setEditVital(v)}
                            onDelete={() => handleDelete(v.id)}
                            deleteConfirmMessage="Delete this vital record? This action cannot be undone."
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Record Vitals button */}
      <div className="pt-2">
        <VitalsForm admissionId={admissionId} lastVitals={latest} />
      </div>

      {/* Edit Vitals Sheet */}
      {editVital && (
        <EditVitalsSheet
          vital={editVital}
          open={!!editVital}
          onOpenChange={(open) => { if (!open) setEditVital(null); }}
        />
      )}
    </div>
  );
}
