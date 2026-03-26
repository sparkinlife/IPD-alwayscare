"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTimeIST } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { LabForm } from "./lab-form";

interface LabResult {
  id: string;
  testType: string;
  testName: string;
  result: string;
  resultDate: Date;
  isAbnormal: boolean;
  notes?: string | null;
  reportUrl?: string | null;
  createdBy: { name: string } | null;
}

interface LabsTabProps {
  admissionId: string;
  labResults: LabResult[];
  isDoctor: boolean;
}

const LAB_TYPE_LABELS: Record<string, string> = {
  CBC: "CBC",
  BLOOD_CHEMISTRY: "Blood Chem",
  PCR: "PCR",
  URINALYSIS: "Urinalysis",
  FECAL_EXAM: "Fecal",
  XRAY: "X-Ray",
  ULTRASOUND: "Ultrasound",
  SEROLOGY: "Serology",
  SKIN_SCRAPING: "Skin Scraping",
  OTHER: "Other",
};

const LAB_TYPE_COLORS: Record<string, string> = {
  CBC: "bg-blue-100 text-blue-700",
  BLOOD_CHEMISTRY: "bg-indigo-100 text-indigo-700",
  PCR: "bg-purple-100 text-purple-700",
  URINALYSIS: "bg-yellow-100 text-yellow-700",
  FECAL_EXAM: "bg-orange-100 text-orange-700",
  XRAY: "bg-slate-100 text-slate-700",
  ULTRASOUND: "bg-cyan-100 text-cyan-700",
  SEROLOGY: "bg-pink-100 text-pink-700",
  SKIN_SCRAPING: "bg-amber-100 text-amber-700",
  OTHER: "bg-gray-100 text-gray-600",
};

function LabResultCard({ item }: { item: LabResult }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = item.result.length > 100;
  const displayResult = !expanded && isLong ? item.result.slice(0, 100) + "…" : item.result;
  const typeColor = LAB_TYPE_COLORS[item.testType] ?? "bg-gray-100 text-gray-600";
  const typeLabel = LAB_TYPE_LABELS[item.testType] ?? item.testType;

  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{item.testName}</span>
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", typeColor)}>
              {typeLabel}
            </span>
            {item.isAbnormal && (
              <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                Abnormal
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
            {formatDateTimeIST(item.resultDate)} IST
          </span>
        </div>

        {item.createdBy && (
          <p className="text-xs text-muted-foreground mb-2">By {item.createdBy.name}</p>
        )}

        <p className="text-sm leading-relaxed whitespace-pre-wrap">{displayResult}</p>

        {(isLong || item.notes || item.reportUrl) && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                {isLong ? "Show full result" : "Show details"}
              </>
            )}
          </button>
        )}

        {expanded && (
          <div className="mt-3 space-y-2 border-t pt-3">
            {item.notes && (
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-0.5">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{item.notes}</p>
              </div>
            )}
            {item.reportUrl && (
              <a
                href={item.reportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View Report
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function LabsTab({ admissionId, labResults, isDoctor }: LabsTabProps) {
  return (
    <div className="space-y-4">
      {labResults.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No lab results yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {labResults.map((item) => (
            <LabResultCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {isDoctor && (
        <div className="pt-2">
          <LabForm admissionId={admissionId} />
        </div>
      )}
    </div>
  );
}
