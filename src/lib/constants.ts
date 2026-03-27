export const FREQUENCY_LABELS: Record<string, string> = {
  SID: "Once daily",
  BID: "Twice daily",
  TID: "Three times daily",
  QID: "Four times daily",
  Q4H: "Every 4 hours",
  Q6H: "Every 6 hours",
  Q8H: "Every 8 hours",
  Q12H: "Every 12 hours",
  PRN: "As needed",
  STAT: "One-time",
  WEEKLY: "Weekly",
  ALTERNATE_DAY: "Every alternate day",
  OTHER: "Custom",
};

export const FREQUENCY_DEFAULT_TIMES: Record<string, string[]> = {
  SID: ["08:00"],
  BID: ["08:00", "20:00"],
  TID: ["08:00", "14:00", "22:00"],
  QID: ["06:00", "12:00", "18:00", "00:00"],
  Q4H: ["06:00", "10:00", "14:00", "18:00", "22:00", "02:00"],
  Q6H: ["06:00", "12:00", "18:00", "00:00"],
  Q8H: ["06:00", "14:00", "22:00"],
  Q12H: ["08:00", "20:00"],
  STAT: [],
  PRN: [],
  WEEKLY: ["08:00"],
  ALTERNATE_DAY: ["08:00"],
  OTHER: [],
};

export const ROUTE_LABELS: Record<string, string> = {
  PO: "Oral (PO)",
  IV: "Intravenous (IV)",
  SC: "Subcutaneous (SC)",
  IM: "Intramuscular (IM)",
  TOPICAL: "Topical",
  NEBULIZER: "Nebulizer",
  RECTAL: "Rectal",
  OPHTHALMIC: "Ophthalmic",
  OTIC: "Otic (Ear)",
  OTHER: "Other",
};

export const CONDITION_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  CRITICAL: { label: "Critical", color: "text-clinic-red", bg: "bg-clinic-red-light", border: "border-red-200" },
  GUARDED: { label: "Guarded", color: "text-clinic-amber", bg: "bg-clinic-amber-light", border: "border-amber-200" },
  STABLE: { label: "Stable", color: "text-clinic-green", bg: "bg-clinic-green-light", border: "border-green-200" },
  IMPROVING: { label: "Improving", color: "text-clinic-blue", bg: "bg-clinic-blue-light", border: "border-blue-200" },
  RECOVERED: { label: "Recovered", color: "text-clinic-green", bg: "bg-clinic-green-light", border: "border-green-200" },
  DECEASED: { label: "Deceased", color: "text-gray-500", bg: "bg-gray-100", border: "border-gray-300" },
};

export const WARD_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  GENERAL: { label: "General", color: "text-clinic-teal", bg: "bg-clinic-teal-light" },
  ISOLATION: { label: "Isolation", color: "text-clinic-red", bg: "bg-clinic-red-light" },
  ICU: { label: "ICU", color: "text-clinic-amber", bg: "bg-clinic-amber-light" },
};

export const NOTE_CATEGORY_LABELS: Record<string, string> = {
  OBSERVATION: "Observation",
  BEHAVIOR: "Behavior",
  WOUND_CARE: "Wound Care",
  ELIMINATION: "Elimination",
  PROCEDURE: "Procedure",
  DOCTOR_ROUND: "Doctor Round",
  SHIFT_HANDOVER: "Shift Handover",
  OTHER: "Other",
};

export const NOTE_ROLE_COLORS: Record<string, string> = {
  DOCTOR: "text-purple-600",
  PARAVET: "text-clinic-teal",
  ATTENDANT: "text-gray-500",
  ADMIN: "text-gray-500",
};

export const COMMON_SKIP_REASONS = [
  "Patient vomiting",
  "Refused oral medication",
  "NPO — nothing by mouth",
  "Medication not available",
  "Doctor advised to hold",
];

export const COMMON_DRUGS = [
  "Ceftriaxone",
  "Meloxicam",
  "Pantoprazole",
  "Ondansetron",
  "Metronidazole",
  "Amoxicillin-Clavulanate",
  "Doxycycline",
  "Tramadol",
  "Nebulization (Salbutamol + NS)",
  "Vitamin B Complex",
  "Iron supplement",
  "Ivermectin",
];

export const PPE_OPTIONS = [
  "Gloves",
  "Gown",
  "Shoe covers",
  "Face mask",
  "Eye protection",
  "Hand sanitize on exit",
];

export const DISINFECTION_INTERVALS = [
  { value: "Q2H", label: "Every 2 hours" },
  { value: "Q4H", label: "Every 4 hours" },
  { value: "Q6H", label: "Every 6 hours" },
  { value: "Q8H", label: "Every 8 hours" },
  { value: "Q12H", label: "Every 12 hours" },
];

export const BATH_DUE_DAYS = 5;
