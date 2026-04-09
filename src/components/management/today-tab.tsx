"use client";

import { useState } from "react";
import { ProofLightbox } from "./proof-lightbox";
import { driveMediaUrl } from "@/lib/drive-url";
import { formatInTimeZone } from "date-fns-tz";
import { Play } from "lucide-react";
import { isVideo } from "@/lib/media-utils";
import { checkTemperature, checkHeartRate, checkRespRate, checkPainScore } from "@/lib/vitals-thresholds";
import { isBathDue } from "@/lib/date-utils";

interface ProofInfo {
  fileId: string;
  fileName: string;
  isSkipped: boolean;
  skipReason: string | null;
}

interface MedSlot {
  time: string;
  drugName: string;
  dose: string;
  route: string;
  wasAdministered: boolean;
  wasSkipped: boolean;
  skipReason: string | null;
  administeredBy: string | null;
  actualTime: Date | null;
  proof: ProofInfo | null;
}

interface FeedSlot {
  time: string;
  foodType: string;
  portion: string;
  status: string | null;
  amountConsumed: string | null;
  loggedBy: string | null;
  proof: ProofInfo | null;
}

export interface TodayTabProps {
  meds: MedSlot[];
  medsGiven: number;
  medsTotal: number;
  feeds: FeedSlot[];
  feedsLogged: number;
  feedsTotal: number;
  latestVitals: {
    temperature: number | null;
    heartRate: number | null;
    respRate: number | null;
    painScore: number | null;
    spo2: number | null;
    weight: number | null;
    recordedBy: string;
    recordedAt: Date;
  } | null;
  bathLastDate: Date | null;
  isolation: {
    disease: string;
    ppeRequired: string[];
    disinfectant: string;
    disinfectionInterval: string;
    lastDisinfection: Date | null;
  } | null;
  fluidTherapies: { fluidType: string; rate: string; isActive: boolean }[];
  patientName: string;
}

export function TodayTab(props: TodayTabProps) {
  const [lightbox, setLightbox] = useState<{ items: ProofInfo[]; index: number } | null>(null);

  const allProofs = [
    ...props.meds.filter((m) => m.proof).map((m) => m.proof!),
    ...props.feeds.filter((f) => f.proof).map((f) => f.proof!),
  ];

  function openProof(proof: ProofInfo) {
    const idx = allProofs.findIndex((p) => p.fileId === proof.fileId);
    setLightbox({ items: allProofs, index: idx >= 0 ? idx : 0 });
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Medications */}
      <section>
        <h3 className="text-sm font-semibold px-1 mb-2">
          Medications ({props.medsGiven}/{props.medsTotal} given)
        </h3>
        <div className="space-y-1">
          {props.meds.map((slot, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded-lg border bg-card text-sm">
              <StatusDot status={slot.wasAdministered ? "done" : slot.wasSkipped ? "skipped" : "pending"} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{slot.drugName}</span>
                  <span className="text-xs text-muted-foreground">{slot.time}</span>
                </div>
                <p className="text-xs text-muted-foreground">{slot.dose} · {slot.route}</p>
                {slot.wasAdministered && slot.administeredBy && (
                  <p className="text-xs text-green-600 mt-0.5">
                    by {slot.administeredBy}
                    {slot.actualTime ? ` at ${formatInTimeZone(new Date(slot.actualTime), "Asia/Kolkata", "HH:mm")}` : ""}
                  </p>
                )}
                {slot.wasSkipped && <p className="text-xs text-amber-600 mt-0.5">Skipped: {slot.skipReason}</p>}
              </div>
              {slot.proof && (
                <button onClick={() => openProof(slot.proof!)} className="shrink-0">
                  {slot.proof.isSkipped ? (
                    <div className="w-12 h-12 rounded bg-muted flex items-center justify-center px-1 text-[8px] leading-tight text-center text-muted-foreground">
                      Photo skipped
                    </div>
                  ) : (
                    isVideo(slot.proof.fileName) ? (
                      <div className="relative w-12 h-12">
                        <video src={driveMediaUrl(slot.proof.fileId)} className="w-12 h-12 rounded object-cover" muted preload="metadata" />
                        <Play className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow" />
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={driveMediaUrl(slot.proof.fileId)} alt="proof" className="w-12 h-12 rounded object-cover" loading="lazy" />
                    )
                  )}
                </button>
              )}
            </div>
          ))}
          {props.meds.length === 0 && <p className="text-xs text-muted-foreground px-1">No medications prescribed</p>}
        </div>
      </section>

      {/* Feeding */}
      <section>
        <h3 className="text-sm font-semibold px-1 mb-2">
          Feeding ({props.feedsLogged}/{props.feedsTotal} logged)
        </h3>
        <div className="space-y-1">
          {props.feeds.map((slot, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded-lg border bg-card text-sm">
              <StatusDot status={slot.status && slot.status !== "PENDING" ? "done" : "pending"} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{slot.foodType}</span>
                  <span className="text-xs text-muted-foreground">{slot.time}</span>
                </div>
                <p className="text-xs text-muted-foreground">{slot.portion}</p>
                {slot.status && slot.status !== "PENDING" && (
                  <p className={`text-xs mt-0.5 ${slot.status === "EATEN" ? "text-green-600" : slot.status === "REFUSED" ? "text-red-600" : "text-amber-600"}`}>
                    {slot.status}{slot.amountConsumed ? ` · ${slot.amountConsumed}` : ""}{slot.loggedBy ? ` · ${slot.loggedBy}` : ""}
                  </p>
                )}
              </div>
              {slot.proof && (
                <button onClick={() => openProof(slot.proof!)} className="shrink-0">
                  {isVideo(slot.proof.fileName) ? (
                    <div className="relative w-12 h-12">
                      <video src={driveMediaUrl(slot.proof.fileId)} className="w-12 h-12 rounded object-cover" muted preload="metadata" />
                      <Play className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow" />
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={driveMediaUrl(slot.proof.fileId)} alt="proof" className="w-12 h-12 rounded object-cover" loading="lazy" />
                  )}
                </button>
              )}
            </div>
          ))}
          {props.feeds.length === 0 && <p className="text-xs text-muted-foreground px-1">No diet plan</p>}
        </div>
      </section>

      {/* Vitals */}
      <section>
        <h3 className="text-sm font-semibold px-1 mb-2">Latest Vitals</h3>
        {props.latestVitals ? (
          <div className="p-3 rounded-lg border bg-card">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <VitalCell label="Temp" value={props.latestVitals.temperature} unit="°C" flag={checkTemperature(props.latestVitals.temperature)} />
              <VitalCell label="HR" value={props.latestVitals.heartRate} unit="bpm" flag={checkHeartRate(props.latestVitals.heartRate)} />
              <VitalCell label="RR" value={props.latestVitals.respRate} unit="/min" flag={checkRespRate(props.latestVitals.respRate)} />
              {props.latestVitals.painScore != null && <VitalCell label="Pain" value={props.latestVitals.painScore} unit="/10" flag={checkPainScore(props.latestVitals.painScore)} />}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {props.latestVitals.recordedBy} · {formatInTimeZone(new Date(props.latestVitals.recordedAt), "Asia/Kolkata", "HH:mm")}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground px-1">No vitals recorded today</p>
        )}
      </section>

      {/* IV Fluids */}
      {props.fluidTherapies.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold px-1 mb-2">IV Fluids</h3>
          {props.fluidTherapies.filter((f) => f.isActive).map((f, i) => (
            <div key={i} className="p-2 rounded-lg border bg-card text-sm">
              <span className="font-medium">{f.fluidType}</span> · {f.rate}
            </div>
          ))}
        </section>
      )}

      {/* Bath */}
      <section>
        <h3 className="text-sm font-semibold px-1 mb-2">Bath</h3>
        <div className="p-2 rounded-lg border bg-card text-sm">
          {props.bathLastDate ? (
            (() => {
              const status = isBathDue(props.bathLastDate);
              return (
                <span className={status.isOverdue ? "text-red-600 font-medium" : status.isDue ? "text-amber-600" : "text-muted-foreground"}>
                  Last: {status.daysSinceLast} days ago{status.isOverdue ? " — OVERDUE" : status.isDue ? " — DUE" : ""}
                </span>
              );
            })()
          ) : (
            <span className="text-amber-600">No bath recorded</span>
          )}
        </div>
      </section>

      {/* Isolation */}
      {props.isolation && (
        <section>
          <h3 className="text-sm font-semibold px-1 mb-2">Isolation</h3>
          <div className="p-3 rounded-lg border bg-card text-sm space-y-1">
            <p className="font-medium">{props.isolation.disease}</p>
            <p className="text-xs text-muted-foreground">PPE: {props.isolation.ppeRequired.join(", ")}</p>
            <p className="text-xs text-muted-foreground">Disinfectant: {props.isolation.disinfectant} · {props.isolation.disinfectionInterval}</p>
            {props.isolation.lastDisinfection && (
              <p className="text-xs text-muted-foreground">
                Last: {formatInTimeZone(new Date(props.isolation.lastDisinfection), "Asia/Kolkata", "HH:mm")}
              </p>
            )}
          </div>
        </section>
      )}

      {lightbox && (
        <ProofLightbox
          items={lightbox.items.map((p) => ({
            fileId: p.fileId,
            patientName: props.patientName,
            actionType: "Proof",
            actionDetail: p.fileName,
            performedBy: "",
            timestamp: new Date(),
            isSkipped: p.isSkipped,
            skipReason: p.skipReason,
          }))}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

function StatusDot({ status }: { status: "done" | "skipped" | "pending" }) {
  const colors = { done: "bg-green-500", skipped: "bg-amber-500", pending: "bg-gray-300" };
  return <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${colors[status]}`} />;
}

function VitalCell({ label, value, unit, flag }: { label: string; value: number | null; unit: string; flag: { isAbnormal: boolean; label: string } }) {
  if (value == null) return null;
  return (
    <div className={flag.isAbnormal ? "text-red-600 font-medium" : ""}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p>{value}{unit} {flag.isAbnormal && flag.label}</p>
    </div>
  );
}
