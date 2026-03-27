import { formatInTimeZone } from "date-fns-tz";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function buildDriveFolderPath(patientName: string, category: string): string[] {
  const now = new Date();
  const year = formatInTimeZone(now, "Asia/Kolkata", "yyyy");
  const monthIdx = parseInt(formatInTimeZone(now, "Asia/Kolkata", "M")) - 1;
  const monthName = MONTHS[monthIdx];
  const day = formatInTimeZone(now, "Asia/Kolkata", "d");
  const dayLabel = `${day}-${monthName}`;
  const catLabels: Record<string, string> = {
    MEDS: "Meds",
    FOOD: "Food",
    VITALS: "Vitals",
    BATH: "Bath",
    DISINFECTION: "Disinfection",
  };
  return ["Patients", year, monthName, patientName, dayLabel, catLabels[category] || category];
}

export function buildDriveFileName(category: string, detail: string): string {
  const now = new Date();
  const time = formatInTimeZone(now, "Asia/Kolkata", "hh-mm-a");
  const safe = detail.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  return `${category.toLowerCase()}-${safe}-${time}`;
}
