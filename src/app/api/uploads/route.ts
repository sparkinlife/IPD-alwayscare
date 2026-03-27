import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { uploadToGoogleDrive, uploadToGoogleDriveNested } from "@/lib/google-drive";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
  "video/webm",
];

const MAX_SIZE = 50 * 1024 * 1024; // 50MB for videos

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const subfolder = (formData.get("subfolder") as string) || "uploads";
    const folderPathRaw = formData.get("folderPath") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum 50MB." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only images, videos and PDFs are allowed." },
        { status: 400 }
      );
    }

    // Check if Google Drive is configured
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !process.env.GOOGLE_DRIVE_FOLDER_ID) {
      return NextResponse.json(
        { error: "Google Drive not configured. Upload skipped.", fileId: null, shareableLink: null },
        { status: 200 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Use nested folder path if provided, otherwise fall back to flat subfolder
    if (folderPathRaw) {
      let folderPath: string[];
      try {
        folderPath = JSON.parse(folderPathRaw);
      } catch {
        return NextResponse.json({ error: "Invalid folderPath format" }, { status: 400 });
      }
      const result = await uploadToGoogleDriveNested(buffer, file.name, file.type, folderPath);
      return NextResponse.json(result);
    }

    const result = await uploadToGoogleDrive(buffer, file.name, file.type, subfolder);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
