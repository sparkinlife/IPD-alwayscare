import test from "node:test";
import assert from "node:assert/strict";
import {
  CLINICAL_LIVE_PROFILE,
  CLINICAL_WARM_PROFILE,
  dashboardSummaryTag,
  dashboardQueueTag,
  dashboardSetupTag,
  scheduleTag,
  notificationsTag,
  patientShellTag,
  patientTabTag,
} from "../src/lib/clinical-cache";

test("clinical cache constants and tags match the approved contract", () => {
  assert.equal(CLINICAL_LIVE_PROFILE, "clinicalLive");
  assert.equal(CLINICAL_WARM_PROFILE, "clinicalWarm");
  assert.equal(dashboardSummaryTag(), "dashboard:summary");
  assert.equal(dashboardQueueTag(), "dashboard:queue");
  assert.equal(dashboardSetupTag(), "dashboard:setup");
  assert.equal(scheduleTag("meds"), "schedule:meds");
  assert.equal(scheduleTag("feedings"), "schedule:feedings");
  assert.equal(scheduleTag("baths"), "schedule:baths");
  assert.equal(notificationsTag("DOCTOR"), "notifications:doctor");
  assert.equal(notificationsTag("ADMIN"), "notifications:admin");
  assert.equal(notificationsTag("ATTENDANT"), "notifications:attendant");
  assert.equal(notificationsTag("MANAGEMENT"), "notifications:management");
  assert.equal(notificationsTag("PARAVET"), "notifications:paravet");
  assert.equal(patientShellTag("adm-1"), "patient:adm-1:shell");
  assert.equal(patientTabTag("adm-1", "vitals"), "patient:adm-1:vitals");
  assert.equal(patientTabTag("adm-1", "meds"), "patient:adm-1:meds");
  assert.equal(patientTabTag("adm-1", "food"), "patient:adm-1:food");
  assert.equal(patientTabTag("adm-1", "notes"), "patient:adm-1:notes");
  assert.equal(patientTabTag("adm-1", "labs"), "patient:adm-1:labs");
  assert.equal(patientTabTag("adm-1", "bath"), "patient:adm-1:bath");
  assert.equal(patientTabTag("adm-1", "photos"), "patient:adm-1:photos");
  assert.equal(patientTabTag("adm-1", "isolation"), "patient:adm-1:isolation");
  assert.equal(patientTabTag("adm-1", "logs"), "patient:adm-1:logs");
});

// @ts-expect-error shell is intentionally excluded from patientTabTag
patientTabTag("adm-1", "shell");
