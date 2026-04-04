"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireDoctor, requireWriteAccess } from "@/lib/auth";
import {
  validateSpecies,
  validateSex,
  validateWard,
  validateCondition,
  validateMedRoute,
  validateFrequency,
} from "@/lib/validators";
import { ActionUserError, handleActionError } from "@/lib/action-utils";
import { markDeletedInDrive } from "@/lib/google-auth";
import {
  getAdmissionMutationTags,
  updateClinicalTags,
} from "@/lib/clinical-revalidation";
import {
  admissionDashboardInvalidations,
  invalidateDashboardTags,
} from "@/lib/dashboard-revalidation";

export async function registerPatient(_prevState: unknown, formData: FormData) {
  try {
    const session = await requireWriteAccess();

    const name = formData.get("name") as string;
    const species = (formData.get("species") as string) || "DOG";
    const breed = (formData.get("breed") as string) || undefined;
    const age = (formData.get("age") as string) || undefined;
    const weightStr = formData.get("weight") as string;
    const weight = weightStr ? parseFloat(weightStr) : undefined;
    const sex = (formData.get("sex") as string) || "UNKNOWN";
    const color = (formData.get("color") as string) || undefined;
    const isStray = formData.get("isStray") === "true";
    const rescueLocation = (formData.get("rescueLocation") as string) || undefined;
    const rescuerInfo = (formData.get("rescuerInfo") as string) || undefined;

    if (!name) return { error: "Patient name is required" };

    const result = await db.$transaction(async (tx: any) => {
      const patient = await tx.patient.create({
        data: {
          name,
          species: validateSpecies(species),
          breed,
          age,
          weight,
          sex: validateSex(sex),
          color,
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

    invalidateDashboardTags("setup");
    revalidatePath("/");
    return { success: true, admissionId: result.admissionId, patientId: result.patientId };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function cancelRegistration(admissionId: string) {
  try {
    await requireWriteAccess();

    const admission = await db.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, status: true, patientId: true },
    });
    if (!admission) return { error: "Admission not found" };
    if (admission.status !== "REGISTERED") {
      return { error: "Only registered (pending setup) patients can be cancelled" };
    }

    await db.$transaction(async (tx: any) => {
      // Re-verify status inside transaction to prevent race with clinicalSetup
      const current = await tx.admission.findUnique({
        where: { id: admissionId },
        select: { status: true, patientId: true },
      });
      if (!current || current.status !== "REGISTERED") {
        throw new ActionUserError("Admission is no longer in REGISTERED status");
      }

      // Check patient has no other admissions before deleting
      const otherAdmissions = await tx.admission.count({
        where: { patientId: current.patientId, id: { not: admissionId } },
      });

      // Clean up any alert logs for this admission
      await tx.alertLog.deleteMany({ where: { admissionId } });
      await tx.admission.delete({ where: { id: admissionId } });

      // Only delete patient if no other admissions reference it
      if (otherAdmissions === 0) {
        // Delete patient media
        const mediaItems = await tx.patientMedia.findMany({
          where: { patientId: current.patientId },
          select: { fileId: true, fileName: true },
        });
        await markDeletedInDrive(mediaItems);
        await tx.patientMedia.deleteMany({ where: { patientId: current.patientId } });

        await tx.patient.delete({ where: { id: current.patientId } });
      }
    });

    invalidateDashboardTags("setup");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function editRegisteredPatient(admissionId: string, formData: FormData) {
  try {
    await requireWriteAccess();

    const name = (formData.get("name") as string)?.trim();
    const species = formData.get("species") as string;
    const breed = (formData.get("breed") as string) || null;
    const age = (formData.get("age") as string) || null;
    const weightStr = formData.get("weight") as string;
    const weight = weightStr ? parseFloat(weightStr) : null;
    const sex = formData.get("sex") as string;
    const color = (formData.get("color") as string) || null;
    const isStray = formData.get("isStray") === "true";
    const rescueLocation = (formData.get("rescueLocation") as string) || null;
    const rescuerInfo = (formData.get("rescuerInfo") as string) || null;

    if (!name) return { error: "Patient name is required" };

    // Verify status + update inside transaction to prevent race with clinicalSetup
    await db.$transaction(async (tx: any) => {
      const admission = await tx.admission.findUnique({
        where: { id: admissionId },
        select: { id: true, status: true, patientId: true },
      });
      if (!admission) throw new ActionUserError("Admission not found");
      if (admission.status !== "REGISTERED") {
        throw new ActionUserError("Only registered (pending setup) patients can be edited here");
      }

      await tx.patient.update({
        where: { id: admission.patientId },
        data: {
          name,
          species: species ? validateSpecies(species) : undefined,
          breed,
          age,
          weight,
          sex: sex ? validateSex(sex) : undefined,
          color,
          isStray,
          rescueLocation: isStray ? rescueLocation : null,
          rescuerInfo: isStray ? rescuerInfo : null,
        },
      });
    });

    invalidateDashboardTags("setup");
    revalidatePath("/");
    return { success: true };
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
      select: { id: true, deletedAt: true, status: true },
    });
    if (!admission || admission.deletedAt) return { error: "Admission not found" };
    if (admission.status === "ACTIVE") {
      revalidatePath("/");
      redirect(`/patients/${admissionId}`);
    }
    if (admission.status !== "REGISTERED") {
      return { error: "Clinical setup can only be completed once for registered patients" };
    }

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

    const validatedWard = validateWard(ward);
    const validatedCondition = validateCondition(condition);

    await db.$transaction(async (tx: any) => {
      const currentAdmission = await tx.admission.findUnique({
        where: { id: admissionId },
        select: { status: true, deletedAt: true },
      });
      if (!currentAdmission || currentAdmission.deletedAt) {
        throw new ActionUserError("Admission not found");
      }
      if (currentAdmission.status === "ACTIVE") {
        return;
      }
      if (currentAdmission.status !== "REGISTERED") {
        throw new ActionUserError("Admission setup can only be completed for registered patients");
      }

      // Check cage uniqueness INSIDE the transaction to avoid race conditions
      const existingCage = await tx.admission.findFirst({
        where: {
          ward: validatedWard,
          cageNumber,
          status: "ACTIVE",
          deletedAt: null,
          patient: { deletedAt: null },
          id: { not: admissionId },
        },
        include: { patient: { select: { name: true } } },
      });

      if (existingCage) {
        throw new ActionUserError(
          `Cage ${cageNumber} is occupied by ${existingCage.patient.name}`
        );
      }

      // Use conditional update so duplicate/racing submissions become idempotent.
      const admissionUpdate = await tx.admission.updateMany({
        where: { id: admissionId, status: "REGISTERED", deletedAt: null },
        data: {
          status: "ACTIVE",
          diagnosis,
          chiefComplaint,
          diagnosisNotes,
          ward: validatedWard,
          cageNumber,
          condition: validatedCondition,
          attendingDoctor,
        },
      });

      if (admissionUpdate.count === 0) {
        const latest = await tx.admission.findUnique({
          where: { id: admissionId },
          select: { status: true, deletedAt: true },
        });
        if (!latest || latest.deletedAt) {
          throw new ActionUserError("Admission not found");
        }
        if (latest.status === "ACTIVE") {
          return;
        }
        throw new ActionUserError(
          "Admission setup can only be completed for registered patients"
        );
      }

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

    invalidateDashboardTags("summary", "queue", "setup");
    updateClinicalTags(getAdmissionMutationTags(admissionId));
    revalidatePath("/");
    revalidatePath("/schedule");
  } catch (error) {
    return handleActionError(error);
  }
  redirect(`/patients/${admissionId}`);
}

export async function updateCondition(admissionId: string, condition: string) {
  try {
    await requireDoctor();

    const admission = await db.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, deletedAt: true, status: true },
    });
    if (!admission || admission.deletedAt) return { error: "Admission not found" };
    if (admission.status !== "ACTIVE") {
      return { error: "Only active admissions can be updated" };
    }

    await db.admission.update({
      where: { id: admissionId },
      data: { condition: validateCondition(condition) },
    });
    invalidateDashboardTags("summary", "queue");
    revalidatePath("/patients/[admissionId]", "page");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function transferWard(admissionId: string, newWard: string, newCage: string) {
  try {
    await requireDoctor();

    const validatedWard = validateWard(newWard);

    const admission = await db.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, deletedAt: true, status: true },
    });
    if (!admission || admission.deletedAt) return { error: "Admission not found" };
    if (admission.status !== "ACTIVE") {
      return { error: "Only active admissions can be transferred" };
    }

    await db.$transaction(async (tx: any) => {
      const existing = await tx.admission.findFirst({
        where: {
          ward: validatedWard,
          cageNumber: newCage,
          status: "ACTIVE",
          deletedAt: null,
          patient: { deletedAt: null },
          id: { not: admissionId },
        },
        include: { patient: { select: { name: true } } },
      });
      if (existing) {
        throw new ActionUserError(`Cage ${newCage} is occupied by ${existing.patient.name}`);
      }

      await tx.admission.update({
        where: { id: admissionId },
        data: { ward: validatedWard, cageNumber: newCage },
      });
    });

    invalidateDashboardTags(...admissionDashboardInvalidations.transferWard);
    updateClinicalTags(getAdmissionMutationTags(admissionId));
    revalidatePath("/patients/[admissionId]", "page");
    revalidatePath("/");
    revalidatePath("/schedule");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updatePatient(patientId: string, formData: FormData) {
  try {
    await requireDoctor();

    const patient = await db.patient.findUnique({
      where: { id: patientId },
      select: { id: true, deletedAt: true },
    });
    if (!patient || patient.deletedAt) return { error: "Patient not found" };

    const name = (formData.get("name") as string)?.trim();
    const breed = (formData.get("breed") as string) || null;
    const age = (formData.get("age") as string) || null;
    const weightStr = formData.get("weight") as string;
    const weight = weightStr ? parseFloat(weightStr) : null;
    const sex = formData.get("sex") as string;
    const color = (formData.get("color") as string) || null;
    const isStray = formData.has("isStray");
    const rescueLocation = (formData.get("rescueLocation") as string) || null;
    const rescuerInfo = (formData.get("rescuerInfo") as string) || null;

    if (!name) return { error: "Patient name is required" };

    await db.patient.update({
      where: { id: patientId },
      data: {
        name,
        breed,
        age,
        weight,
        sex: sex ? validateSex(sex) : undefined,
        color,
        isStray,
        rescueLocation,
        rescuerInfo,
      },
    });

    // Find admission for revalidation
    const admission = await db.admission.findFirst({
      where: { patientId, deletedAt: null },
      select: { id: true },
    });

    invalidateDashboardTags("queue", "setup");
    updateClinicalTags(getAdmissionMutationTags(admission?.id));
    revalidatePath("/");
    revalidatePath("/schedule");
    if (admission) revalidatePath("/patients/[admissionId]", "page");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateAdmission(admissionId: string, formData: FormData) {
  try {
    await requireDoctor();

    const admission = await db.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, deletedAt: true, status: true },
    });
    if (!admission || admission.deletedAt) return { error: "Admission not found" };
    if (admission.status !== "ACTIVE") {
      return { error: "Only active admissions can be updated" };
    }

    const diagnosis = (formData.get("diagnosis") as string) || null;
    const chiefComplaint = (formData.get("chiefComplaint") as string) || null;
    const diagnosisNotes = (formData.get("diagnosisNotes") as string) || null;
    const attendingDoctor = (formData.get("attendingDoctor") as string) || null;

    await db.admission.update({
      where: { id: admissionId },
      data: { diagnosis, chiefComplaint, diagnosisNotes, attendingDoctor },
    });

    invalidateDashboardTags("summary", "queue");
    revalidatePath("/patients/[admissionId]", "page");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function archivePatient(admissionId: string) {
  try {
    await requireDoctor();

    const admission = await db.admission.findUnique({
      where: { id: admissionId },
      select: { id: true, patientId: true, deletedAt: true },
    });
    if (!admission || admission.deletedAt) return { error: "Admission not found" };

    // Soft-delete admission and patient + deactivate plans atomically
    await db.$transaction(async (tx: any) => {
      const now = new Date();
      const admissionsToArchive = await tx.admission.findMany({
        where: { patientId: admission.patientId, deletedAt: null },
        select: { id: true },
      });
      const admissionIds = admissionsToArchive.map((a: any) => a.id);

      await tx.admission.updateMany({
        where: { patientId: admission.patientId, deletedAt: null },
        data: { deletedAt: now },
      });
      await tx.patient.update({
        where: { id: admission.patientId },
        data: { deletedAt: now },
      });
      await tx.treatmentPlan.updateMany({
        where: { admissionId: { in: admissionIds }, isActive: true },
        data: { isActive: false },
      });
      await tx.dietPlan.updateMany({
        where: { admissionId: { in: admissionIds }, isActive: true },
        data: { isActive: false },
      });
      await tx.fluidTherapy.updateMany({
        where: { admissionId: { in: admissionIds }, isActive: true },
        data: { isActive: false },
      });
      await tx.isolationProtocol.updateMany({
        where: { admissionId: { in: admissionIds } },
        data: { isCleared: true, clearedDate: now },
      });
    });

    invalidateDashboardTags("summary", "queue", "setup");
    updateClinicalTags(getAdmissionMutationTags(admissionId));
    revalidatePath("/");
    revalidatePath("/archive");
    revalidatePath("/schedule");
  } catch (error) {
    return handleActionError(error);
  }
  redirect("/");
}

export async function restorePatient(patientId: string) {
  try {
    const session = await requireDoctor();

    await db.$transaction(async (tx: any) => {
      await tx.patient.update({
        where: { id: patientId },
        data: { deletedAt: null },
      });
      await tx.admission.updateMany({
        where: { patientId, deletedAt: { not: null } },
        data: { deletedAt: null },
      });

      // Add a clinical note on each restored admission reminding doctor to re-prescribe
      const admissions = await tx.admission.findMany({
        where: { patientId, deletedAt: null },
        select: { id: true },
      });
      for (const adm of admissions) {
        await tx.clinicalNote.create({
          data: {
            admissionId: adm.id,
            category: "DOCTOR_ROUND",
            content:
              "Patient restored from archive. All previous treatment plans, diet plans, and fluid therapies were deactivated during archiving. Doctor must review and re-prescribe as needed.",
            recordedById: session.staffId,
          },
        });
      }
    });

    invalidateDashboardTags("summary", "queue", "setup");
    updateClinicalTags(getAdmissionMutationTags());
    revalidatePath("/");
    revalidatePath("/archive");
    revalidatePath("/schedule");
    return { success: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function permanentlyDeletePatient(patientId: string) {
  try {
    const session = await requireWriteAccess();
    if (session.role !== "ADMIN") throw new Error("Forbidden: Admin only");

    const patient = await db.patient.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        deletedAt: true,
        admissions: { select: { id: true } },
      },
    });
    if (!patient) return { error: "Patient not found" };
    if (!patient.deletedAt) {
      return { error: "Only archived patients can be permanently deleted" };
    }

    const admissionIds = patient.admissions.map((a: any) => a.id);

    await db.$transaction(async (tx: any) => {
      // 0a. Collect record IDs that ProofAttachments may reference
      const proofTreatmentPlanIds = (await tx.treatmentPlan.findMany({
        where: { admissionId: { in: admissionIds } },
        select: { id: true },
      })).map((t: any) => t.id);

      // Proofs for medication administrations are keyed on MedicationAdministration IDs
      const medAdminIds = (await tx.medicationAdministration.findMany({
        where: { treatmentPlanId: { in: proofTreatmentPlanIds } },
        select: { id: true },
      })).map((a: any) => a.id);

      const proofVitalIds = (await tx.vitalRecord.findMany({
        where: { admissionId: { in: admissionIds } },
        select: { id: true },
      })).map((v: any) => v.id);

      const bathIds = (await tx.bathLog.findMany({
        where: { admissionId: { in: admissionIds } },
        select: { id: true },
      })).map((b: any) => b.id);

      const proofFeedingSchedules = await tx.feedingSchedule.findMany({
        where: {
          dietPlan: { admissionId: { in: admissionIds } },
        },
        select: { id: true },
      });
      const feedingLogIds = (await tx.feedingLog.findMany({
        where: { feedingScheduleId: { in: proofFeedingSchedules.map((s: any) => s.id) } },
        select: { id: true },
      })).map((f: any) => f.id);

      const labIds = (await tx.labResult.findMany({
        where: { admissionId: { in: admissionIds } },
        select: { id: true },
      })).map((l: any) => l.id);

      const disinfectionProtos = await tx.isolationProtocol.findMany({
        where: { admissionId: { in: admissionIds } },
        select: { id: true },
      });
      const disinfectionIds = (await tx.disinfectionLog.findMany({
        where: { isolationProtocolId: { in: disinfectionProtos.map((p: any) => p.id) } },
        select: { id: true },
      })).map((d: any) => d.id);

      const allRecordIds = [
        ...medAdminIds,
        ...proofVitalIds,
        ...bathIds,
        ...feedingLogIds,
        ...labIds,
        ...disinfectionIds,
      ];

      // 0b. Rename proof files in Drive before deleting DB records
      const allProofs = await tx.proofAttachment.findMany({
        where: { recordId: { in: allRecordIds } },
        select: { fileId: true, fileName: true },
      });
      await markDeletedInDrive(allProofs);

      // Delete ProofAttachments referencing any of those records
      await tx.proofAttachment.deleteMany({
        where: { recordId: { in: allRecordIds } },
      });

      // 0c. Delete AlertLogs for these admissions
      await tx.alertLog.deleteMany({
        where: { admissionId: { in: admissionIds } },
      });

      // 1. DisinfectionLog (via IsolationProtocol)
      const isolationProtocols = await tx.isolationProtocol.findMany({
        where: { admissionId: { in: admissionIds } },
        select: { id: true },
      });
      const isolationIds = isolationProtocols.map((p: any) => p.id);
      await tx.disinfectionLog.deleteMany({ where: { isolationProtocolId: { in: isolationIds } } });

      // 2. IsolationProtocol
      await tx.isolationProtocol.deleteMany({ where: { admissionId: { in: admissionIds } } });

      // 3. MedicationAdministration (via TreatmentPlan)
      const treatmentPlans = await tx.treatmentPlan.findMany({
        where: { admissionId: { in: admissionIds } },
        select: { id: true },
      });
      const treatmentPlanIds = treatmentPlans.map((p: any) => p.id);
      await tx.medicationAdministration.deleteMany({ where: { treatmentPlanId: { in: treatmentPlanIds } } });

      // 4. TreatmentPlan
      await tx.treatmentPlan.deleteMany({ where: { admissionId: { in: admissionIds } } });

      // 5. FluidRateChange (via FluidTherapy)
      const fluidTherapies = await tx.fluidTherapy.findMany({
        where: { admissionId: { in: admissionIds } },
        select: { id: true },
      });
      const fluidTherapyIds = fluidTherapies.map((f: any) => f.id);
      await tx.fluidRateChange.deleteMany({ where: { fluidTherapyId: { in: fluidTherapyIds } } });

      // 6. FluidTherapy
      await tx.fluidTherapy.deleteMany({ where: { admissionId: { in: admissionIds } } });

      // 7. FeedingLog (via FeedingSchedule via DietPlan)
      const dietPlans = await tx.dietPlan.findMany({
        where: { admissionId: { in: admissionIds } },
        select: { id: true },
      });
      const dietPlanIds = dietPlans.map((d: any) => d.id);
      const feedingSchedules = await tx.feedingSchedule.findMany({
        where: { dietPlanId: { in: dietPlanIds } },
        select: { id: true },
      });
      const feedingScheduleIds = feedingSchedules.map((s: any) => s.id);
      await tx.feedingLog.deleteMany({ where: { feedingScheduleId: { in: feedingScheduleIds } } });

      // 8. FeedingSchedule
      await tx.feedingSchedule.deleteMany({ where: { dietPlanId: { in: dietPlanIds } } });

      // 9. DietPlan
      await tx.dietPlan.deleteMany({ where: { admissionId: { in: admissionIds } } });

      // 10. VitalRecord
      await tx.vitalRecord.deleteMany({ where: { admissionId: { in: admissionIds } } });

      // 11. ClinicalNote
      await tx.clinicalNote.deleteMany({ where: { admissionId: { in: admissionIds } } });

      // 12. BathLog
      await tx.bathLog.deleteMany({ where: { admissionId: { in: admissionIds } } });

      // 13. LabResult
      await tx.labResult.deleteMany({ where: { admissionId: { in: admissionIds } } });

      // 14. Admission
      await tx.admission.deleteMany({ where: { patientId } });

      // Delete patient media
      const mediaItems = await tx.patientMedia.findMany({
        where: { patientId },
        select: { fileId: true, fileName: true },
      });
      await markDeletedInDrive(mediaItems);
      await tx.patientMedia.deleteMany({ where: { patientId } });

      // 15. Patient
      await tx.patient.delete({ where: { id: patientId } });
    });

    revalidatePath("/archive");
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
      select: { id: true, deletedAt: true, status: true },
    });
    if (!admission || admission.deletedAt) return { error: "Admission not found" };
    if (admission.status !== "ACTIVE") {
      return { error: "Only active admissions can be discharged" };
    }

    // Discharge + deactivate plans atomically
    await db.$transaction(async (tx: any) => {
      await tx.admission.update({
        where: { id: admissionId },
        data: {
          status: condition === "DECEASED" ? "DECEASED" : "DISCHARGED",
          condition: validateCondition(condition),
          dischargeDate: new Date(),
          dischargedById: session.staffId,
          dischargeNotes,
        },
      });
      await tx.treatmentPlan.updateMany({ where: { admissionId, isActive: true }, data: { isActive: false } });
      await tx.dietPlan.updateMany({ where: { admissionId, isActive: true }, data: { isActive: false } });
      await tx.fluidTherapy.updateMany({ where: { admissionId, isActive: true }, data: { isActive: false } });
    });

    invalidateDashboardTags(...admissionDashboardInvalidations.dischargePatient);
    updateClinicalTags(getAdmissionMutationTags(admissionId));
    revalidatePath("/");
    revalidatePath("/schedule");
  } catch (error) {
    return handleActionError(error);
  }
  redirect("/");
}
