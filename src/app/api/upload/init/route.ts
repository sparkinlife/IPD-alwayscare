import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { google } from "googleapis";

function getAuth() {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!key) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not set");
  const credentials = JSON.parse(Buffer.from(key, "base64").toString());
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { fileName, mimeType, fileSize, folderPath } = await request.json();

    if (!fileName || !mimeType || !fileSize) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
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

    const auth = getAuth();
    const drive = google.drive({ version: "v3", auth });

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
        });
        if (query.data.files && query.data.files.length > 0) {
          parentId = query.data.files[0].id!;
        } else {
          const folder = await drive.files.create({
            requestBody: {
              name: segment,
              mimeType: "application/vnd.google-apps.folder",
              parents: [parentId],
            },
            fields: "id",
          });
          parentId = folder.data.id!;
        }
      }
    }

    // Create resumable upload session directly against Google Drive
    const authClient = await auth.getClient();
    const accessToken = await authClient.getAccessToken();

    const initRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
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
