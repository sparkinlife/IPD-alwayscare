"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { permanentlyDeletePatient } from "@/actions/admissions";

interface PermanentDeleteButtonProps {
  patientId: string;
  patientName: string;
}

export function PermanentDeleteButton({ patientId, patientName }: PermanentDeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const result = await permanentlyDeletePatient(patientId);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${patientName} permanently deleted`);
        setOpen(false);
      }
    } catch {
      toast.error("Failed to delete patient");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5"
          />
        }
      >
        <Trash2 className="w-4 h-4" />
        Permanently Delete
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Permanently delete {patientName}?</DialogTitle>
          <DialogDescription>
            This will permanently delete all records for this patient. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? "Deleting..." : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
