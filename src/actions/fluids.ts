"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireDoctor } from "@/lib/auth";

function handleActionError(error: unknown): { error: string } {
  if (error && typeof error === "object" && "digest" in error) throw error;
  if (error instanceof Error) {
    if (error.message === "Unauthorized") return { error: "Please log in again" };
    if (error.message.startsWith("Forbidden")) return { error: error.message };
    if (error.message.startsWith("Invalid")) return { error: error.message };
  }
  return { error: "An unexpected error occurred" };
}

export async function startFluidTherapy(admissionId: string, formData: FormData) {
  try {
    const session = await requireDoctor();

    const admission = await db.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, deletedAt: true },
    });
    if (!admission || admission.deletedAt) return { error: "Admission not found" };

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

    revalidatePath(`/patients/${admissionId}`);
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
      select: { admissionId: true, rate: true },
    });

    if (!fluidTherapy) return { error: "Fluid therapy not found" };

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

    revalidatePath(`/patients/${fluidTherapy.admissionId}`);
    revalidatePath("/schedule");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateFluidTherapy(fluidId: string, formData: FormData) {
  try {
    await requireDoctor();

    const fluid = await db.fluidTherapy.findUnique({
      where: { id: fluidId },
      select: { admissionId: true },
    });
    if (!fluid) return { error: "Fluid therapy not found" };

    const fluidType = formData.get("fluidType") as string;
    const additives = (formData.get("additives") as string) || null;
    const notes = (formData.get("notes") as string) || null;

    if (!fluidType) return { error: "Fluid type is required" };

    await db.fluidTherapy.update({
      where: { id: fluidId },
      data: { fluidType, additives, notes },
    });

    revalidatePath(`/patients/${fluid.admissionId}`);
    revalidatePath("/schedule");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function stopFluids(fluidTherapyId: string) {
  try {
    await requireDoctor();

    const fluidTherapy = await db.fluidTherapy.findUnique({
      where: { id: fluidTherapyId },
      select: { admissionId: true },
    });

    if (!fluidTherapy) return { error: "Fluid therapy not found" };

    await db.fluidTherapy.update({
      where: { id: fluidTherapyId },
      data: {
        isActive: false,
        endTime: new Date(),
      },
    });

    revalidatePath(`/patients/${fluidTherapy.admissionId}`);
    revalidatePath("/schedule");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}
