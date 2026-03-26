"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { formatDateTimeIST } from "@/lib/date-utils";
import { NOTE_CATEGORY_LABELS, NOTE_ROLE_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { NoteForm } from "./note-form";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { updateNote, deleteNote } from "@/actions/notes";

interface ClinicalNote {
  id: string;
  category: string;
  content: string;
  recordedAt: Date;
  recordedBy: { name: string; role: string } | null;
}

interface NotesTabProps {
  admissionId: string;
  notes: ClinicalNote[];
  isDoctor: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  OBSERVATION: "bg-blue-100 text-blue-700",
  BEHAVIOR: "bg-orange-100 text-orange-700",
  WOUND_CARE: "bg-red-100 text-red-700",
  ELIMINATION: "bg-yellow-100 text-yellow-700",
  PROCEDURE: "bg-purple-100 text-purple-700",
  DOCTOR_ROUND: "bg-violet-100 text-violet-700",
  SHIFT_HANDOVER: "bg-teal-100 text-teal-700",
  OTHER: "bg-gray-100 text-gray-600",
};

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

// ─── Edit Note Sheet ──────────────────────────────────────────────────────────

function EditNoteSheet({
  note,
  open,
  onOpenChange,
}: {
  note: ClinicalNote;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState(note.category);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    if (category) formData.set("category", category);
    try {
      const result = await updateNote(note.id, formData);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Note updated");
        onOpenChange(false);
      }
    } catch {
      toast.error("Failed to update note");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto pb-safe">
        <SheetHeader>
          <SheetTitle>Edit Note</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="px-4 pb-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v ?? category)}>
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
            <Label htmlFor="edit-content">Note</Label>
            <Textarea id="edit-content" name="content" rows={5} defaultValue={note.content} required />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading}>{loading ? "Saving..." : "Update Note"}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function NotesTab({ admissionId, notes, isDoctor }: NotesTabProps) {
  const [editNote, setEditNote] = useState<ClinicalNote | null>(null);

  async function handleDelete(noteId: string) {
    try {
      const result = await deleteNote(noteId);
      if (result && "error" in result && result.error) toast.error(result.error);
      else toast.success("Note deleted");
    } catch {
      toast.error("Failed to delete note");
    }
  }

  return (
    <div className="space-y-4">
      {notes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No clinical notes yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-4">
            {notes.map((note) => {
              const roleColor =
                note.recordedBy?.role
                  ? (NOTE_ROLE_COLORS[note.recordedBy.role] ?? "text-gray-500")
                  : "text-gray-500";
              const categoryColor =
                CATEGORY_COLORS[note.category] ?? "bg-gray-100 text-gray-600";

              return (
                <div key={note.id} className="relative pl-9">
                  {/* Timeline dot */}
                  <div className="absolute left-2 top-2 w-3 h-3 rounded-full bg-background border-2 border-border" />

                  <Card>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={cn(
                              "inline-block text-xs font-medium px-2 py-0.5 rounded-full",
                              categoryColor
                            )}
                          >
                            {NOTE_CATEGORY_LABELS[note.category] ?? note.category}
                          </span>
                          {note.recordedBy && (
                            <span className={cn("text-xs font-medium", roleColor)}>
                              {note.recordedBy.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDateTimeIST(note.recordedAt)} IST
                          </span>
                          {isDoctor && (
                            <ActionsMenu
                              onEdit={() => setEditNote(note)}
                              onDelete={() => handleDelete(note.id)}
                              deleteConfirmMessage="Delete this clinical note? This action cannot be undone."
                            />
                          )}
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.content}</p>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="pt-2">
        <NoteForm admissionId={admissionId} />
      </div>

      {/* Edit Note Sheet */}
      {editNote && (
        <EditNoteSheet
          note={editNote}
          open={!!editNote}
          onOpenChange={(open) => { if (!open) setEditNote(null); }}
        />
      )}
    </div>
  );
}
