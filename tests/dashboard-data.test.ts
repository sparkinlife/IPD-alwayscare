import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDashboardStats,
  filterDashboardQueue,
  getBathReferenceDate,
  selectLatestVital,
  selectNextMedication,
  countUpcomingFeedings,
  sortDashboardQueue,
  toDashboardQueueAdmission,
} from "../src/lib/dashboard-data";

const activeAdmissions = [
  {
    id: "a1",
    ward: "GENERAL",
    condition: "CRITICAL",
    pendingMeds: 2,
    upcomingFeedings: 1,
    bathDue: true,
    admissionDate: new Date("2026-04-03T05:00:00.000Z"),
  },
  {
    id: "a2",
    ward: "ISOLATION",
    condition: "STABLE",
    pendingMeds: 1,
    upcomingFeedings: 0,
    bathDue: false,
    admissionDate: new Date("2026-04-03T03:00:00.000Z"),
  },
];

test("buildDashboardStats computes the clinical counters", () => {
  assert.deepEqual(buildDashboardStats(activeAdmissions), {
    totalActive: 2,
    criticalCount: 1,
    pendingMedsCount: 3,
    feedingsCount: 1,
    bathsDueCount: 1,
  });
});

test("sortDashboardQueue puts critical patients first", () => {
  const sorted = sortDashboardQueue(activeAdmissions);
  assert.equal(sorted[0].id, "a1");
  assert.equal(sorted[1].id, "a2");
});

test("filterDashboardQueue narrows by ward", () => {
  const filtered = filterDashboardQueue(activeAdmissions, "ISOLATION");
  assert.deepEqual(filtered.map((item) => item.id), ["a2"]);
});

test("countUpcomingFeedings includes cross-midnight windows", () => {
  const count = countUpcomingFeedings(
    [
      {
        feedingSchedules: [
          { scheduledTime: "22:45" },
          { scheduledTime: "23:30" },
          { scheduledTime: "00:15" },
          { scheduledTime: "01:15" },
        ],
      },
    ],
    "23:00",
    "01:00"
  );

  assert.equal(count, 2);
});

test("getBathReferenceDate falls back to admission date when there is no bath log", () => {
  const admissionDate = new Date("2026-04-02T06:30:00.000Z");

  assert.equal(getBathReferenceDate(admissionDate, []), admissionDate);
});

test("selectLatestVital returns null when there are no vitals", () => {
  assert.equal(selectLatestVital([]), null);
});

test("selectNextMedication returns the next incomplete administration", () => {
  const nextMedication = selectNextMedication([
    {
      drugName: "Amoxicillin",
      scheduledTimes: ["08:00", "12:00"],
      administrations: [
        { scheduledTime: "08:00", wasAdministered: true, wasSkipped: false },
        { scheduledTime: "12:00", wasAdministered: false, wasSkipped: false },
      ],
    },
    {
      drugName: "Meloxicam",
      scheduledTimes: ["09:00"],
      administrations: [
        { scheduledTime: "09:00", wasAdministered: false, wasSkipped: false },
      ],
    },
  ] as any);

  assert.deepEqual(nextMedication, {
    drugName: "Meloxicam",
    scheduledTime: "09:00",
  });
});

test("selectNextMedication falls back to the earliest scheduled slot without an administration row", () => {
  const nextMedication = selectNextMedication([
    {
      drugName: "Ceftriaxone",
      scheduledTimes: ["06:00", "14:00"],
      administrations: [],
    },
    {
      drugName: "Meloxicam",
      scheduledTimes: ["09:00"],
      administrations: [
        { scheduledTime: "09:00", wasAdministered: true, wasSkipped: false },
      ],
    },
  ] as any);

  assert.deepEqual(nextMedication, {
    drugName: "Ceftriaxone",
    scheduledTime: "06:00",
  });
});

test("toDashboardQueueAdmission preserves queue read-model fallbacks", () => {
  const admission = toDashboardQueueAdmission({
    id: "adm-1",
    cageNumber: "C-14",
    condition: "STABLE",
    ward: "GENERAL",
    diagnosis: "Skin infection",
    attendingDoctor: "Rao",
    admissionDate: new Date("2026-04-01T07:00:00.000Z"),
    patient: {
      name: "Poppy",
      breed: null,
      age: "4y",
      weight: 11.2,
    },
    vitalRecords: [],
    bathLogs: [],
    treatmentPlans: [
      {
        drugName: "Meloxicam",
        scheduledTimes: ["09:00", "18:00"],
        administrations: [
          { scheduledTime: "09:00", wasAdministered: true, wasSkipped: false },
          { scheduledTime: "18:00", wasAdministered: false, wasSkipped: false },
        ],
      },
    ],
  });

  assert.equal(admission.bathReferenceDate.toISOString(), "2026-04-01T07:00:00.000Z");
  assert.equal(admission.latestVital, null);
  assert.deepEqual(admission.nextMedication, {
    drugName: "Meloxicam",
    scheduledTime: "18:00",
  });
});
