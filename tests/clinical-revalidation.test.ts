import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  getAdmissionMutationTags,
  getBathMutationTags,
  getFeedingMutationTags,
  getMedicationMutationTags,
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
const admissionsSource = readFileSync(
  new URL("../src/actions/admissions.ts", import.meta.url),
  "utf8"
);

test("medication mutations invalidate the schedule meds cache", () => {
  assert.deepEqual(getMedicationMutationTags("adm-1"), ["schedule:meds"]);
});

test("feeding mutations invalidate the schedule feedings cache", () => {
  assert.deepEqual(getFeedingMutationTags("adm-1"), ["schedule:feedings"]);
});

test("bath mutations invalidate the schedule baths cache", () => {
  assert.deepEqual(getBathMutationTags("adm-1"), ["schedule:baths"]);
});

test("admission mutations invalidate all schedule caches", () => {
  assert.deepEqual(getAdmissionMutationTags("adm-1"), [
    "schedule:meds",
    "schedule:feedings",
    "schedule:baths",
  ]);
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
    "clinicalSetup",
    "transferWard",
    "updatePatient",
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
