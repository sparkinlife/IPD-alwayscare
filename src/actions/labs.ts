"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireDoctor } from "@/lib/auth";

export async function addLabResult(admissionId: string, formData: FormData) {
  const session = await requireDoctor();
  const testType = formData.get("testType") as string;
  const testName = formData.get("testName") as string;
  const result = formData.get("result") as string;
  const isAbnormal = formData.get("isAbnormal") === "true";
  const notes = formData.get("notes") as string || undefined;
  const reportUrl = formData.get("reportUrl") as string || undefined;

  if (!testType || !testName || !result) return { error: "Test type, name, and result are required" };

  await db.labResult.create({
    data: { admissionId, testType: testType as any, testName, result, isAbnormal, notes, reportUrl, createdById: session.staffId },
  });
  revalidatePath(`/patients/${admissionId}`);
  return { success: true };
}
