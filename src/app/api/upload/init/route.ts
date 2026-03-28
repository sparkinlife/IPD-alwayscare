import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getGoogleAuth, getGoogleDrive } from "@/lib/google-auth";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role === "MANAGEMENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { fileName, mimeType, fileSize, folderPath } = await request.json();

    if (!fileName || !mimeType || !fileSize) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const ALLOWED_TYPES = [
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "application/pdf", "video/mp4", "video/quicktime", "video/webm",
    ];
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB max

    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum 100MB." }, { status: 400 });
    }

    // If Google Drive is not configured, signal the client to skip chunked upload
    if (
      !process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
      !process.env.GOOGLE_DRIVE_FOLDER_ID
    ) {
      return NextResponse.json(
        { error: "Google Drive not configured", uploadUri: null, driveFileId: null },
        { status: 200 }
      );
    }

    const auth = getGoogleAuth();
    const drive = getGoogleDrive();

    // Create nested folder structure
    let parentId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
    if (folderPath && Array.isArray(folderPath)) {
      for (const segment of folderPath) {
        const safeName = segment
          .replace(/\\/g, "\\\\")
          .replace(/'/g, "\\'");
        const query = await drive.files.list({
          q: `name='${safeName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: "files(id)",
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });
        if (query.data.files && query.data.files.length > 0) {
          parentId = query.data.files[0].id!;
        } else {
          // Guard against TOCTOU race: another concurrent request may have created the folder
          try {
            const folder = await drive.files.create({
              requestBody: {
                name: segment,
                mimeType: "application/vnd.google-apps.folder",
                parents: [parentId],
              },
              fields: "id",
              supportsAllDrives: true,
            });
            parentId = folder.data.id!;
          } catch {
            // Folder may have been created by a concurrent request — re-query
            const retryQuery = await drive.files.list({
              q: `name='${safeName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
              fields: "files(id)",
              supportsAllDrives: true,
              includeItemsFromAllDrives: true,
            });
            if (retryQuery.data.files?.length) {
              parentId = retryQuery.data.files[0].id!;
            } else {
              throw new Error(`Failed to create folder: ${segment}`);
            }
          }
        }
      }
    }

    // Create resumable upload session directly against Google Drive
    const authClient = await auth.getClient();
    const accessToken = await authClient.getAccessToken();

    const initRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken.token}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": mimeType,
          "X-Upload-Content-Length": String(fileSize),
        },
        body: JSON.stringify({
          name: fileName,
          parents: [parentId],
        }),
      }
    );

    if (!initRes.ok) {
      const err = await initRes.text();
      console.error("Drive resumable init error:", err);
      return NextResponse.json(
        { error: "Failed to init upload" },
        { status: 500 }
      );
    }

    const uploadUri = initRes.headers.get("Location");
    if (!uploadUri) {
      return NextResponse.json(
        { error: "No upload URI returned from Google Drive" },
        { status: 500 }
      );
    }

    return NextResponse.json({ uploadUri, driveFileId: null });
  } catch (error) {
    console.error("Upload init error:", error);
    return NextResponse.json(
      { error: "Failed to initialize upload" },
      { status: 500 }
    );
  }
}
