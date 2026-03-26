import { Card, CardContent } from "@/components/ui/card";
import { formatDateTimeIST } from "@/lib/date-utils";
import { NOTE_CATEGORY_LABELS, NOTE_ROLE_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { NoteForm } from "./note-form";

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

export function NotesTab({ admissionId, notes, isDoctor }: NotesTabProps) {
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
                        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                          {formatDateTimeIST(note.recordedAt)} IST
                        </span>
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
    </div>
  );
}
