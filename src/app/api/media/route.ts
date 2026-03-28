import { NextRequest, NextResponse } from "next/server";
import { getGoogleDrive } from "@/lib/google-auth";
import { getSession } from "@/lib/auth";

/**
 * Proxy Google Drive files through our API so they can be rendered in <img>/<video> tags.
 * Google Drive blocks direct hotlinking for service-account-shared files.
 *
 * Usage: /api/media?id=GOOGLE_DRIVE_FILE_ID
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fileId = request.nextUrl.searchParams.get("id");
  if (!fileId) {
    return NextResponse.json({ error: "Missing file ID" }, { status: 400 });
  }

  try {
    const drive = getGoogleDrive();

    // Get file metadata for content type
    const meta = await drive.files.get({
      fileId,
      fields: "mimeType,size",
      supportsAllDrives: true,
    });
    const mimeType = meta.data.mimeType || "application/octet-stream";

    // Stream the file content
    const res = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "stream" }
    );

    const stream = res.data as unknown as NodeJS.ReadableStream;

    // Convert Node stream to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk: Buffer) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err: Error) => controller.error(err));
      },
    });

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=86400, immutable",
        ...(meta.data.size ? { "Content-Length": String(meta.data.size) } : {}),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch file";
    console.error("Media proxy error:", message);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
