import { updateTag } from "next/cache";
import { notificationsTag, scheduleTag } from "@/lib/clinical-cache";

const NOTIFICATION_ROLE_TAGS = [
  notificationsTag("ADMIN"),
  notificationsTag("ATTENDANT"),
  notificationsTag("DOCTOR"),
  notificationsTag("MANAGEMENT"),
  notificationsTag("PARAVET"),
];

// Schedule caches are global today; admission ids are reserved for future scoping.
export function getMedicationMutationTags(_admissionId: string): string[] {
  void _admissionId;
  return [scheduleTag("meds"), ...NOTIFICATION_ROLE_TAGS];
}

export function getFeedingMutationTags(_admissionId: string): string[] {
  void _admissionId;
  return [scheduleTag("feedings"), ...NOTIFICATION_ROLE_TAGS];
}

export function getBathMutationTags(_admissionId: string): string[] {
  void _admissionId;
  return [scheduleTag("baths"), ...NOTIFICATION_ROLE_TAGS];
}

export function getAdmissionMutationTags(_admissionId?: string): string[] {
  void _admissionId;
  return [
    scheduleTag("meds"),
    scheduleTag("feedings"),
    scheduleTag("baths"),
    ...NOTIFICATION_ROLE_TAGS,
  ];
}

export function getVitalsMutationTags(_admissionId: string): string[] {
  void _admissionId;
  return [...NOTIFICATION_ROLE_TAGS];
}

export function getIsolationMutationTags(_admissionId: string): string[] {
  void _admissionId;
  return [...NOTIFICATION_ROLE_TAGS];
}

export function updateClinicalTags(tags: readonly string[]) {
  for (const tag of new Set(tags)) {
    updateTag(tag);
  }
}
