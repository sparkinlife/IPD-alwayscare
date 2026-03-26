"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth, requireDoctor } from "@/lib/auth";
import {
  validateSpecies,
  validateSex,
  validateWard,
  validateCondition,
  validateMedRoute,
  validateFrequency,
} from "@/lib/validators";

function handleActionError(error: unknown): { error: string } {
  // Re-throw Next.js internal throws (redirects, not-found, etc.)
  if (error && typeof error === "object" && "digest" in error) throw error;
  if (error instanceof Error) {
    if (error.message === "Unauthorized") return { error: "Please log in again" };
    if (error.message.startsWith("Forbidden")) return { error: error.message };
    if (error.message.startsWith("Invalid")) return { error: error.message };
  }
  return { error: "An unexpected error occurred" };
}

export async function registerPatient(_prevState: unknown, formData: FormData) {
  try {
    const session = await requireAuth();

    const name = formData.get("name") as string;
    const species = (formData.get("species") as string) || "DOG";
    const breed = (formData.get("breed") as string) || undefined;
    const age = (formData.get("age") as string) || undefined;
    const weightStr = formData.get("weight") as string;
    const weight = weightStr ? parseFloat(weightStr) : undefined;
    const sex = (formData.get("sex") as string) || "UNKNOWN";
    const color = (formData.get("color") as string) || undefined;
    const photoUrl = (formData.get("photoUrl") as string) || undefined;
    const isStray = formData.get("isStray") === "true";
    const rescueLocation = (formData.get("rescueLocation") as string) || undefined;
    const rescuerInfo = (formData.get("rescuerInfo") as string) || undefined;

    if (!name) return { error: "Patient name is required" };

    const result = await db.$transaction(async (tx) => {
      const patient = await tx.patient.create({
        data: {
          name,
          species: validateSpecies(species),
          breed,
          age,
          weight,
          sex: validateSex(sex),
          color,
          photoUrl,
          isStray,
          rescueLocation,
          rescuerInfo,
        },
      });

      const admission = await tx.admission.create({
        data: {
          patientId: patient.id,
          admittedById: session.staffId,
          status: "REGISTERED",
        },
      });

      return { patientId: patient.id, admissionId: admission.id };
    });

    revalidatePath("/");
    return { success: true, admissionId: result.admissionId };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function clinicalSetup(admissionId: string, formData: FormData) {
  try {
    const session = await requireDoctor();

    // Admission existence check
    const admission = await db.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, deletedAt: true },
    });
    if (!admission || admission.deletedAt) return { error: "Admission not found" };

    const diagnosis = formData.get("diagnosis") as string;
    const chiefComplaint = (formData.get("chiefComplaint") as string) || undefined;
    const diagnosisNotes = (formData.get("diagnosisNotes") as string) || undefined;
    const ward = formData.get("ward") as string;
    const cageNumber = formData.get("cageNumber") as string;
    const condition = formData.get("condition") as string;
    const attendingDoctor = formData.get("attendingDoctor") as string;

    if (!diagnosis || !ward || !cageNumber || !condition || !attendingDoctor) {
      return { error: "All required fields must be filled" };
    }

    // Validate JSON medications before entering transaction
    const medsJson = formData.get("medications") as string;
    let meds: Array<{
      drugName: string;
      dose: string;
      route: string;
      frequency: string;
      scheduledTimes: string[];
      notes?: string;
    }> = [];
    if (medsJson) {
      try {
        meds = JSON.parse(medsJson);
      } catch {
        return { error: "Invalid medications format" };
      }
      if (!Array.isArray(meds)) return { error: "Invalid medications format" };
      for (const med of meds) {
        if (!med.drugName || !med.dose || !med.route || !med.frequency) {
          return { error: "Each medication must have drugName, dose, route, and frequency" };
        }
      }
    }

    // Validate feeding schedules JSON before transaction
    const feedingsJson = formData.get("feedingSchedules") as string;
    let feedings: Array<{ scheduledTime: string; foodType: string; portion: string }> = [];
    if (feedingsJson) {
      try {
        feedings = JSON.parse(feedingsJson);
      } catch {
        return { error: "Invalid feeding schedules format" };
      }
      if (!Array.isArray(feedings)) return { error: "Invalid feeding schedules format" };
    }

    await db.$transaction(async (tx) => {
      // Check cage uniqueness INSIDE the transaction to avoid race conditions
      const existingCage = await tx.admission.findFirst({
        where: {
          cageNumber,
          status: "ACTIVE",
          id: { not: admissionId },
        },
        include: { patient: { select: { name: true } } },
      });

      if (existingCage) {
        throw new Error(`Cage ${cageNumber} is occupied by ${existingCage.patient.name}`);
      }

      // Update admission to ACTIVE
      await tx.admission.update({
        where: { id: admissionId },
        data: {
          status: "ACTIVE",
          diagnosis,
          chiefComplaint,
          diagnosisNotes,
          ward: validateWard(ward),
          cageNumber,
          condition: validateCondition(condition),
          attendingDoctor,
        },
      });

      // Create initial medications if provided
      for (const med of meds) {
        await tx.treatmentPlan.create({
          data: {
            admissionId,
            drugName: med.drugName,
            dose: med.dose,
            route: validateMedRoute(med.route),
            frequency: validateFrequency(med.frequency),
            scheduledTimes: med.scheduledTimes,
            notes: med.notes,
            createdById: session.staffId,
          },
        });
      }

      // Create diet plan if provided
      const dietType = formData.get("dietType") as string;
      if (dietType) {
        const dietPlan = await tx.dietPlan.create({
          data: {
            admissionId,
            dietType,
            instructions: (formData.get("dietInstructions") as string) || undefined,
            createdById: session.staffId,
          },
        });
        for (const f of feedings) {
          await tx.feedingSchedule.create({
            data: {
              dietPlanId: dietPlan.id,
              scheduledTime: f.scheduledTime,
              foodType: f.foodType,
              portion: f.portion,
            },
          });
        }
      }

      // Create fluid therapy if provided
      const fluidType = formData.get("fluidType") as string;
      if (fluidType) {
        await tx.fluidTherapy.create({
          data: {
            admissionId,
            fluidType,
            rate: (formData.get("fluidRate") as string) || "",
            additives: (formData.get("fluidAdditives") as string) || undefined,
            createdById: session.staffId,
          },
        });
      }

      // Create isolation protocol if ward is ISOLATION
      if (ward === "ISOLATION") {
        const disease = formData.get("disease") as string;
        if (disease) {
          const ppeJson = formData.get("ppeRequired") as string;
          await tx.isolationProtocol.create({
            data: {
              admissionId,
              disease,
              ppeRequired: ppeJson ? JSON.parse(ppeJson) : [],
              disinfectant:
                (formData.get("disinfectant") as string) ||
                "Quaternary ammonium compound",
              disinfectionInterval:
                (formData.get("disinfectionInterval") as string) || "Q4H",
              biosecurityNotes:
                (formData.get("biosecurityNotes") as string) || undefined,
              createdById: session.staffId,
            },
          });
        }
      }

      // Create initial note if provided
      const initialNotes = formData.get("initialNotes") as string;
      if (initialNotes) {
        await tx.clinicalNote.create({
          data: {
            admissionId,
            category: "DOCTOR_ROUND",
            content: initialNotes,
            recordedById: session.staffId,
          },
        });
      }
    });

    revalidatePath("/");
    redirect(`/patients/${admissionId}`);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateCondition(admissionId: string, condition: string) {
  try {
    await requireDoctor();

    const admission = await db.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, deletedAt: true },
    });
    if (!admission || admission.deletedAt) return { error: "Admission not found" };

    await db.admission.update({
      where: { id: admissionId },
      data: { condition: validateCondition(condition) },
    });
    revalidatePath(`/patients/${admissionId}`);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function transferWard(admissionId: string, newWard: string, newCage: string) {
  try {
    await requireDoctor();

    const admission = await db.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, deletedAt: true },
    });
    if (!admission || admission.deletedAt) return { error: "Admission not found" };

    await db.$transaction(async (tx) => {
      const existing = await tx.admission.findFirst({
        where: { cageNumber: newCage, status: "ACTIVE", id: { not: admissionId } },
        include: { patient: { select: { name: true } } },
      });
      if (existing) {
        throw new Error(`Cage ${newCage} is occupied by ${existing.patient.name}`);
      }

      await tx.admission.update({
        where: { id: admissionId },
        data: { ward: validateWard(newWard), cageNumber: newCage },
      });
    });

    revalidatePath(`/patients/${admissionId}`);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function dischargePatient(admissionId: string, formData: FormData) {
  try {
    const session = await requireDoctor();
    const dischargeNotes = formData.get("dischargeNotes") as string;
    const condition = formData.get("condition") as string;

    if (!dischargeNotes) return { error: "Discharge notes are required" };
    if (condition !== "RECOVERED" && condition !== "DECEASED")
      return { error: "Condition must be Recovered or Deceased" };

    const admission = await db.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, deletedAt: true },
    });
    if (!admission || admission.deletedAt) return { error: "Admission not found" };

    await db.admission.update({
      where: { id: admissionId },
      data: {
        status: condition === "DECEASED" ? "DECEASED" : "DISCHARGED",
        condition: validateCondition(condition),
        dischargeDate: new Date(),
        dischargedById: session.staffId,
        dischargeNotes,
      },
    });

    // Deactivate all active plans
    await db.treatmentPlan.updateMany({ where: { admissionId, isActive: true }, data: { isActive: false } });
    await db.dietPlan.updateMany({ where: { admissionId, isActive: true }, data: { isActive: false } });
    await db.fluidTherapy.updateMany({ where: { admissionId, isActive: true }, data: { isActive: false } });

    revalidatePath("/");
    redirect("/");
  } catch (error) {
    return handleActionError(error);
  }
}
