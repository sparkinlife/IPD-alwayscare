import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  getAdmissionMutationTags,
  getBathMutationTags,
  getFeedingMutationTags,
  getIsolationMutationTags,
  getMedicationMutationTags,
  getVitalsMutationTags,
} from "../src/lib/clinical-revalidation";

function getFunctionSource(source: string, name: string) {
  const signature = `export async function ${name}`;
  const start = source.indexOf(signature);

  assert.notEqual(start, -1, `Could not find function ${name}`);

  const next = source.indexOf("\nexport async function ", start + signature.length);
  return source.slice(start, next === -1 ? source.length : next);
}

const medicationsSource = readFileSync(
  new URL("../src/actions/medications.ts", import.meta.url),
  "utf8"
);
const feedingSource = readFileSync(
  new URL("../src/actions/feeding.ts", import.meta.url),
  "utf8"
);
const bathsSource = readFileSync(
  new URL("../src/actions/baths.ts", import.meta.url),
  "utf8"
);
const vitalsSource = readFileSync(
  new URL("../src/actions/vitals.ts", import.meta.url),
  "utf8"
);
const isolationSource = readFileSync(
  new URL("../src/actions/isolation.ts", import.meta.url),
  "utf8"
);
const admissionsSource = readFileSync(
  new URL("../src/actions/admissions.ts", import.meta.url),
  "utf8"
);

const notificationTags = [
  "notifications:admin",
  "notifications:attendant",
  "notifications:doctor",
  "notifications:management",
  "notifications:paravet",
];

test("medication mutations invalidate the schedule meds cache", () => {
  assert.deepEqual(getMedicationMutationTags("adm-1"), [
    "schedule:meds",
    ...notificationTags,
  ]);
});

test("feeding mutations invalidate the schedule feedings cache", () => {
  assert.deepEqual(getFeedingMutationTags("adm-1"), [
    "schedule:feedings",
    ...notificationTags,
  ]);
});

test("bath mutations invalidate the schedule baths cache", () => {
  assert.deepEqual(getBathMutationTags("adm-1"), [
    "schedule:baths",
    ...notificationTags,
  ]);
});

test("admission mutations invalidate all schedule caches", () => {
  assert.deepEqual(getAdmissionMutationTags("adm-1"), [
    "schedule:meds",
    "schedule:feedings",
    "schedule:baths",
    ...notificationTags,
  ]);
});

test("vitals mutations invalidate all notification caches", () => {
  assert.deepEqual(getVitalsMutationTags("adm-1"), notificationTags);
});

test("isolation mutations invalidate all notification caches", () => {
  assert.deepEqual(getIsolationMutationTags("adm-1"), notificationTags);
});

test("schedule-visible medication actions use the medication invalidation contract", () => {
  for (const name of [
    "prescribeMedication",
    "stopMedication",
    "administerDose",
    "updateMedication",
    "deleteMedication",
    "undoAdministration",
    "skipDose",
  ]) {
    assert.match(
      getFunctionSource(medicationsSource, name),
      /updateClinicalTags\(\s*getMedicationMutationTags\([\s\S]*?\)\s*\);/
    );
  }
});

test("schedule-visible feeding actions use the feeding invalidation contract", () => {
  for (const name of [
    "createDietPlan",
    "logFeeding",
    "updateFeeding",
    "deleteFeeding",
  ]) {
    assert.match(
      getFunctionSource(feedingSource, name),
      /updateClinicalTags\(\s*getFeedingMutationTags\([\s\S]*?\)\s*\);/
    );
  }
});

test("bath actions use the bath invalidation contract", () => {
  for (const name of ["logBath", "updateBath", "deleteBath"]) {
    assert.match(
      getFunctionSource(bathsSource, name),
      /updateClinicalTags\(\s*getBathMutationTags\([\s\S]*?\)\s*\);/
    );
  }
});

test("schedule-visible admission actions use the admission invalidation contract", () => {
  for (const name of [
    "registerPatient",
    "cancelRegistration",
    "editRegisteredPatient",
    "clinicalSetup",
    "updateCondition",
    "transferWard",
    "updatePatient",
    "updateAdmission",
    "archivePatient",
    "restorePatient",
    "dischargePatient",
  ]) {
    assert.match(
      getFunctionSource(admissionsSource, name),
      /updateClinicalTags\(\s*getAdmissionMutationTags\([\s\S]*?\)\s*\);/
    );
  }
});

test("vitals actions use the vitals invalidation contract", () => {
  for (const name of ["recordVitals", "updateVitals", "deleteVitals"]) {
    assert.match(
      getFunctionSource(vitalsSource, name),
      /updateClinicalTags\(\s*getVitalsMutationTags\([\s\S]*?\)\s*\);/
    );
  }
});

test("isolation actions use the isolation invalidation contract", () => {
  for (const name of [
    "logDisinfection",
    "updateIsolationProtocol",
    "updateIsolationSetup",
    "deleteDisinfectionLog",
  ]) {
    assert.match(
      getFunctionSource(isolationSource, name),
      /updateClinicalTags\(\s*getIsolationMutationTags\([\s\S]*?\)\s*\);/
    );
  }
});
