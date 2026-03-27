"use client";

import { useState } from "react";
import { ShieldAlert, CheckCircle2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDateTimeIST, formatRelative } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ProofUploadDialog, type ProofFile } from "@/components/ui/proof-upload-dialog";
import { saveProofAttachments, saveSkippedProof } from "@/actions/proof";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { logDisinfection, updateIsolationProtocol, updateIsolationSetup, deleteDisinfectionLog } from "@/actions/isolation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PPE_OPTIONS, DISINFECTION_INTERVALS } from "@/lib/constants";
import { Trash2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DisinfectionLog {
  id: string;
  performedAt: Date;
  performedBy: { name: string };
  notes: string | null;
}

interface IsolationProtocol {
  id: string;
  disease: string;
  pcrStatus: string;
  lastPcrDate: Date | null;
  pcrTrend: string | null;
  ppeRequired: string[];
  disinfectant: string;
  disinfectionInterval: string;
  biosecurityNotes: string | null;
  isCleared: boolean;
  clearedDate: Date | null;
  disinfectionLogs: DisinfectionLog[];
}

interface LabResult {
  id: string;
  testType: string;
  testName: string;
  result: string;
  resultDate: Date;
  isAbnormal: boolean;
}

interface IsolationTabProps {
  admissionId: string;
  isolationProtocol: IsolationProtocol;
  labResults: LabResult[];
  isDoctor: boolean;
  patientName?: string;
}

// ─── PCR Status Badge ─────────────────────────────────────────────────────────

const PCR_COLORS: Record<string, string> = {
  Positive: "bg-red-100 text-red-700 border-red-200",
  Negative: "bg-green-100 text-green-700 border-green-200",
  Pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Inconclusive: "bg-gray-100 text-gray-600 border-gray-200",
};

function PcrBadge({ status }: { status: string }) {
  const color = PCR_COLORS[status] ?? "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", color)}>
      {status}
    </span>
  );
}

// ─── PCR Update Dialog (Doctor only) ─────────────────────────────────────────

function PcrUpdateDialog({
  protocolId,
  currentPcrStatus,
  currentPcrTrend,
}: {
  protocolId: string;
  currentPcrStatus: string;
  currentPcrTrend: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pcrStatus, setPcrStatus] = useState(currentPcrStatus);
  const [pcrTrend, setPcrTrend] = useState(currentPcrTrend ?? "");
  const [isCleared, setIsCleared] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    try {
      const formData = new FormData();
      if (pcrStatus) formData.set("pcrStatus", pcrStatus);
      if (pcrTrend) formData.set("pcrTrend", pcrTrend);
      if (isCleared) formData.set("isCleared", "true");
      const result = await updateIsolationProtocol(protocolId, formData);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Protocol updated");
        setOpen(false);
      }
    } catch {
      toast.error("Failed to update protocol");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5" />
        }
      >
        Update PCR
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Update PCR / Clearance</DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-4">
          <div className="space-y-1.5">
            <Label>PCR Status</Label>
            <Select value={pcrStatus} onValueChange={(v) => setPcrStatus(v ?? pcrStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Positive">Positive</SelectItem>
                <SelectItem value="Negative">Negative</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Inconclusive">Inconclusive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>PCR Trend</Label>
            <Select value={pcrTrend} onValueChange={(v) => setPcrTrend(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select trend (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Improving">Improving</SelectItem>
                <SelectItem value="Stable">Stable</SelectItem>
                <SelectItem value="Worsening">Worsening</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCleared((v) => !v)}
              className={cn(
                "h-5 w-5 rounded border-2 flex items-center justify-center transition-colors",
                isCleared
                  ? "bg-green-600 border-green-600"
                  : "border-gray-300 bg-white"
              )}
              aria-label="Mark as cleared"
            >
              {isCleared && (
                <CheckCircle2 className="h-3.5 w-3.5 text-white" />
              )}
            </button>
            <Label className="cursor-pointer" onClick={() => setIsCleared((v) => !v)}>
              Mark patient as cleared from isolation
            </Label>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Isolation Protocol Sheet ──────────────────────────────────────────

function EditIsolationSheet({
  protocol,
  open,
  onOpenChange,
}: {
  protocol: IsolationProtocol;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [disease, setDisease] = useState(protocol.disease);
  const [ppeRequired, setPpeRequired] = useState<string[]>([...protocol.ppeRequired]);
  const [disinfectant, setDisinfectant] = useState(protocol.disinfectant);
  const [disinfectionInterval, setDisinfectionInterval] = useState(protocol.disinfectionInterval);
  const [biosecurityNotes, setBiosecurityNotes] = useState(protocol.biosecurityNotes ?? "");

  function togglePpe(ppe: string) {
    setPpeRequired((prev) =>
      prev.includes(ppe) ? prev.filter((p) => p !== ppe) : [...prev, ppe]
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!disease) {
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("disease", disease);
      formData.set("ppeRequired", JSON.stringify(ppeRequired));
      formData.set("disinfectant", disinfectant);
      formData.set("disinfectionInterval", disinfectionInterval);
      formData.set("biosecurityNotes", biosecurityNotes);
      const result = await updateIsolationSetup(protocol.id, formData);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Protocol updated");
        onOpenChange(false);
      }
    } catch {
      toast.error("Failed to update protocol");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto pb-8">
        <SheetHeader>
          <SheetTitle>Edit Isolation Protocol</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 px-1">
          <div className="space-y-1.5">
            <Label>Disease *</Label>
            <Input value={disease} onChange={(e) => setDisease(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>PPE Required</Label>
            <div className="flex flex-wrap gap-2">
              {PPE_OPTIONS.map((ppe) => (
                <button
                  key={ppe}
                  type="button"
                  onClick={() => togglePpe(ppe)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                    ppeRequired.includes(ppe)
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-white text-gray-700 border-gray-300 hover:border-gray-500"
                  }`}
                >
                  {ppe}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Disinfectant</Label>
            <Input value={disinfectant} onChange={(e) => setDisinfectant(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Disinfection Interval</Label>
            <Select value={disinfectionInterval} onValueChange={(v) => setDisinfectionInterval(v ?? disinfectionInterval)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select interval" />
              </SelectTrigger>
              <SelectContent>
                {DISINFECTION_INTERVALS.map((int) => (
                  <SelectItem key={int.value} value={int.value}>{int.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Biosecurity Notes</Label>
            <Textarea rows={3} value={biosecurityNotes} onChange={(e) => setBiosecurityNotes(e.target.value)} placeholder="Special biosecurity instructions..." />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading}>{loading ? "Saving..." : "Update Protocol"}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Disinfection Log Section ─────────────────────────────────────────────────

function DisinfectionSection({
  protocol,
  isDoctor,
  patientName,
}: {
  protocol: IsolationProtocol;
  isDoctor: boolean;
  patientName?: string;
}) {
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [proofDialogOpen, setProofDialogOpen] = useState(false);
  const [lastLogId, setLastLogId] = useState<string | null>(null);
  const recentLogs = protocol.disinfectionLogs.slice(0, 3);
  const hasMore = protocol.disinfectionLogs.length > 3;

  async function handleLogDisinfection() {
    setLoggingId(protocol.id);
    try {
      const result = await logDisinfection(protocol.id);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Disinfection logged");
        const logId = (result as { id?: string })?.id ?? protocol.id;
        setLastLogId(logId);
        setProofDialogOpen(true);
      }
    } catch {
      toast.error("Failed to log disinfection");
    } finally {
      setLoggingId(null);
    }
  }

  function handleProofComplete(proofs: ProofFile[]) {
    if (lastLogId && proofs.length > 0) {
      saveProofAttachments(lastLogId, "DisinfectionLog", "DISINFECTION", proofs).catch(() => {});
    }
  }

  function handleProofSkip(reason: string) {
    if (lastLogId) {
      saveSkippedProof(lastLogId, "DisinfectionLog", "DISINFECTION", reason).catch(() => {});
    }
  }

  async function handleDeleteLog(logId: string) {
    try {
      const result = await deleteDisinfectionLog(logId);
      if (result && "error" in result && result.error) toast.error(result.error);
      else toast.success("Log deleted");
    } catch {
      toast.error("Failed to delete log");
    }
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-red-800">Disinfection</p>
          <p className="text-xs text-red-600">{protocol.disinfectant} · {protocol.disinfectionInterval}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-red-300 text-red-700 hover:bg-red-100 gap-1.5 flex-shrink-0"
          onClick={handleLogDisinfection}
          disabled={loggingId === protocol.id}
        >
          {loggingId === protocol.id ? "Logging..." : "Log Disinfection"}
        </Button>
      </div>

      <ProofUploadDialog
        open={proofDialogOpen}
        onOpenChange={setProofDialogOpen}
        onComplete={handleProofComplete}
        onSkip={handleProofSkip}
        patientName={patientName ?? "Patient"}
        category="DISINFECTION"
        actionLabel={`Disinfection with ${protocol.disinfectant}`}
      />

      {protocol.disinfectionLogs.length === 0 ? (
        <p className="text-xs text-red-500">No disinfections logged yet</p>
      ) : (
        <>
          <div className="space-y-1.5">
            {recentLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between gap-2 rounded border border-red-100 bg-white/70 px-2.5 py-1.5"
              >
                <p className="text-xs text-gray-700">{log.performedBy.name}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {formatRelative(log.performedAt)}
                  </span>
                  {isDoctor && (
                    <button type="button" onClick={() => handleDeleteLog(log.id)} className="text-gray-400 hover:text-red-500" aria-label="Delete log">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="border-t border-red-100 pt-2">
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="text-xs font-medium text-red-600">
                  All logs ({protocol.disinfectionLogs.length})
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-red-400 transition-transform",
                    historyOpen && "rotate-180"
                  )}
                />
              </button>
              {historyOpen && (
                <div className="mt-2 space-y-1.5">
                  {protocol.disinfectionLogs.slice(3).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between gap-2 rounded border border-red-100 bg-white/70 px-2.5 py-1.5"
                    >
                      <p className="text-xs text-gray-700">{log.performedBy.name}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {formatDateTimeIST(log.performedAt)} IST
                        </span>
                        {isDoctor && (
                          <button type="button" onClick={() => handleDeleteLog(log.id)} className="text-gray-400 hover:text-red-500" aria-label="Delete log">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function IsolationTab({
  admissionId: _admissionId,
  isolationProtocol,
  labResults,
  isDoctor,
  patientName,
}: IsolationTabProps) {
  const pcrLabResults = labResults.filter((r) => r.testType === "PCR");
  const [editProtocolOpen, setEditProtocolOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Clearance banner */}
      {isolationProtocol.isCleared && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />
          <div>
            <p className="text-sm font-semibold text-green-800">Patient Cleared</p>
            {isolationProtocol.clearedDate && (
              <p className="text-xs text-green-600">
                {formatDateTimeIST(isolationProtocol.clearedDate)} IST
              </p>
            )}
          </div>
        </div>
      )}

      {/* Biosecurity card */}
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 space-y-3">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-red-800 uppercase tracking-wide">
              Isolation Protocol
            </p>
            <p className="text-base font-semibold text-red-900 mt-0.5">
              {isolationProtocol.disease}
            </p>
          </div>
          {isDoctor && (
            <Button variant="outline" size="sm" className="flex-shrink-0 text-xs border-red-300 text-red-700 hover:bg-red-100" onClick={() => setEditProtocolOpen(true)}>
              Edit Protocol
            </Button>
          )}
        </div>

        {/* PPE */}
        {isolationProtocol.ppeRequired.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1.5">
              PPE Required
            </p>
            <div className="flex flex-wrap gap-1.5">
              {isolationProtocol.ppeRequired.map((ppe) => (
                <span
                  key={ppe}
                  className="rounded-full border border-red-300 bg-white/80 px-2.5 py-0.5 text-xs font-medium text-red-700"
                >
                  {ppe}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Biosecurity notes */}
        {isolationProtocol.biosecurityNotes && (
          <div className="rounded border border-red-200 bg-white/60 px-3 py-2">
            <p className="text-xs font-medium text-red-700 mb-0.5">Biosecurity Notes</p>
            <p className="text-xs text-red-800 whitespace-pre-wrap">
              {isolationProtocol.biosecurityNotes}
            </p>
          </div>
        )}
      </div>

      {/* PCR Tracking */}
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900">PCR Status</p>
          {isDoctor && (
            <PcrUpdateDialog
              protocolId={isolationProtocol.id}
              currentPcrStatus={isolationProtocol.pcrStatus}
              currentPcrTrend={isolationProtocol.pcrTrend}
            />
          )}
        </div>

        <div className="flex items-center gap-3">
          <PcrBadge status={isolationProtocol.pcrStatus} />
          {isolationProtocol.pcrTrend && (
            <span className="text-xs text-gray-500">
              Trend: {isolationProtocol.pcrTrend}
            </span>
          )}
        </div>

        {isolationProtocol.lastPcrDate && (
          <p className="text-xs text-gray-400">
            Last tested: {formatDateTimeIST(isolationProtocol.lastPcrDate)} IST
          </p>
        )}

        {/* PCR lab results */}
        {pcrLabResults.length > 0 && (
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              PCR Lab Results
            </p>
            {pcrLabResults.slice(0, 3).map((lab) => (
              <div
                key={lab.id}
                className={cn(
                  "flex items-start justify-between gap-2 rounded border px-3 py-2",
                  lab.isAbnormal
                    ? "border-red-100 bg-red-50"
                    : "border-gray-100 bg-gray-50"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-800">{lab.testName}</p>
                  <p className="text-xs text-gray-500 truncate">{lab.result}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  {lab.isAbnormal && (
                    <span className="text-xs font-semibold text-red-600">Abnormal</span>
                  )}
                  <p className="text-xs text-gray-400">
                    {formatDateTimeIST(lab.resultDate)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Disinfection section */}
      <DisinfectionSection protocol={isolationProtocol} isDoctor={isDoctor} patientName={patientName} />

      {/* Edit Isolation Protocol Sheet */}
      {isDoctor && (
        <EditIsolationSheet
          protocol={isolationProtocol}
          open={editProtocolOpen}
          onOpenChange={setEditProtocolOpen}
        />
      )}
    </div>
  );
}
