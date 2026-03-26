"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { formatDateTimeIST } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { LabForm } from "./lab-form";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { updateLabResult, deleteLabResult } from "@/actions/labs";

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

const LAB_TEST_TYPES = [
  { value: "CBC", label: "CBC -- Complete Blood Count" },
  { value: "BLOOD_CHEMISTRY", label: "Blood Chemistry" },
  { value: "PCR", label: "PCR" },
  { value: "URINALYSIS", label: "Urinalysis" },
  { value: "FECAL_EXAM", label: "Fecal Exam" },
  { value: "XRAY", label: "X-Ray" },
  { value: "ULTRASOUND", label: "Ultrasound" },
  { value: "SEROLOGY", label: "Serology" },
  { value: "SKIN_SCRAPING", label: "Skin Scraping" },
  { value: "OTHER", label: "Other" },
] as const;

// ─── Edit Lab Sheet ──────────────────────────────────────────────────────────

function EditLabSheet({
  lab,
  open,
  onOpenChange,
}: {
  lab: LabResult;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [testType, setTestType] = useState(lab.testType);
  const [isAbnormal, setIsAbnormal] = useState(lab.isAbnormal);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    if (testType) formData.set("testType", testType);
    formData.set("isAbnormal", isAbnormal ? "true" : "false");
    try {
      const result = await updateLabResult(lab.id, formData);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Lab result updated");
        onOpenChange(false);
      }
    } catch {
      toast.error("Failed to update lab result");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto pb-safe">
        <SheetHeader>
          <SheetTitle>Edit Lab Result</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="px-4 pb-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Test Type</Label>
            <Select value={testType} onValueChange={(v) => setTestType(v ?? testType)}>
              <SelectTrigger className="w-full h-12">
                <SelectValue placeholder="Select test type" />
              </SelectTrigger>
              <SelectContent>
                {LAB_TEST_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-testName">Test Name</Label>
            <Input id="edit-testName" name="testName" defaultValue={lab.testName} className="h-12" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-result">Result</Label>
            <Textarea id="edit-result" name="result" rows={4} defaultValue={lab.result} required />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Abnormal Result</p>
              <p className="text-xs text-muted-foreground">Flag this result as abnormal</p>
            </div>
            <Switch checked={isAbnormal} onCheckedChange={setIsAbnormal} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-labNotes">Notes</Label>
            <Textarea id="edit-labNotes" name="notes" rows={3} defaultValue={lab.notes ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-reportUrl">Report URL</Label>
            <Input id="edit-reportUrl" name="reportUrl" type="url" defaultValue={lab.reportUrl ?? ""} className="h-12" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading}>{loading ? "Saving..." : "Update Result"}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Lab Result Card ─────────────────────────────────────────────────────────

function LabResultCard({ item, isDoctor, onEdit, onDelete }: { item: LabResult; isDoctor: boolean; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = item.result.length > 100;
  const displayResult = !expanded && isLong ? item.result.slice(0, 100) + "\u2026" : item.result;
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
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDateTimeIST(item.resultDate)} IST
            </span>
            {isDoctor && (
              <ActionsMenu
                onEdit={onEdit}
                onDelete={onDelete}
                deleteConfirmMessage="Delete this lab result? This action cannot be undone."
              />
            )}
          </div>
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

// ─── Main Component ──────────────────────────────────────────────────────────

export function LabsTab({ admissionId, labResults, isDoctor }: LabsTabProps) {
  const [editLab, setEditLab] = useState<LabResult | null>(null);

  async function handleDelete(labId: string) {
    try {
      const result = await deleteLabResult(labId);
      if (result && "error" in result && result.error) toast.error(result.error);
      else toast.success("Lab result deleted");
    } catch {
      toast.error("Failed to delete lab result");
    }
  }

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
            <LabResultCard
              key={item.id}
              item={item}
              isDoctor={isDoctor}
              onEdit={() => setEditLab(item)}
              onDelete={() => handleDelete(item.id)}
            />
          ))}
        </div>
      )}

      {isDoctor && (
        <div className="pt-2">
          <LabForm admissionId={admissionId} />
        </div>
      )}

      {/* Edit Lab Sheet */}
      {editLab && (
        <EditLabSheet
          lab={editLab}
          open={!!editLab}
          onOpenChange={(open) => { if (!open) setEditLab(null); }}
        />
      )}
    </div>
  );
}
