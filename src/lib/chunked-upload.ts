const CHUNK_SIZE = 3 * 1024 * 1024; // 3MB chunks (fits under Vercel's 4.5MB body limit)
const MAX_RETRIES = 3;

export interface UploadResult {
  fileId: string;
  shareableLink: string;
  fileName: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunkSize))
    );
  }
  return btoa(binary);
}

export async function uploadFileChunked(
  file: File,
  folderPath: string[],
  fileName: string,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  // Step 1: Init — get resumable upload URI from our API
  const initRes = await fetch("/api/upload/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName,
      mimeType: file.type,
      fileSize: file.size,
      folderPath,
    }),
  });

  if (!initRes.ok) {
    const err = await initRes.json();
    throw new Error(err.error || "Failed to initialize upload");
  }

  const { uploadUri, driveFileId } = await initRes.json();

  // If Google Drive is not configured, uploadUri will be null — return early
  if (!uploadUri) {
    return { fileId: driveFileId ?? "", shareableLink: "", fileName };
  }

  // Step 2: Upload chunks
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    const chunkBuffer = await chunk.arrayBuffer();
    const base64Chunk = arrayBufferToBase64(chunkBuffer);

    let lastError: Error | null = null;
    for (let retry = 0; retry < MAX_RETRIES; retry++) {
      try {
        const chunkRes = await fetch("/api/upload/chunk", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uploadUri,
            chunkData: base64Chunk,
            start,
            end: end - 1,
            totalSize: file.size,
          }),
        });

        if (chunkRes.ok) {
          const data = await chunkRes.json();
          onProgress?.(Math.round((end / file.size) * 100));

          // Last chunk returns the file details
          if (data.driveFileId) {
            return {
              fileId: data.driveFileId,
              shareableLink: data.driveFileUrl,
              fileName,
            };
          }
          break; // Chunk succeeded, move to next
        }

        const status = chunkRes.status;
        if (status >= 400 && status < 500) {
          throw new Error(`Upload failed: ${status}`); // Don't retry 4xx
        }
        // 5xx — retry
        lastError = new Error(`Server error: ${status}`);
      } catch (e) {
        lastError = e as Error;
        if (retry < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, 1000 * (retry + 1))); // Backoff
        }
      }
    }
    if (lastError) throw lastError;
  }

  // Fallback: should not normally reach here
  return { fileId: driveFileId ?? "", shareableLink: "", fileName };
}
