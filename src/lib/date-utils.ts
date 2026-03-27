import { formatDistanceToNow, differenceInDays, differenceInMinutes } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

const IST_ZONE = "Asia/Kolkata";

export function toIST(date: Date): Date {
  return toZonedTime(date, IST_ZONE);
}

export function formatIST(date: Date, formatStr: string = "dd/MM/yyyy"): string {
  return formatInTimeZone(date, IST_ZONE, formatStr);
}

export function formatTimeIST(date: Date): string {
  return formatInTimeZone(date, IST_ZONE, "HH:mm");
}

export function formatDateTimeIST(date: Date): string {
  return formatInTimeZone(date, IST_ZONE, "dd/MM/yyyy HH:mm");
}

export function formatRelative(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true });
}

export function daysSince(date: Date): number {
  return differenceInDays(new Date(), date);
}

export function minutesSince(date: Date): number {
  return differenceInMinutes(new Date(), date);
}

export function isBathDue(lastBathOrAdmission: Date, dueDays: number = 5): {
  isDue: boolean;
  isOverdue: boolean;
  daysSinceLast: number;
} {
  const days = daysSince(lastBathOrAdmission);
  return {
    isDue: days >= dueDays,
    isOverdue: days > dueDays,
    daysSinceLast: days,
  };
}

export function getTodayIST(): string {
  return formatInTimeZone(new Date(), IST_ZONE, "yyyy-MM-dd");
}

export function isOverdueByMinutes(scheduledTime: string, minutes: number = 30): boolean {
  const todayStr = getTodayIST();
  const scheduledMs = new Date(`${todayStr}T${scheduledTime}:00+05:30`).getTime();
  const nowMs = Date.now();
  if (scheduledMs > nowMs) return false; // Future — not overdue
  return (nowMs - scheduledMs) / 60000 > minutes;
}

/**
 * Convert an IST date string (yyyy-MM-dd) to a Date at UTC midnight.
 * Use this for ALL Prisma @db.Date field reads and writes.
 * e.g., "2026-03-27" → 2026-03-27T00:00:00.000Z → Prisma stores "2026-03-27"
 */
export function toUTCDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00.000Z");
}

/**
 * Get today's date (IST) as a UTC Date object for @db.Date queries.
 */
export function getTodayUTCDate(): Date {
  return toUTCDate(getTodayIST());
}

/**
 * Get current IST time as HH:mm string.
 */
export function getNowTimeIST(): string {
  return formatInTimeZone(new Date(), IST_ZONE, "HH:mm");
}

/**
 * Parse a disinfection interval string like "Q4H" into hours.
 * Returns 4 for "Q4H", 6 for "Q6H", etc. Defaults to 4 if unparseable.
 */
export function parseIntervalHours(intervalStr: string): number {
  return parseInt(intervalStr.match(/\d+/)?.[0] ?? "4", 10);
}
