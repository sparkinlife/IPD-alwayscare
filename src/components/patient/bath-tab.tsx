"use client";

import { useState } from "react";
import { Droplets, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isBathDue, formatDateTimeIST, formatRelative } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { logBath, updateBath, deleteBath } from "@/actions/baths";
import { ActionsMenu } from "@/components/ui/actions-menu";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BathLog {
  id: string;
  bathedAt: Date;
  notes: string | null;
  bathedBy: { name: string };
}

interface BathTabProps {
  admissionId: string;
  bathLogs: BathLog[];
  admissionDate: Date;
  isDoctor?: boolean;
}

// ─── Bath Status Banner ───────────────────────────────────────────────────────

function BathStatusBanner({
  lastBathDate,
  admissionDate,
}: {
  lastBathDate: Date | null;
  admissionDate: Date;
}) {
  const reference = lastBathDate ?? admissionDate;
  const { isDue, isOverdue, daysSinceLast } = isBathDue(reference);

  let bgColor: string;
  let textColor: string;
  let dotColor: string;
  let label: string;
  let sublabel: string;

  if (isOverdue) {
    bgColor = "bg-red-50 border-red-200";
    textColor = "text-red-700";
    dotColor = "bg-red-500";
    label = "Overdue";
    sublabel = `${daysSinceLast} day${daysSinceLast === 1 ? "" : "s"} since last bath`;
  } else if (isDue) {
    bgColor = "bg-orange-50 border-orange-200";
    textColor = "text-orange-700";
    dotColor = "bg-orange-500";
    label = "Bath Due";
    sublabel = `${daysSinceLast} day${daysSinceLast === 1 ? "" : "s"} since last bath`;
  } else {
    bgColor = "bg-green-50 border-green-200";
    textColor = "text-green-700";
    dotColor = "bg-green-500";
    label = "Recently Bathed";
    sublabel =
      daysSinceLast === 0
        ? "Bathed today"
        : `${daysSinceLast} day${daysSinceLast === 1 ? "" : "s"} ago`;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-3",
        bgColor
      )}
    >
      <span className={cn("h-3 w-3 flex-shrink-0 rounded-full", dotColor)} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold", textColor)}>{label}</p>
        <p className={cn("text-xs", textColor, "opacity-80")}>{sublabel}</p>
      </div>
      <Droplets className={cn("h-5 w-5 flex-shrink-0", textColor)} />
    </div>
  );
}

// ─── Log Bath Sheet ───────────────────────────────────────────────────────────

function LogBathSheet({ admissionId }: { admissionId: string }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData();
      if (notes) formData.set("notes", notes);
      const result = await logBath(admissionId, formData);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Bath logged successfully");
        setNotes("");
        setOpen(false);
      }
    } catch {
      toast.error("Failed to log bath");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setNotes("");
      }}
    >
      <SheetTrigger
        render={
          <Button size="sm" className="gap-1.5" />
        }
      >
        <Droplets className="h-4 w-4" />
        Log Bath
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle>Log Bath</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 px-1">
          <div className="space-y-1.5">
            <Label htmlFor="bath-notes">Notes (optional)</Label>
            <Textarea
              id="bath-notes"
              rows={3}
              placeholder="Any observations, shampoo used, condition of coat..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setOpen(false);
                setNotes("");
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Saving..." : "Confirm Bath"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Edit Bath Sheet ──────────────────────────────────────────────────────────

function EditBathSheet({
  bath,
  open,
  onOpenChange,
}: {
  bath: BathLog;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData(e.currentTarget);
      const result = await updateBath(bath.id, formData);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Bath log updated");
        onOpenChange(false);
      }
    } catch {
      toast.error("Failed to update bath log");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader>
          <SheetTitle>Edit Bath Notes</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 px-1">
          <div className="space-y-1.5">
            <Label htmlFor="edit-bath-notes">Notes</Label>
            <Textarea id="edit-bath-notes" name="notes" rows={3} defaultValue={bath.notes ?? ""} placeholder="Any observations..." />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading}>{loading ? "Saving..." : "Update"}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Bath History ─────────────────────────────────────────────────────────────

function BathHistory({ bathLogs, isDoctor, onEdit, onDelete }: { bathLogs: BathLog[]; isDoctor?: boolean; onEdit: (bath: BathLog) => void; onDelete: (bathId: string) => void }) {
  const [open, setOpen] = useState(false);

  if (bathLogs.length === 0) return null;

  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Bath History ({bathLogs.length})
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-gray-400 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {bathLogs.map((log) => (
            <div
              key={log.id}
              className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-700">
                    Bathed by {log.bathedBy.name}
                  </p>
                  {log.notes && (
                    <p className="mt-0.5 text-xs text-gray-500">{log.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {formatRelative(log.bathedAt)}
                  </span>
                  {isDoctor && (
                    <ActionsMenu
                      onEdit={() => onEdit(log)}
                      onDelete={() => onDelete(log.id)}
                      deleteConfirmMessage="Delete this bath log? This action cannot be undone."
                    />
                  )}
                </div>
              </div>
              <p className="mt-0.5 text-xs text-gray-400">
                {formatDateTimeIST(log.bathedAt)} IST
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BathTab({
  admissionId,
  bathLogs,
  admissionDate,
  isDoctor,
}: BathTabProps) {
  const lastBathLog = bathLogs[0] ?? null;
  const lastBathDate = lastBathLog ? lastBathLog.bathedAt : null;
  const [editBath, setEditBath] = useState<BathLog | null>(null);

  async function handleDelete(bathId: string) {
    try {
      const result = await deleteBath(bathId);
      if (result && "error" in result && result.error) toast.error(result.error);
      else toast.success("Bath log deleted");
    } catch {
      toast.error("Failed to delete bath log");
    }
  }

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <BathStatusBanner
        lastBathDate={lastBathDate}
        admissionDate={admissionDate}
      />

      {/* Log bath action */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">Bath Tracking</p>
          <p className="text-xs text-gray-400">
            {lastBathDate
              ? `Last: ${formatDateTimeIST(lastBathDate)} IST`
              : "No bath logged yet"}
          </p>
        </div>
        <LogBathSheet admissionId={admissionId} />
      </div>

      {/* Bath history */}
      <BathHistory bathLogs={bathLogs} isDoctor={isDoctor} onEdit={(bath) => setEditBath(bath)} onDelete={handleDelete} />

      {/* Edit Bath Sheet */}
      {editBath && (
        <EditBathSheet
          bath={editBath}
          open={!!editBath}
          onOpenChange={(open) => { if (!open) setEditBath(null); }}
        />
      )}
    </div>
  );
}
