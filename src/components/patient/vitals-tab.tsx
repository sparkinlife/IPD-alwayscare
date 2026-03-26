import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function VitalsTab({ admissionId, vitals }: VitalsTabProps) {
  const latest = vitals[0] ?? null;

  return (
    <div className="space-y-4">
      {/* Latest vitals */}
      {latest ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Latest Vitals</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDateTimeIST(latest.recordedAt)} IST
              {latest.recordedBy && ` · ${latest.recordedBy.name}`}
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            <VitalRow
              label="Temperature"
              value={latest.temperature}
              unit="°C"
              flag={checkTemperature(latest.temperature)}
            />
            <VitalRow
              label="Heart Rate"
              value={latest.heartRate}
              unit=" bpm"
              flag={checkHeartRate(latest.heartRate)}
            />
            <VitalRow
              label="Resp Rate"
              value={latest.respRate}
              unit=" /min"
              flag={checkRespRate(latest.respRate)}
            />
            <VitalRow
              label="Pain Score"
              value={latest.painScore != null ? `${latest.painScore}/10` : null}
              flag={checkPainScore(latest.painScore)}
            />
            <VitalRow
              label="Weight"
              value={latest.weight}
              unit=" kg"
            />
            <VitalRow
              label="SpO2"
              value={latest.spo2}
              unit="%"
            />
            <VitalRow
              label="Blood Pressure"
              value={latest.bloodPressure}
            />
            <VitalRow
              label="CRT"
              value={latest.capillaryRefillTime}
              unit=" sec"
              flag={checkCRT(latest.capillaryRefillTime)}
            />
            <VitalRow
              label="Mucous Membrane"
              value={latest.mucousMembraneColor}
            />
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
                        {v.temperature != null ? `${v.temperature}°C` : "—"}
                      </td>
                      <td className={cn(
                        "px-3 py-2 text-right",
                        checkHeartRate(v.heartRate).isAbnormal && "text-red-600 font-medium"
                      )}>
                        {v.heartRate ?? "—"}
                      </td>
                      <td className={cn(
                        "px-3 py-2 text-right",
                        checkRespRate(v.respRate).isAbnormal && "text-red-600 font-medium"
                      )}>
                        {v.respRate ?? "—"}
                      </td>
                      <td className={cn(
                        "px-3 py-2 text-right",
                        checkPainScore(v.painScore).isAbnormal && "text-red-600 font-medium"
                      )}>
                        {v.painScore != null ? `${v.painScore}/10` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {v.weight != null ? `${v.weight}kg` : "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[80px]">
                        {v.recordedBy?.name ?? "—"}
                      </td>
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
    </div>
  );
}
