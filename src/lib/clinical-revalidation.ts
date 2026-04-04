import { updateTag } from "next/cache";
import { scheduleTag } from "@/lib/clinical-cache";

// Schedule caches are global today; admission ids are reserved for future scoping.
export function getMedicationMutationTags(_admissionId: string): string[] {
  void _admissionId;
  return [scheduleTag("meds")];
}

export function getFeedingMutationTags(_admissionId: string): string[] {
  void _admissionId;
  return [scheduleTag("feedings")];
}

export function getBathMutationTags(_admissionId: string): string[] {
  void _admissionId;
  return [scheduleTag("baths")];
}

export function getAdmissionMutationTags(_admissionId?: string): string[] {
  void _admissionId;
  return [
    scheduleTag("meds"),
    scheduleTag("feedings"),
    scheduleTag("baths"),
  ];
}

export function updateClinicalTags(tags: readonly string[]) {
  for (const tag of new Set(tags)) {
    updateTag(tag);
  }
}
