import { getGoogleDrive } from "@/lib/google-auth";

export async function verifyDriveConfigured() {
  const drive = getGoogleDrive();
  const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!rootId) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID is missing");
  }
  await drive.files.get({
    fileId: rootId,
    fields: "id,name",
    supportsAllDrives: true,
  });
}

export async function findDriveFilesByRunId(runId: string) {
  const drive = getGoogleDrive();
  const response = await drive.files.list({
    q: `name contains '${runId}' and trashed=false`,
    fields: "files(id,name,webViewLink)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return response.data.files ?? [];
}

export async function assertDriveFileRenamed(fileId: string) {
  const drive = getGoogleDrive();
  const response = await drive.files.get({
    fileId,
    fields: "id,name",
    supportsAllDrives: true,
  });
  const name = response.data.name ?? "";
  if (!name.startsWith("DELETED - ")) {
    throw new Error(`Expected Drive file ${fileId} to be renamed to DELETED, got: ${name}`);
  }
}
