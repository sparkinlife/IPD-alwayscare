import test from "node:test";
import assert from "node:assert/strict";
import {
  getManagementPatientTabLoadPlan,
  normalizeManagementPatientTab,
} from "../src/lib/management-patient-page-data";

test("today tab requests only summary data", () => {
  assert.deepEqual(getManagementPatientTabLoadPlan("today"), {
    today: true,
    history: false,
    media: false,
  });
});

test("media tab only opts into media data", () => {
  assert.deepEqual(getManagementPatientTabLoadPlan("media"), {
    today: false,
    history: false,
    media: true,
  });
});

test("history tab keeps the broad history load", () => {
  const plan = getManagementPatientTabLoadPlan("history");
  assert.equal(plan.history, true);
  assert.equal(plan.media, false);
  assert.equal(plan.today, false);
});

test("unknown management tabs normalize to today", () => {
  assert.equal(normalizeManagementPatientTab(undefined), "today");
  assert.equal(normalizeManagementPatientTab("wat"), "today");
});
