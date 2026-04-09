"use client";

import { useCallback, useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";

import { isVideo } from "@/lib/media-utils";
import { driveMediaUrl } from "@/lib/drive-url";

interface LightboxItem {
  fileId: string;
  fileName?: string;
  patientName: string;
  actionType: string;
  actionDetail: string;
  performedBy: string;
  timestamp: Date;
  isSkipped: boolean;
  skipReason: string | null;
}

interface ProofLightboxProps {
  items: LightboxItem[];
  initialIndex: number;
  onClose: () => void;
}

export function ProofLightbox({ items, initialIndex, onClose }: ProofLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const item = items[index];

  const prev = useCallback(() => setIndex((i) => (i > 0 ? i - 1 : items.length - 1)), [items.length]);
  const next = useCallback(() => setIndex((i) => (i < items.length - 1 ? i + 1 : 0)), [items.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  if (!item) return null;

  const timeStr = formatInTimeZone(new Date(item.timestamp), "Asia/Kolkata", "dd/MM HH:mm");

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between p-4 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <p className="font-medium truncate">{item.patientName}</p>
          <p className="text-sm text-white/70">
            {item.actionType} — {item.actionDetail} · {timeStr} · {item.performedBy}
          </p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full shrink-0">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center relative" onClick={(e) => e.stopPropagation()}>
        {items.length > 1 && (
          <button onClick={prev} className="absolute left-2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 z-10">
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {item.isSkipped ? (
          <div className="text-white text-center p-8">
            <p className="text-lg">Photo skipped</p>
            <p className="text-white/70 mt-2">{item.skipReason ?? "No reason provided"}</p>
          </div>
        ) : isVideo(item.fileName ?? item.actionDetail) ? (
          <video
            src={driveMediaUrl(item.fileId)}
            controls
            autoPlay
            className="max-h-[80vh] max-w-full rounded-lg"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={driveMediaUrl(item.fileId)}
            alt={`${item.actionType} proof for ${item.patientName}`}
            className="max-h-[80vh] max-w-full object-contain"
          />
        )}

        {items.length > 1 && (
          <button onClick={next} className="absolute right-2 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 z-10">
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {items.length > 1 && (
        <div className="text-center text-white/50 text-sm pb-4">
          {index + 1} / {items.length}
        </div>
      )}
    </div>
  );
}
