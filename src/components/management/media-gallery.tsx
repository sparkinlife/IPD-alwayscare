"use client";

import { useState } from "react";
import { ProofLightbox } from "./proof-lightbox";
import { driveMediaUrl } from "@/lib/drive-url";
import { Play } from "lucide-react";
import { isVideo } from "@/lib/media-utils";

interface MediaItem {
  fileId: string;
  fileName: string;
  category: string;
  uploadedBy: string;
  createdAt: Date;
  isSkipped: boolean;
  skipReason: string | null;
}

interface MediaGalleryProps {
  patientPhotos: { fileId: string; fileName: string; uploadedBy: { name: string }; createdAt: Date }[];
  proofAttachments: MediaItem[];
  patientName: string;
}

const CATEGORIES = ["All", "Patient Photos", "Medication", "Feeding", "Bath", "Vitals", "Disinfection"] as const;

export function MediaGallery({ patientPhotos, proofAttachments, patientName }: MediaGalleryProps) {
  const [filter, setFilter] = useState<string>("All");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const allItems: MediaItem[] = [
    ...patientPhotos.map((p) => ({
      fileId: p.fileId,
      fileName: p.fileName,
      category: "Patient Photos",
      uploadedBy: p.uploadedBy.name,
      createdAt: p.createdAt,
      isSkipped: false,
      skipReason: null,
    })),
    ...proofAttachments.filter((p) => !p.isSkipped),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filtered = filter === "All"
    ? allItems
    : allItems.filter((item) => item.category.toLowerCase().includes(filter.toLowerCase()));
  const skipped = proofAttachments.filter((p) => p.isSkipped);

  return (
    <div className="space-y-4 pb-8">
      {/* Category Filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filter === cat ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
        {filtered.map((item, i) => (
          <button
            key={`${item.fileId}-${i}`}
            onClick={() => setLightboxIndex(i)}
            className="relative aspect-square rounded-lg overflow-hidden bg-muted"
          >
            {isVideo(item.fileName) ? (
              <>
                <video
                  src={driveMediaUrl(item.fileId)}
                  className="w-full h-full object-cover"
                  muted
                  preload="metadata"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                    <Play className="w-4 h-4 text-white fill-white" />
                  </div>
                </div>
              </>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={driveMediaUrl(item.fileId)}
                alt={item.fileName}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            )}
            <span className="absolute bottom-0.5 left-0.5 text-[8px] bg-black/60 text-white px-1 py-0.5 rounded">
              {item.category.split(" ")[0]}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">No media in this category</p>
      )}

      {/* Skipped Proofs */}
      {skipped.length > 0 && (
        <div className="px-1">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">Skipped Photos ({skipped.length})</h4>
          {skipped.map((s, i) => (
            <div key={i} className="text-xs text-muted-foreground py-1 border-b last:border-0">
              {s.category} photo skipped{ s.skipReason ? ` · ${s.skipReason}` : "" }
            </div>
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <ProofLightbox
          items={filtered.map((item) => ({
            fileId: item.fileId,
            fileName: item.fileName,
            patientName,
            actionType: item.category,
            actionDetail: item.fileName,
            performedBy: item.uploadedBy,
            timestamp: item.createdAt,
            isSkipped: item.isSkipped,
            skipReason: item.skipReason,
          }))}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
