"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NOTE_CATEGORY_LABELS } from "@/lib/constants";
import { addNote } from "@/actions/notes";

interface NoteFormProps {
  admissionId: string;
}

const NOTE_CATEGORIES = [
  "OBSERVATION",
  "BEHAVIOR",
  "WOUND_CARE",
  "ELIMINATION",
  "PROCEDURE",
  "DOCTOR_ROUND",
  "SHIFT_HANDOVER",
  "OTHER",
] as const;

export function NoteForm({ admissionId }: NoteFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    if (category) formData.set("category", category);

    const result = await addNote(admissionId, formData);
    setLoading(false);

    if (result?.error) {
      toast.error(result.error);
    } else if (result?.success) {
      toast.success("Note added successfully");
      setOpen(false);
      setCategory("");
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button className="w-full gap-2" />
        }
      >
        <Plus className="w-4 h-4" />
        Add Note
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto pb-safe">
        <SheetHeader>
          <SheetTitle>Add Clinical Note</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="px-4 pb-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v ?? "")}>
              <SelectTrigger className="w-full h-12">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {NOTE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {NOTE_CATEGORY_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="content">Note</Label>
            <Textarea
              id="content"
              name="content"
              placeholder="Enter clinical note..."
              rows={5}
              autoFocus
              required
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Saving..." : "Save Note"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
