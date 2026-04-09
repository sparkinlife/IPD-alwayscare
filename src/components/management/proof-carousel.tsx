"use client";

import { useRef, useState } from "react";
import type { ProofCarouselItem } from "@/lib/management-dashboard-queries";
import { ProofLightbox } from "./proof-lightbox";
import { formatInTimeZone } from "date-fns-tz";
import { Camera, Play } from "lucide-react";
import { driveMediaUrl } from "@/lib/drive-url";
import { isVideo } from "@/lib/media-utils";

interface ProofCarouselProps {
  items: ProofCarouselItem[];
}

const ACTION_COLORS: Record<string, string> = {
  Med: "bg-blue-100 text-blue-700",
  Fed: "bg-green-100 text-green-700",
  Bath: "bg-cyan-100 text-cyan-700",
  Vitals: "bg-purple-100 text-purple-700",
  Disinfect: "bg-orange-100 text-orange-700",
};

export function ProofCarousel({ items }: ProofCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (items.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-muted-foreground text-sm">
        <Camera className="w-5 h-5 mx-auto mb-1 opacity-50" />
        No proofs recorded today
      </div>
    );
  }

  return (
    <>
      <div className="px-4 py-2">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent Proofs</h3>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto px-4 pb-3 snap-x snap-mandatory"
        style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
      >
        {items.map((item, i) => (
          <button
            key={`${item.fileId}-${i}`}
            className="shrink-0 w-28 snap-start rounded-lg overflow-hidden border bg-card shadow-sm active:scale-95 transition-transform"
            onClick={() => setLightboxIndex(i)}
          >
            {item.isSkipped ? (
              <div className="h-24 bg-muted flex items-center justify-center text-[10px] leading-tight text-muted-foreground px-2 text-center">
                Photo skipped
              </div>
            ) : isVideo(item.fileName) ? (
              <div className="relative h-24">
                <video src={driveMediaUrl(item.fileId)} className="h-24 w-full object-cover" muted preload="metadata" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center">
                    <Play className="w-3 h-3 text-white fill-white" />
                  </div>
                </div>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={driveMediaUrl(item.fileId)}
                alt={`${item.actionType} proof`}
                className="h-24 w-full object-cover"
                loading="lazy"
              />
            )}
            <div className="p-1.5">
              <p className="text-[10px] font-medium truncate">{item.patientName}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${ACTION_COLORS[item.actionType] ?? "bg-gray-100 text-gray-700"}`}>
                  {item.actionType}
                </span>
                <span className="text-[9px] text-muted-foreground">
                  {formatInTimeZone(new Date(item.timestamp), "Asia/Kolkata", "HH:mm")}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <ProofLightbox
          items={items}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
