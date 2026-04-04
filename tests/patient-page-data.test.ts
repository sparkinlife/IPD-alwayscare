import test from "node:test";
import assert from "node:assert/strict";
import {
  getPatientTabLoadPlan,
  normalizePatientTab,
} from "../src/lib/patient-page-data";

test("vitals tab only requests shell, vitals, and doctor actions", () => {
  assert.deepEqual(getPatientTabLoadPlan("vitals", true), {
    vitals: true,
    meds: false,
    food: false,
    notes: false,
    labs: false,
    bath: false,
    isolation: false,
    logs: false,
    photos: false,
    profilePhoto: true,
    availableCages: true,
  });
});

test("photos tab only requests shell and media data", () => {
  assert.deepEqual(getPatientTabLoadPlan("photos", false), {
    vitals: false,
    meds: false,
    food: false,
    notes: false,
    labs: false,
    bath: false,
    isolation: false,
    logs: false,
    photos: true,
    profilePhoto: true,
    availableCages: false,
  });
});

test("logs tab opts into the broad history load", () => {
  const plan = getPatientTabLoadPlan("logs", true);
  assert.equal(plan.logs, true);
  assert.equal(plan.availableCages, true);
});

test("invalid patient tabs normalize to vitals", () => {
  assert.equal(normalizePatientTab(undefined), "vitals");
  assert.equal(normalizePatientTab("wat"), "vitals");
});
