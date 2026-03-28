"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireDoctor } from "@/lib/auth";
import { handleActionError } from "@/lib/action-utils";
import { markDeletedInDrive } from "@/lib/google-auth";

export async function startFluidTherapy(admissionId: string, formData: FormData) {
  try {
    const session = await requireDoctor();

    const admission = await db.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, deletedAt: true, status: true },
    });
    if (!admission || admission.deletedAt) return { error: "Admission not found" };
    if (admission.status !== "ACTIVE") return { error: "Admission is no longer active" };

    const fluidType = formData.get("fluidType") as string;
    const rate = formData.get("rate") as string;
    const additives = (formData.get("additives") as string) || undefined;
    const notes = (formData.get("notes") as string) || undefined;

    if (!fluidType || !rate) {
      return { error: "Fluid type and rate are required" };
    }

    await db.fluidTherapy.create({
      data: {
        admissionId,
        fluidType,
        rate,
        additives,
        notes,
        createdById: session.staffId,
      },
    });

    revalidatePath("/patients/[admissionId]", "page");
    revalidatePath("/schedule");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function changeFluidRate(fluidTherapyId: string, formData: FormData) {
  try {
    const session = await requireDoctor();

    const newRate = formData.get("newRate") as string;
    const reason = (formData.get("reason") as string) || undefined;

    if (!newRate) return { error: "New rate is required" };

    const fluidTherapy = await db.fluidTherapy.findUnique({
      where: { id: fluidTherapyId },
      select: {
        admissionId: true,
        rate: true,
        admission: { select: { deletedAt: true, status: true } },
      },
    });

    if (!fluidTherapy) return { error: "Fluid therapy not found" };
    if (fluidTherapy.admission.deletedAt || fluidTherapy.admission.status !== "ACTIVE") {
      return { error: "Admission is no longer active" };
    }

    await db.$transaction([
      db.fluidRateChange.create({
        data: {
          fluidTherapyId,
          oldRate: fluidTherapy.rate,
          newRate,
          reason,
          changedById: session.staffId,
        },
      }),
      db.fluidTherapy.update({
        where: { id: fluidTherapyId },
        data: { rate: newRate },
      }),
    ]);

    revalidatePath("/patients/[admissionId]", "page");
    revalidatePath("/schedule");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateFluidTherapy(fluidId: string, formData: FormData) {
  try {
    const session = await requireDoctor();

    const fluid = await db.fluidTherapy.findUnique({
      where: { id: fluidId },
      select: {
        admissionId: true,
        fluidType: true,
        rate: true,
        additives: true,
        admission: { select: { deletedAt: true, status: true } },
      },
    });
    if (!fluid) return { error: "Fluid therapy not found" };
    if (fluid.admission.deletedAt || fluid.admission.status !== "ACTIVE") {
      return { error: "Admission is no longer active" };
    }

    const fluidType = formData.get("fluidType") as string;
    const additives = (formData.get("additives") as string) || null;
    const notes = (formData.get("notes") as string) || null;

    if (!fluidType) return { error: "Fluid type is required" };

    // Build audit trail of what changed
    const changes: string[] = [];
    if (fluidType !== fluid.fluidType) changes.push(`Type: ${fluid.fluidType} → ${fluidType}`);
    if (additives !== fluid.additives) changes.push(`Additives: ${fluid.additives ?? "none"} → ${additives ?? "none"}`);

    await db.$transaction([
      db.fluidTherapy.update({
        where: { id: fluidId },
        data: { fluidType, additives, notes },
      }),
      ...(changes.length > 0
        ? [
            db.clinicalNote.create({
              data: {
                admissionId: fluid.admissionId,
                category: "PROCEDURE",
                content: `IV Fluid record edited by ${session.name}: ${changes.join("; ")}`,
                recordedById: session.staffId,
              },
            }),
          ]
        : []),
    ]);

    revalidatePath("/patients/[admissionId]", "page");
    revalidatePath("/schedule");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function stopFluids(fluidTherapyId: string) {
  try {
    const session = await requireDoctor();

    const fluidTherapy = await db.fluidTherapy.findUnique({
      where: { id: fluidTherapyId },
      select: {
        admissionId: true,
        fluidType: true,
        rate: true,
        admission: { select: { deletedAt: true, status: true } },
      },
    });

    if (!fluidTherapy) return { error: "Fluid therapy not found" };
    if (fluidTherapy.admission.deletedAt || fluidTherapy.admission.status !== "ACTIVE") {
      return { error: "Admission is no longer active" };
    }

    await db.$transaction([
      db.fluidTherapy.update({
        where: { id: fluidTherapyId },
        data: { isActive: false, endTime: new Date() },
      }),
      db.clinicalNote.create({
        data: {
          admissionId: fluidTherapy.admissionId,
          category: "PROCEDURE",
          content: `IV Fluid stopped: ${fluidTherapy.fluidType} @ ${fluidTherapy.rate}`,
          recordedById: session.staffId,
        },
      }),
    ]);

    revalidatePath("/patients/[admissionId]", "page");
    revalidatePath("/schedule");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function restartFluidTherapy(fluidTherapyId: string) {
  try {
    const session = await requireDoctor();

    const fluid = await db.fluidTherapy.findUnique({
      where: { id: fluidTherapyId },
      select: {
        admissionId: true,
        fluidType: true,
        rate: true,
        isActive: true,
        admission: { select: { deletedAt: true, status: true } },
      },
    });

    if (!fluid) return { error: "Fluid therapy not found" };
    if (fluid.isActive) return { error: "Fluid therapy is already active" };
    if (fluid.admission.deletedAt || fluid.admission.status !== "ACTIVE") {
      return { error: "Admission is no longer active" };
    }

    await db.$transaction([
      db.fluidTherapy.update({
        where: { id: fluidTherapyId },
        data: { isActive: true, endTime: null },
      }),
      db.clinicalNote.create({
        data: {
          admissionId: fluid.admissionId,
          category: "PROCEDURE",
          content: `IV Fluid restarted: ${fluid.fluidType} @ ${fluid.rate}`,
          recordedById: session.staffId,
        },
      }),
    ]);

    revalidatePath("/patients/[admissionId]", "page");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deleteFluidTherapy(fluidTherapyId: string) {
  try {
    const session = await requireDoctor();

    const fluid = await db.fluidTherapy.findUnique({
      where: { id: fluidTherapyId },
      select: {
        admissionId: true,
        fluidType: true,
        rate: true,
        admission: { select: { deletedAt: true, status: true } },
      },
    });

    if (!fluid) return { error: "Fluid therapy not found" };
    if (fluid.admission.deletedAt || fluid.admission.status !== "ACTIVE") {
      return { error: "Admission is no longer active" };
    }

    // Rename proofs in Google Drive
    const proofs = await db.proofAttachment.findMany({
      where: { recordId: fluidTherapyId, recordType: "FluidTherapy" },
      select: { fileId: true, fileName: true },
    });
    await markDeletedInDrive(proofs);

    await db.$transaction([
      db.proofAttachment.deleteMany({ where: { recordId: fluidTherapyId, recordType: "FluidTherapy" } }),
      db.fluidRateChange.deleteMany({ where: { fluidTherapyId } }),
      db.fluidTherapy.delete({ where: { id: fluidTherapyId } }),
      db.clinicalNote.create({
        data: {
          admissionId: fluid.admissionId,
          category: "PROCEDURE",
          content: `IV Fluid record deleted: ${fluid.fluidType} @ ${fluid.rate}. Deleted by ${session.name}.`,
          recordedById: session.staffId,
        },
      }),
    ]);

    revalidatePath("/patients/[admissionId]", "page");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}
