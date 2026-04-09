import type { LogsTimelineEntry } from "@/lib/logs-read-model";
import { cn } from "@/lib/utils";
import {
  buildManagementHistoryDaySections,
  type ManagementHistoryProofAttachment,
} from "@/lib/management-history-data";
import { driveMediaUrl } from "@/lib/drive-url";
import { isVideo } from "@/lib/media-utils";
import { Play } from "lucide-react";

interface HistoryTabProps {
  notes: { id: string; category: string; content: string; recordedAt: Date; recordedBy: { name: string; role: string } }[];
  labs: { id: string; testName: string; testType: string; result: string; isAbnormal: boolean; resultDate: Date | null; notes: string | null }[];
  logEntries: LogsTimelineEntry[];
  proofAttachments: ManagementHistoryProofAttachment[];
}

const TONE_STYLES: Record<string, string> = {
  default: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  note: "bg-violet-100 text-violet-700",
};

const DAY_BADGE_STYLES: Record<string, string> = {
  Today: "bg-foreground text-background",
  Yesterday: "bg-amber-100 text-amber-800",
};

export function HistoryTab({ notes, labs, logEntries, proofAttachments }: HistoryTabProps) {
  const sections = buildManagementHistoryDaySections({ labs, logEntries, proofAttachments });
  const totalItems = sections.reduce((count, section) => count + section.items.length, 0);

  return (
    <div className="space-y-6 pb-8">
      <section className="space-y-3">
        <div className="border-b border-border/70 pb-3">
          <h3 className="text-sm font-semibold text-foreground">Patient history</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Full clinical trail grouped by day, including notes, care actions, lab updates, and proof media.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-border/50 pb-4 sm:grid-cols-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Notes</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{notes.length}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Labs</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{labs.length}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Proofs</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{proofAttachments.length}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Timeline</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{totalItems}</p>
          </div>
        </div>
      </section>

      {sections.length === 0 ? (
        <p className="px-1 py-10 text-sm text-muted-foreground">No history recorded yet</p>
      ) : (
        <div className="space-y-7">
          {sections.map((section) => (
            <section key={section.key} className="space-y-3">
              <div className="flex items-center gap-3 border-b border-border/60 pb-2">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                    DAY_BADGE_STYLES[section.label] ?? "bg-muted text-foreground"
                  )}
                >
                  {section.label}
                </span>
                <span className="text-xs text-muted-foreground">{section.dateLabel}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {section.items.length} {section.items.length === 1 ? "entry" : "entries"}
                </span>
              </div>

              <div className="space-y-0">
                {section.items.map((item) => (
                  <article
                    key={item.key}
                    className="grid grid-cols-[3.25rem_1fr] gap-3 border-b border-border/40 py-3 last:border-b-0"
                  >
                    <div className="pt-0.5 text-[11px] tabular-nums text-muted-foreground">
                      {item.timeLabel}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-start gap-2.5">
                        <span className="text-base leading-none">{item.icon}</span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                                TONE_STYLES[item.tone]
                              )}
                            >
                              {item.kindLabel}
                            </span>
                            <p className="min-w-0 text-sm font-medium text-foreground">
                              {item.title}
                            </p>
                          </div>

                          {item.description && (
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                              {item.description}
                            </p>
                          )}

                          {item.meta && (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {item.meta}
                            </p>
                          )}

                          {item.media?.isSkipped && (
                            <div className="mt-2 flex w-full max-w-[15rem] items-center justify-center rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-5 text-center text-xs font-medium text-amber-800">
                              Photo skipped
                            </div>
                          )}

                          {item.media && !item.media.isSkipped && (
                            <div className="mt-2 w-full max-w-[15rem] overflow-hidden rounded-xl border border-border/60 bg-muted/40">
                              {isVideo(item.media.fileName) ? (
                                <div className="relative aspect-[4/3]">
                                  <video
                                    src={driveMediaUrl(item.media.fileId)}
                                    className="h-full w-full object-cover"
                                    muted
                                    preload="metadata"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/15">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55">
                                      <Play className="h-4 w-4 fill-white text-white" />
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={driveMediaUrl(item.media.fileId)}
                                  alt={`${item.media.categoryLabel} proof`}
                                  className="aspect-[4/3] h-full w-full object-cover"
                                  loading="lazy"
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
