import { Ward, Condition, MedRoute, Frequency, NoteCategory, LabTestType, Species, Sex, FeedingStatus, StaffRole } from "@prisma/client";

const VALID_WARDS = Object.values(Ward);
const VALID_CONDITIONS = Object.values(Condition);
const VALID_MED_ROUTES = Object.values(MedRoute);
const VALID_FREQUENCIES = Object.values(Frequency);
const VALID_NOTE_CATEGORIES = Object.values(NoteCategory);
const VALID_LAB_TEST_TYPES = Object.values(LabTestType);
const VALID_SPECIES = Object.values(Species);
const VALID_SEX = Object.values(Sex);
const VALID_FEEDING_STATUSES = Object.values(FeedingStatus);
const VALID_STAFF_ROLES = Object.values(StaffRole);

export function validateWard(value: string): Ward {
  if (!VALID_WARDS.includes(value as Ward)) throw new Error(`Invalid ward: ${value}`);
  return value as Ward;
}

export function validateCondition(value: string): Condition {
  if (!VALID_CONDITIONS.includes(value as Condition)) throw new Error(`Invalid condition: ${value}`);
  return value as Condition;
}

export function validateMedRoute(value: string): MedRoute {
  if (!VALID_MED_ROUTES.includes(value as MedRoute)) throw new Error(`Invalid route: ${value}`);
  return value as MedRoute;
}

export function validateFrequency(value: string): Frequency {
  if (!VALID_FREQUENCIES.includes(value as Frequency)) throw new Error(`Invalid frequency: ${value}`);
  return value as Frequency;
}

export function validateNoteCategory(value: string): NoteCategory {
  if (!VALID_NOTE_CATEGORIES.includes(value as NoteCategory)) throw new Error(`Invalid category: ${value}`);
  return value as NoteCategory;
}

export function validateLabTestType(value: string): LabTestType {
  if (!VALID_LAB_TEST_TYPES.includes(value as LabTestType)) throw new Error(`Invalid test type: ${value}`);
  return value as LabTestType;
}

export function validateSpecies(value: string): Species {
  if (!VALID_SPECIES.includes(value as Species)) throw new Error(`Invalid species: ${value}`);
  return value as Species;
}

export function validateSex(value: string): Sex {
  if (!VALID_SEX.includes(value as Sex)) throw new Error(`Invalid sex: ${value}`);
  return value as Sex;
}

export function validateFeedingStatus(value: string): FeedingStatus {
  if (!VALID_FEEDING_STATUSES.includes(value as FeedingStatus)) throw new Error(`Invalid feeding status: ${value}`);
  return value as FeedingStatus;
}

export function validateStaffRole(value: string): StaffRole {
  if (!VALID_STAFF_ROLES.includes(value as StaffRole)) throw new Error(`Invalid role: ${value}`);
  return value as StaffRole;
}
