"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Camera, X, AlertTriangle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { buildDriveFolderPath, buildDriveFileName } from "@/lib/drive-path";

export interface ProofFile {
  fileUrl: string;
  fileId: string;
  fileName: string;
}

export interface ProofUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (proofs: ProofFile[]) => void;
  onSkip: (reason: string) => void;
  patientName: string;
  category: "MEDS" | "FOOD" | "VITALS" | "BATH" | "DISINFECTION";
  actionLabel: string;
}

const SKIP_REASONS = [
  "Camera not available",
  "Emergency situation",
  "Photos taken on personal device - will upload later",
  "Other",
];

export function ProofUploadDialog({
  open,
  onOpenChange,
  onComplete,
  onSkip,
  patientName,
  category,
  actionLabel,
}: ProofUploadDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [skipExpanded, setSkipExpanded] = useState(false);
  const [skipReason, setSkipReason] = useState(SKIP_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setSelectedFiles([]);
    setPreviews([]);
    setUploading(false);
    setUploadProgress("");
    setSkipExpanded(false);
    setSkipReason(SKIP_REASONS[0]);
    setCustomReason("");
  }

  function handleClose() {
    if (!uploading) {
      onOpenChange(false);
      reset();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const newPreviews = files.map((f) => {
      if (f.type.startsWith("image/")) {
        return URL.createObjectURL(f);
      }
      return "video";
    });

    setSelectedFiles((prev) => [...prev, ...files]);
    setPreviews((prev) => [...prev, ...newPreviews]);

    // Reset file input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      const url = prev[index];
      if (url && url !== "video") URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleUploadAndSubmit() {
    setUploading(true);
    const proofs: ProofFile[] = [];

    try {
      const folderPath = buildDriveFolderPath(patientName, category);

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setUploadProgress(`Uploading ${i + 1} of ${selectedFiles.length}...`);

        try {
          const fileName = buildDriveFileName(category, actionLabel);
          const ext = file.name.split(".").pop() ?? "";
          const fullFileName = ext ? `${fileName}.${ext}` : fileName;

          const formData = new FormData();
          formData.set("file", file, file.name);
          formData.set("folderPath", JSON.stringify(folderPath));

          const res = await fetch("/api/uploads", {
            method: "POST",
            body: formData,
          });

          if (res.ok) {
            const data = await res.json();
            if (data.fileId && data.shareableLink) {
              proofs.push({
                fileUrl: data.shareableLink,
                fileId: data.fileId,
                fileName: fullFileName,
              });
            }
            // If Google Drive not configured, data.fileId is null — skip silently
          }
          // If upload fails for a single file, continue with others
        } catch {
          // Individual file upload failure — continue
        }
      }

      setUploadProgress("Done!");
      onOpenChange(false);
      reset();
      onComplete(proofs);
    } catch {
      toast.error("Upload encountered an error");
      // Still complete the action even if upload fails
      onOpenChange(false);
      reset();
      onComplete(proofs);
    } finally {
      setUploading(false);
    }
  }

  function handleSkipSubmit() {
    const reason = skipReason === "Other" ? (customReason.trim() || "Other") : skipReason;
    onOpenChange(false);
    reset();
    onSkip(reason);
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto pb-safe">
        <SheetHeader>
          <SheetTitle>Upload Proof</SheetTitle>
          <p className="text-sm text-gray-500 px-0 mt-0.5">{actionLabel}</p>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-4">
          {/* Warning banner */}
          <div className="flex items-start gap-2.5 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600" />
            <p className="text-xs text-yellow-800">
              Uploading proof photos is standard protocol at Always Care. Please upload at least one photo whenever possible.
            </p>
          </div>

          {/* File input area */}
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center transition-colors hover:border-teal-400 hover:bg-teal-50 active:scale-[0.99] disabled:opacity-50"
            >
              <Camera className="h-8 w-8 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">
                Tap to take photo or select files
              </span>
              <span className="text-xs text-gray-400">
                Images or videos accepted
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </div>

          {/* Selected files grid */}
          {selectedFiles.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                  {previews[index] && previews[index] !== "video" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previews[index]}
                      alt={file.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="text-xs font-medium text-gray-500 text-center px-1 break-words">
                        {file.type.startsWith("video/") ? "Video" : file.name}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    disabled={uploading}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 disabled:opacity-50"
                    aria-label="Remove file"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload & Submit button */}
          <Button
            type="button"
            onClick={handleUploadAndSubmit}
            disabled={uploading || selectedFiles.length === 0}
            className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-base gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {uploadProgress || "Uploading..."}
              </>
            ) : (
              `Upload & Submit (${selectedFiles.length} file${selectedFiles.length !== 1 ? "s" : ""})`
            )}
          </Button>

          {/* Skip section */}
          <div className="rounded-lg border border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={() => setSkipExpanded((v) => !v)}
              disabled={uploading}
              className="flex w-full items-center justify-between px-4 py-3 text-left disabled:opacity-50"
            >
              <span className="text-sm font-medium text-gray-600">Submit without photo</span>
              {skipExpanded ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>

            {skipExpanded && (
              <div className="border-t border-gray-200 px-4 pb-4 pt-3 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Reason</label>
                  <select
                    value={skipReason}
                    onChange={(e) => setSkipReason(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {SKIP_REASONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                {skipReason === "Other" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600">Specify reason</label>
                    <input
                      type="text"
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Enter reason..."
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSkipSubmit}
                  disabled={uploading || (skipReason === "Other" && !customReason.trim())}
                  className="w-full"
                >
                  Submit Without Photo
                </Button>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
