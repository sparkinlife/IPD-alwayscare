import test from "node:test";
import assert from "node:assert/strict";

import * as logsReadModel from "../src/lib/logs-read-model";

const buildLogsTimelineEntries = (
  logsReadModel as Record<string, unknown>
).buildLogsTimelineEntries as
  | undefined
  | ((data: Record<string, unknown>) => Array<Record<string, unknown>>);

test("buildLogsTimelineEntries sorts events and skips untouched meds and pending feeds", () => {
  assert.equal(typeof buildLogsTimelineEntries, "function");

  const entries = buildLogsTimelineEntries!({
    medicationAdministrations: [
      {
        scheduledTime: "08:00",
        wasAdministered: false,
        wasSkipped: false,
        skipReason: null,
        actualTime: null,
        createdAt: new Date("2026-04-04T04:00:00.000Z"),
        administeredBy: { name: "Unused" },
        treatmentPlan: { drugName: "Unused", dose: "1 ml", route: "IV" },
      },
      {
        scheduledTime: "09:00",
        wasAdministered: true,
        wasSkipped: false,
        skipReason: null,
        actualTime: new Date("2026-04-04T12:10:00.000Z"),
        createdAt: new Date("2026-04-04T12:05:00.000Z"),
        administeredBy: { name: "Dr Rao" },
        treatmentPlan: { drugName: "Ceftriaxone", dose: "1 ml", route: "IV" },
      },
      {
        scheduledTime: "10:00",
        wasAdministered: false,
        wasSkipped: true,
        skipReason: "NPO",
        actualTime: null,
        createdAt: new Date("2026-04-04T12:20:00.000Z"),
        administeredBy: null,
        treatmentPlan: { drugName: "Meloxicam", dose: "0.4 ml", route: "SC" },
      },
    ],
    vitalRecords: [
      {
        recordedAt: new Date("2026-04-04T11:00:00.000Z"),
        temperature: 38.5,
        heartRate: 120,
        respRate: null,
        painScore: null,
        weight: null,
        recordedBy: { name: "Tech A" },
      },
    ],
    feedingLogs: [
      {
        status: "PENDING",
        createdAt: new Date("2026-04-04T09:30:00.000Z"),
        loggedBy: { name: "Ignored" },
        feedingSchedule: { scheduledTime: "09:00", foodType: "Rice" },
      },
      {
        status: "EATEN",
        createdAt: new Date("2026-04-04T10:30:00.000Z"),
        loggedBy: { name: "Attendant A" },
        feedingSchedule: { scheduledTime: "10:00", foodType: "Rice" },
      },
    ],
    bathLogs: [
      {
        bathedAt: new Date("2026-04-04T08:00:00.000Z"),
        notes: "Medicated shampoo",
        bathedBy: { name: "Helper A" },
      },
    ],
    clinicalNotes: [],
    disinfectionLogs: [],
    fluidTherapies: [],
  });

  assert.deepEqual(
    entries.map((entry) => entry.description),
    [
      "Meloxicam 0.4 ml SC — Skipped: NPO",
      "Ceftriaxone 1 ml IV — Given",
      "Temp 38.5°C, HR 120",
      "10:00 Rice: Eaten",
      "Bath given — Medicated shampoo",
    ]
  );
  assert.deepEqual(
    entries.map((entry) => entry.by),
    ["—", "Dr Rao", "Tech A", "Attendant A", "Helper A"]
  );
});

test("buildLogsTimelineEntries formats notes, fluid events, and disinfection history", () => {
  assert.equal(typeof buildLogsTimelineEntries, "function");

  const entries = buildLogsTimelineEntries!({
    medicationAdministrations: [],
    vitalRecords: [],
    feedingLogs: [],
    bathLogs: [],
    clinicalNotes: [
      {
        recordedAt: new Date("2026-04-04T13:00:00.000Z"),
        category: "DOCTOR_ROUND",
        content: "A".repeat(101),
        recordedBy: { name: "Dr Mehta", role: "DOCTOR" },
      },
    ],
    disinfectionLogs: [
      {
        performedAt: new Date("2026-04-04T10:00:00.000Z"),
        performedBy: { name: "Ward Staff" },
      },
    ],
    fluidTherapies: [
      {
        fluidType: "NS",
        rate: "20 ml/hr",
        startTime: new Date("2026-04-04T07:00:00.000Z"),
        endTime: new Date("2026-04-04T09:00:00.000Z"),
        createdBy: { name: "Dr Patel" },
        rateChanges: [
          {
            oldRate: "20 ml/hr",
            newRate: "30 ml/hr",
            changedAt: new Date("2026-04-04T08:00:00.000Z"),
            changedBy: { name: "Dr Patel" },
            reason: "Shock",
          },
        ],
      },
    ],
  });

  assert.deepEqual(
    entries.map((entry) => entry.description),
    [
      `[Doctor Round] ${"A".repeat(100)}…`,
      "Ward disinfection performed",
      "IV Fluid stopped: NS",
      "IV rate changed: 20 ml/hr → 30 ml/hr (Shock)",
      "IV Fluid started: NS @ 20 ml/hr",
    ]
  );
  assert.equal(entries[0].roleColor, "text-purple-600");
  assert.deepEqual(
    entries.map((entry) => entry.by),
    ["Dr Mehta", "Ward Staff", "Dr Patel", "Dr Patel", "Dr Patel"]
  );
});
