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
  const now = toIST(new Date());
  const todayStr = formatInTimeZone(new Date(), IST_ZONE, "yyyy-MM-dd");
  const scheduled = new Date(`${todayStr}T${scheduledTime}:00`);
  return differenceInMinutes(now, scheduled) > minutes;
}
