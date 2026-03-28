import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role === "MANAGEMENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { uploadUri, chunkData, start, end, totalSize } =
      await request.json();

    if (
      !uploadUri ||
      !chunkData ||
      start === undefined ||
      end === undefined ||
      !totalSize
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // SSRF protection: enforce HTTPS, googleapis.com domain, and Drive upload path
    const url = new URL(uploadUri);
    if (url.protocol !== "https:" || url.hostname !== "www.googleapis.com" || !url.pathname.startsWith("/upload/drive")) {
      return NextResponse.json({ error: "Invalid upload URI" }, { status: 400 });
    }

    // Decode base64 chunk
    const chunkBuffer = Buffer.from(chunkData, "base64");

    const res = await fetch(uploadUri, {
      method: "PUT",
      headers: {
        "Content-Range": `bytes ${start}-${end}/${totalSize}`,
        "Content-Length": String(chunkBuffer.length),
      },
      body: chunkBuffer,
    });

    // 308 Resume Incomplete — chunk uploaded, more to go
    if (res.status === 308) {
      return NextResponse.json({ status: "incomplete", uploaded: end + 1 });
    }

    // 200/201 — upload complete
    if (res.ok) {
      const data = await res.json();
      const driveFileId = data.id as string;

      // Make file publicly readable and retrieve the shareable link
      const { getGoogleDrive } = await import("@/lib/google-auth");
      const drive = getGoogleDrive();

      try {
        await drive.permissions.create({
          fileId: driveFileId,
          requestBody: { role: "reader", type: "anyone" },
          supportsAllDrives: true,
        });
      } catch (e) {
        console.error("Failed to set file permissions:", e);
        // Don't fail — file is uploaded, just not publicly viewable yet
      }

      const fileInfo = await drive.files.get({
        fileId: driveFileId,
        fields: "webViewLink",
        supportsAllDrives: true,
      });

      return NextResponse.json({
        driveFileId,
        driveFileUrl: fileInfo.data.webViewLink,
        status: "complete",
      });
    }

    // Any other status is an error
    const errText = await res.text();
    console.error("Chunk upload error:", res.status, errText);
    return NextResponse.json(
      { error: `Upload failed: ${res.status}` },
      { status: res.status }
    );
  } catch (error) {
    console.error("Chunk proxy error:", error);
    return NextResponse.json({ error: "Chunk upload failed" }, { status: 500 });
  }
}
