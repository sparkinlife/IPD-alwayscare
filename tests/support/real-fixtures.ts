import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import type { StaffRole } from "@prisma/client";
import type { RealRunContext } from "./real-run-context";

export function buildTaggedText(runId: string, label: string) {
  return `${runId} ${label}`;
}

export function buildTaggedCageNumber(runId: string) {
  return `T-${runId.slice(-6)}`;
}

export function assertTaggedOwnership(runId: string, value: string | null | undefined) {
  if (!value || !value.includes(runId)) {
    throw new Error(`Record does not belong to the active test run: ${value ?? "null"}`);
  }
}

export async function findLiveStaffByRole(role: StaffRole) {
  const staff = await db.staff.findFirst({
    where: { role, isActive: true, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, phone: true, role: true },
  });
  if (!staff) {
    throw new Error(`No active ${role} account is available for real-system validation`);
  }
  return staff;
}

export const TAGGED_PASSWORD = "realrun123!";

export interface TaggedStaff {
  id: string;
  name: string;
  phone: string;
}

export interface TaggedFixtures {
  doctor: TaggedStaff;
  paravet: TaggedStaff;
  admin: TaggedStaff;
  management: TaggedStaff;
  taggedCage: { id: string; ward: string; cageNumber: string };
  registeredPatient: { id: string; admissionId: string };
  activeGeneralPatient: { id: string; admissionId: string };
  activeIsolationPatient: { id: string; admissionId: string };
}

function generatePhone(runId: string, prefix: string): string {
  // Use prefix + timestamp digits to create a unique 10-digit phone
  const digits = runId.replace(/\D/g, "");
  return `${prefix}${digits.slice(-8)}`;
}

export async function createAllTaggedFixtures(run: RealRunContext): Promise<TaggedFixtures> {
  const passwordHash = await bcrypt.hash(TAGGED_PASSWORD, 10);

  // Create tagged staff for all roles (seeded accounts may be deactivated)
  const doctor = await db.staff.create({
    data: {
      name: buildTaggedText(run.runId, "Doctor"),
      phone: generatePhone(run.runId, "71"),
      passwordHash,
      role: "DOCTOR",
    },
    select: { id: true, name: true, phone: true },
  });
  run.recordArtifact({ kind: "staff", label: "tagged-doctor", id: doctor.id });

  const paravet = await db.staff.create({
    data: {
      name: buildTaggedText(run.runId, "Paravet"),
      phone: generatePhone(run.runId, "72"),
      passwordHash,
      role: "PARAVET",
    },
    select: { id: true, name: true, phone: true },
  });
  run.recordArtifact({ kind: "staff", label: "tagged-paravet", id: paravet.id });

  const admin = await db.staff.create({
    data: {
      name: buildTaggedText(run.runId, "Admin"),
      phone: generatePhone(run.runId, "73"),
      passwordHash,
      role: "ADMIN",
    },
    select: { id: true, name: true, phone: true },
  });
  run.recordArtifact({ kind: "staff", label: "tagged-admin", id: admin.id });

  const management = await db.staff.create({
    data: {
      name: buildTaggedText(run.runId, "Management"),
      phone: generatePhone(run.runId, "88"),
      passwordHash,
      role: "MANAGEMENT",
    },
    select: { id: true, name: true, phone: true },
  });
  run.recordArtifact({ kind: "staff", label: "tagged-management", id: management.id });

  // Create tagged cage
  const cageNumber = buildTaggedCageNumber(run.runId);
  const taggedCage = await db.cageConfig.create({
    data: {
      ward: "GENERAL",
      cageNumber,
      isActive: true,
    },
    select: { id: true, ward: true, cageNumber: true },
  });
  run.recordArtifact({ kind: "cage", label: "tagged-cage", id: taggedCage.id });

  // Create tagged patients
  const registeredPatientData = await db.patient.create({
    data: {
      name: buildTaggedText(run.runId, "Registered Patient"),
      species: "DOG",
      sex: "UNKNOWN",
      isStray: true,
      admissions: {
        create: {
          status: "REGISTERED",
          admittedById: paravet.id,
          chiefComplaint: buildTaggedText(run.runId, "Test complaint"),
        },
      },
    },
    include: { admissions: { take: 1, orderBy: { createdAt: "desc" } } },
  });
  run.recordArtifact({ kind: "patient", label: "registered-patient", id: registeredPatientData.id });
  run.recordArtifact({ kind: "admission", label: "registered-admission", id: registeredPatientData.admissions[0].id });

  const activeGeneralData = await db.patient.create({
    data: {
      name: buildTaggedText(run.runId, "General Patient"),
      species: "DOG",
      sex: "FEMALE",
      isStray: true,
      admissions: {
        create: {
          status: "ACTIVE",
          ward: "GENERAL",
          cageNumber: `TG-${run.runId.slice(-4)}`,
          diagnosis: buildTaggedText(run.runId, "General diagnosis"),
          condition: "STABLE",
          attendingDoctor: doctor.name,
          admittedById: paravet.id,
        },
      },
    },
    include: { admissions: { take: 1, orderBy: { createdAt: "desc" } } },
  });
  run.recordArtifact({ kind: "patient", label: "general-patient", id: activeGeneralData.id });
  run.recordArtifact({ kind: "admission", label: "general-admission", id: activeGeneralData.admissions[0].id });

  const activeIsolationData = await db.patient.create({
    data: {
      name: buildTaggedText(run.runId, "Isolation Patient"),
      species: "DOG",
      sex: "MALE",
      isStray: true,
      admissions: {
        create: {
          status: "ACTIVE",
          ward: "ISOLATION",
          cageNumber: `TI-${run.runId.slice(-4)}`,
          diagnosis: buildTaggedText(run.runId, "Isolation diagnosis"),
          condition: "GUARDED",
          attendingDoctor: doctor.name,
          admittedById: paravet.id,
          isolationProtocol: {
            create: {
              disease: buildTaggedText(run.runId, "Canine Distemper"),
              ppeRequired: ["Gloves", "Gown"],
              disinfectant: "Quaternary ammonium compound",
              disinfectionInterval: "Q4H",
              createdById: doctor.id,
            },
          },
        },
      },
    },
    include: { admissions: { take: 1, orderBy: { createdAt: "desc" } } },
  });
  run.recordArtifact({ kind: "patient", label: "isolation-patient", id: activeIsolationData.id });
  run.recordArtifact({ kind: "admission", label: "isolation-admission", id: activeIsolationData.admissions[0].id });

  return {
    doctor,
    paravet,
    admin,
    management,
    taggedCage,
    registeredPatient: {
      id: registeredPatientData.id,
      admissionId: registeredPatientData.admissions[0].id,
    },
    activeGeneralPatient: {
      id: activeGeneralData.id,
      admissionId: activeGeneralData.admissions[0].id,
    },
    activeIsolationPatient: {
      id: activeIsolationData.id,
      admissionId: activeIsolationData.admissions[0].id,
    },
  };
}
