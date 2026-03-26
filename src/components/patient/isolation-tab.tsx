"use client";

import { useState } from "react";
import { ShieldAlert, CheckCircle2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDateTimeIST, formatRelative } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { logDisinfection, updateIsolationProtocol } from "@/actions/isolation";

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
      if (result?.success) {
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

// ─── Disinfection Log Section ─────────────────────────────────────────────────

function DisinfectionSection({
  protocol,
}: {
  protocol: IsolationProtocol;
}) {
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const recentLogs = protocol.disinfectionLogs.slice(0, 3);
  const hasMore = protocol.disinfectionLogs.length > 3;

  async function handleLogDisinfection() {
    setLoggingId(protocol.id);
    try {
      const result = await logDisinfection(protocol.id);
      if (result?.success) {
        toast.success("Disinfection logged");
      }
    } catch {
      toast.error("Failed to log disinfection");
    } finally {
      setLoggingId(null);
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
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {formatRelative(log.performedAt)}
                </span>
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
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatDateTimeIST(log.performedAt)} IST
                      </span>
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
}: IsolationTabProps) {
  const pcrLabResults = labResults.filter((r) => r.testType === "PCR");

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
      <DisinfectionSection protocol={isolationProtocol} />
    </div>
  );
}
