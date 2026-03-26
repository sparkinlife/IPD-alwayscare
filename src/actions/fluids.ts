"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireDoctor } from "@/lib/auth";

export async function startFluidTherapy(admissionId: string, formData: FormData) {
  const session = await requireDoctor();

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
}

export async function changeFluidRate(fluidTherapyId: string, formData: FormData) {
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
}

export async function stopFluids(fluidTherapyId: string) {
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
}
