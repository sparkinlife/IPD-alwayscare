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

export async function uploadToGoogleDrive(
  file: Buffer,
  fileName: string,
  mimeType: string,
  subfolder: string
): Promise<{ fileId: string; shareableLink: string }> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;

  // Find or create subfolder
  const safeName = subfolder.replace(/'/g, "\\'");
  const folderQuery = await drive.files.list({
    q: `name='${safeName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id)",
  });

  let folderId: string;
  if (folderQuery.data.files && folderQuery.data.files.length > 0) {
    folderId = folderQuery.data.files[0].id!;
  } else {
    const folder = await drive.files.create({
      requestBody: {
        name: subfolder,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentFolderId],
      },
      fields: "id",
    });
    folderId = folder.data.id!;
  }

  // Upload file
  const { Readable } = await import("stream");
  const uploaded = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType, body: Readable.from(file) },
    fields: "id, webViewLink",
  });

  // Make shareable
  await drive.permissions.create({
    fileId: uploaded.data.id!,
    requestBody: { role: "reader", type: "anyone" },
  });

  return {
    fileId: uploaded.data.id!,
    shareableLink: uploaded.data.webViewLink!,
  };
}

export async function uploadToGoogleDriveNested(
  file: Buffer,
  fileName: string,
  mimeType: string,
  folderPath: string[]
): Promise<{ fileId: string; shareableLink: string }> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });

  let parentId = process.env.GOOGLE_DRIVE_FOLDER_ID!;

  // Create nested folder structure
  for (const segment of folderPath) {
    const safeName = segment.replace(/'/g, "\\'");
    const query = await drive.files.list({
      q: `name='${safeName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id)",
    });

    if (query.data.files && query.data.files.length > 0) {
      parentId = query.data.files[0].id!;
    } else {
      const folder = await drive.files.create({
        requestBody: { name: segment, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
        fields: "id",
      });
      parentId = folder.data.id!;
    }
  }

  // Upload file
  const { Readable } = await import("stream");
  const uploaded = await drive.files.create({
    requestBody: { name: fileName, parents: [parentId] },
    media: { mimeType, body: Readable.from(file) },
    fields: "id, webViewLink",
  });

  await drive.permissions.create({
    fileId: uploaded.data.id!,
    requestBody: { role: "reader", type: "anyone" },
  });

  return { fileId: uploaded.data.id!, shareableLink: uploaded.data.webViewLink! };
}
