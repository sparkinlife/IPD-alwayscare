export const CLINICAL_LIVE_PROFILE = "clinicalLive";
export const CLINICAL_WARM_PROFILE = "clinicalWarm";

export type ScheduleTagKey = "meds" | "feedings" | "baths";

export type NotificationRole =
  | "ADMIN"
  | "ATTENDANT"
  | "DOCTOR"
  | "MANAGEMENT"
  | "PARAVET";

export type PatientCacheTab =
  | "shell"
  | "vitals"
  | "meds"
  | "food"
  | "notes"
  | "labs"
  | "bath"
  | "photos"
  | "isolation"
  | "logs";

export function dashboardSummaryTag(): string {
  return "dashboard:summary";
}

export function dashboardQueueTag(): string {
  return "dashboard:queue";
}

export function dashboardSetupTag(): string {
  return "dashboard:setup";
}

export function scheduleTag(key: ScheduleTagKey): string {
  return `schedule:${key}`;
}

export function notificationsTag(role: NotificationRole): string {
  return `notifications:${role.toLowerCase()}`;
}

export function patientShellTag(admissionId: string): string {
  return `patient:${admissionId}:shell`;
}

export function patientTabTag(
  admissionId: string,
  tab: Exclude<PatientCacheTab, "shell">
): string {
  return `patient:${admissionId}:${tab}`;
}
