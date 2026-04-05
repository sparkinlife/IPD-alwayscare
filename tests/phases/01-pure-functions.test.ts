import test from "node:test";
import assert from "node:assert/strict";

// ── Validators ──────────────────────────────────────────────────────────────

import {
  validateWard,
  validateCondition,
  validateMedRoute,
  validateFrequency,
  validateNoteCategory,
  validateLabTestType,
  validateSpecies,
  validateSex,
  validateFeedingStatus,
  validateStaffRole,
} from "../../src/lib/validators";

test("validateWard accepts valid wards", () => {
  assert.equal(validateWard("GENERAL"), "GENERAL");
  assert.equal(validateWard("ISOLATION"), "ISOLATION");
  assert.equal(validateWard("ICU"), "ICU");
});

test("validateWard rejects invalid input", () => {
  assert.throws(() => validateWard("INVALID"), /Invalid ward/);
  assert.throws(() => validateWard(""), /Invalid ward/);
});

test("validateCondition accepts valid conditions", () => {
  assert.equal(validateCondition("CRITICAL"), "CRITICAL");
  assert.equal(validateCondition("STABLE"), "STABLE");
  assert.equal(validateCondition("GUARDED"), "GUARDED");
  assert.equal(validateCondition("IMPROVING"), "IMPROVING");
  assert.equal(validateCondition("RECOVERED"), "RECOVERED");
});

test("validateCondition rejects invalid input", () => {
  assert.throws(() => validateCondition("BAD"), /Invalid condition/);
});

test("validateMedRoute accepts valid routes", () => {
  assert.equal(validateMedRoute("PO"), "PO");
  assert.equal(validateMedRoute("IV"), "IV");
  assert.equal(validateMedRoute("SC"), "SC");
  assert.equal(validateMedRoute("IM"), "IM");
});

test("validateMedRoute rejects invalid input", () => {
  assert.throws(() => validateMedRoute("ORAL"), /Invalid route/);
});

test("validateFrequency accepts valid frequencies", () => {
  assert.equal(validateFrequency("SID"), "SID");
  assert.equal(validateFrequency("BID"), "BID");
  assert.equal(validateFrequency("TID"), "TID");
  assert.equal(validateFrequency("PRN"), "PRN");
});

test("validateFrequency rejects invalid input", () => {
  assert.throws(() => validateFrequency("DAILY"), /Invalid frequency/);
});

test("validateNoteCategory accepts valid categories", () => {
  assert.equal(validateNoteCategory("OBSERVATION"), "OBSERVATION");
  assert.equal(validateNoteCategory("DOCTOR_ROUND"), "DOCTOR_ROUND");
  assert.equal(validateNoteCategory("SHIFT_HANDOVER"), "SHIFT_HANDOVER");
});

test("validateNoteCategory rejects invalid input", () => {
  assert.throws(() => validateNoteCategory("NOTE"), /Invalid category/);
});

test("validateLabTestType accepts valid types", () => {
  assert.equal(validateLabTestType("CBC"), "CBC");
  assert.equal(validateLabTestType("PCR"), "PCR");
  assert.equal(validateLabTestType("URINALYSIS"), "URINALYSIS");
});

test("validateLabTestType accepts XRAY and OTHER", () => {
  assert.equal(validateLabTestType("XRAY"), "XRAY");
  assert.equal(validateLabTestType("OTHER"), "OTHER");
});

test("validateLabTestType rejects invalid input", () => {
  assert.throws(() => validateLabTestType("MRI"), /Invalid test type/);
});

test("validateSpecies accepts valid species", () => {
  assert.equal(validateSpecies("DOG"), "DOG");
  assert.equal(validateSpecies("CAT"), "CAT");
  assert.equal(validateSpecies("BIRD"), "BIRD");
  assert.equal(validateSpecies("OTHER"), "OTHER");
});

test("validateSpecies rejects invalid input", () => {
  assert.throws(() => validateSpecies("FISH"), /Invalid species/);
});

test("validateSex accepts valid sex values", () => {
  assert.equal(validateSex("MALE"), "MALE");
  assert.equal(validateSex("FEMALE"), "FEMALE");
  assert.equal(validateSex("UNKNOWN"), "UNKNOWN");
});

test("validateSex rejects invalid input", () => {
  assert.throws(() => validateSex("X"), /Invalid sex/);
});

test("validateFeedingStatus accepts valid statuses", () => {
  assert.equal(validateFeedingStatus("PENDING"), "PENDING");
  assert.equal(validateFeedingStatus("EATEN"), "EATEN");
  assert.equal(validateFeedingStatus("PARTIAL"), "PARTIAL");
  assert.equal(validateFeedingStatus("REFUSED"), "REFUSED");
  assert.equal(validateFeedingStatus("SKIPPED"), "SKIPPED");
});

test("validateFeedingStatus rejects invalid input", () => {
  assert.throws(() => validateFeedingStatus("DONE"), /Invalid feeding status/);
});

test("validateStaffRole accepts valid roles", () => {
  assert.equal(validateStaffRole("DOCTOR"), "DOCTOR");
  assert.equal(validateStaffRole("PARAVET"), "PARAVET");
  assert.equal(validateStaffRole("ATTENDANT"), "ATTENDANT");
  assert.equal(validateStaffRole("ADMIN"), "ADMIN");
  assert.equal(validateStaffRole("MANAGEMENT"), "MANAGEMENT");
});

test("validateStaffRole rejects invalid input", () => {
  assert.throws(() => validateStaffRole("NURSE"), /Invalid role/);
});

// ── Date Utilities ──────────────────────────────────────────────────────────

import {
  toIST,
  formatIST,
  formatTimeIST,
  formatDateTimeIST,
  toUTCDate,
  getTodayIST,
  parseIntervalHours,
  isOverdueByMinutes,
  isBathDue,
} from "../../src/lib/date-utils";

test("toIST converts UTC date to IST", () => {
  const utc = new Date("2026-04-05T00:00:00.000Z");
  const ist = toIST(utc);
  // IST is UTC+5:30, so midnight UTC = 05:30 IST
  assert.equal(ist.getHours(), 5);
  assert.equal(ist.getMinutes(), 30);
});

test("formatIST formats date in IST timezone", () => {
  const utc = new Date("2026-04-05T00:00:00.000Z");
  assert.equal(formatIST(utc), "05/04/2026");
});

test("formatTimeIST returns HH:mm in IST", () => {
  const utc = new Date("2026-04-05T12:00:00.000Z");
  // 12:00 UTC = 17:30 IST
  assert.equal(formatTimeIST(utc), "17:30");
});

test("formatDateTimeIST returns full datetime in IST", () => {
  const utc = new Date("2026-04-05T12:00:00.000Z");
  assert.equal(formatDateTimeIST(utc), "05/04/2026 17:30");
});

test("toUTCDate converts date string to UTC midnight", () => {
  const result = toUTCDate("2026-04-05");
  assert.equal(result.toISOString(), "2026-04-05T00:00:00.000Z");
});

test("getTodayIST returns yyyy-MM-dd format", () => {
  const today = getTodayIST();
  assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
});

test("parseIntervalHours extracts hours from Q4H", () => {
  assert.equal(parseIntervalHours("Q4H"), 4);
});

test("parseIntervalHours extracts hours from Q6H", () => {
  assert.equal(parseIntervalHours("Q6H"), 6);
});

test("parseIntervalHours defaults to 4 for garbage input", () => {
  assert.equal(parseIntervalHours("garbage"), 4);
});

test("isOverdueByMinutes returns false for future time", () => {
  // Compute a time 2 hours in the future (IST) to avoid cross-midnight flakes
  const now = new Date();
  const futureH = (now.getUTCHours() + 5 + 2) % 24; // +5:30 IST offset + 2h buffer, wrap at 24
  const futureM = (now.getUTCMinutes() + 30) % 60;
  const futureTime = `${String(futureH).padStart(2, "0")}:${String(futureM).padStart(2, "0")}`;
  assert.equal(isOverdueByMinutes(futureTime, 30), false);
});

test("isBathDue reports due at exactly 5 days", () => {
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const result = isBathDue(fiveDaysAgo);
  assert.equal(result.isDue, true);
  assert.equal(result.daysSinceLast, 5);
});

test("isBathDue reports overdue after 5 days", () => {
  const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
  const result = isBathDue(sixDaysAgo);
  assert.equal(result.isDue, true);
  assert.equal(result.isOverdue, true);
});

test("isBathDue reports not due within 5 days", () => {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const result = isBathDue(threeDaysAgo);
  assert.equal(result.isDue, false);
  assert.equal(result.isOverdue, false);
});

// ── Vitals Thresholds ───────────────────────────────────────────────────────

import {
  checkTemperature,
  checkHeartRate,
  checkRespRate,
  checkPainScore,
  checkCRT,
  hasAnyAbnormalVital,
} from "../../src/lib/vitals-thresholds";

test("checkTemperature normal range (37.5-39.5)", () => {
  assert.equal(checkTemperature(38.5).isAbnormal, false);
  assert.equal(checkTemperature(38.5).label, "Normal");
});

test("checkTemperature high (>39.5)", () => {
  assert.equal(checkTemperature(39.6).isAbnormal, true);
  assert.equal(checkTemperature(39.6).label, "↑ HIGH");
});

test("checkTemperature boundary 39.5 is normal", () => {
  assert.equal(checkTemperature(39.5).isAbnormal, false);
});

test("checkTemperature low (<37.5)", () => {
  assert.equal(checkTemperature(37.4).isAbnormal, true);
  assert.equal(checkTemperature(37.4).label, "↓ LOW");
});

test("checkTemperature null returns no flag", () => {
  assert.equal(checkTemperature(null).isAbnormal, false);
  assert.equal(checkTemperature(null).label, "");
});

test("checkHeartRate normal range (60-140)", () => {
  assert.equal(checkHeartRate(100).isAbnormal, false);
});

test("checkHeartRate high (>140)", () => {
  assert.equal(checkHeartRate(141).isAbnormal, true);
  assert.equal(checkHeartRate(141).label, "↑ HIGH");
});

test("checkHeartRate low (<60)", () => {
  assert.equal(checkHeartRate(59).isAbnormal, true);
  assert.equal(checkHeartRate(59).label, "↓ LOW");
});

test("checkRespRate normal (<=35)", () => {
  assert.equal(checkRespRate(30).isAbnormal, false);
});

test("checkRespRate high (>35)", () => {
  assert.equal(checkRespRate(36).isAbnormal, true);
});

test("checkPainScore normal (<5)", () => {
  assert.equal(checkPainScore(4).isAbnormal, false);
});

test("checkPainScore high (>=5)", () => {
  assert.equal(checkPainScore(5).isAbnormal, true);
});

test("checkCRT normal (<=2)", () => {
  assert.equal(checkCRT(2).isAbnormal, false);
});

test("checkCRT slow (>2)", () => {
  assert.equal(checkCRT(3).isAbnormal, true);
  assert.equal(checkCRT(3).label, "↑ SLOW");
});

test("hasAnyAbnormalVital true with one abnormal", () => {
  assert.equal(hasAnyAbnormalVital({ temperature: 40.0 }), true);
});

test("hasAnyAbnormalVital false with all normal", () => {
  assert.equal(
    hasAnyAbnormalVital({
      temperature: 38.5,
      heartRate: 100,
      respRate: 20,
      painScore: 2,
      capillaryRefillTime: 1.5,
    }),
    false,
  );
});

test("hasAnyAbnormalVital false with all null", () => {
  assert.equal(hasAnyAbnormalVital({}), false);
});

// ── Action Utils ────────────────────────────────────────────────────────────

import { handleActionError, ActionUserError } from "../../src/lib/action-utils";
import { Prisma } from "@prisma/client";

test("handleActionError returns custom message for ActionUserError", () => {
  const result = handleActionError(new ActionUserError("Cage is occupied"));
  assert.deepEqual(result, { error: "Cage is occupied" });
});

test("handleActionError maps P2002 to already exists", () => {
  const err = new Prisma.PrismaClientKnownRequestError("Unique", {
    code: "P2002",
    clientVersion: "0",
  });
  assert.deepEqual(handleActionError(err), { error: "This record already exists" });
});

test("handleActionError maps P2025 to not found", () => {
  const err = new Prisma.PrismaClientKnownRequestError("Not found", {
    code: "P2025",
    clientVersion: "0",
  });
  assert.deepEqual(handleActionError(err), { error: "Record not found" });
});

test("handleActionError maps P2003 to missing related data", () => {
  const err = new Prisma.PrismaClientKnownRequestError("FK", {
    code: "P2003",
    clientVersion: "0",
  });
  assert.deepEqual(handleActionError(err), {
    error: "This action could not be completed because related data is missing",
  });
});

test("handleActionError maps P2034 to retry", () => {
  const err = new Prisma.PrismaClientKnownRequestError("Conflict", {
    code: "P2034",
    clientVersion: "0",
  });
  assert.deepEqual(handleActionError(err), { error: "Request conflict, please retry" });
});

test("handleActionError re-throws Next.js redirects (digest)", () => {
  const redirect = { digest: "NEXT_REDIRECT;/dashboard" };
  assert.throws(() => handleActionError(redirect));
});

test("handleActionError maps Unauthorized to login message", () => {
  const result = handleActionError(new Error("Unauthorized"));
  assert.deepEqual(result, { error: "Please log in again" });
});

test("handleActionError passes through Forbidden messages", () => {
  const result = handleActionError(new Error("Forbidden: Doctor or Admin only"));
  assert.deepEqual(result, { error: "Forbidden: Doctor or Admin only" });
});

test("handleActionError returns generic message for unknown errors", () => {
  const result = handleActionError(new Error("something weird"));
  assert.deepEqual(result, { error: "An unexpected error occurred" });
});
