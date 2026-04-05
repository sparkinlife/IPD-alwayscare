import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  getAdmissionMutationTags,
  getBathMutationTags,
  getFeedingMutationTags,
  getIsolationMutationTags,
  getLabMutationTags,
  getMedicationMutationTags,
  getNoteMutationTags,
  getVitalsMutationTags,
  getFluidMutationTags,
} from "../src/lib/clinical-revalidation";
import * as clinicalRevalidation from "../src/lib/clinical-revalidation";

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
const fluidsSource = readFileSync(
  new URL("../src/actions/fluids.ts", import.meta.url),
  "utf8"
);
const labsSource = readFileSync(
  new URL("../src/actions/labs.ts", import.meta.url),
  "utf8"
);
const notesSource = readFileSync(
  new URL("../src/actions/notes.ts", import.meta.url),
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

const getAdmissionMutationTagsForAdmissions = (
  clinicalRevalidation as Record<string, unknown>
).getAdmissionMutationTagsForAdmissions as
  | undefined
  | ((admissionIds: readonly string[]) => string[]);

test("medication mutations invalidate the schedule meds cache", () => {
  assert.deepEqual(getMedicationMutationTags("adm-1"), [
    "schedule:meds",
    "patient:adm-1:meds",
    "patient:adm-1:logs",
    ...notificationTags,
  ]);
});

test("feeding mutations invalidate the schedule feedings cache", () => {
  assert.deepEqual(getFeedingMutationTags("adm-1"), [
    "schedule:feedings",
    "patient:adm-1:food",
    "patient:adm-1:logs",
    ...notificationTags,
  ]);
});

test("bath mutations invalidate the schedule baths cache", () => {
  assert.deepEqual(getBathMutationTags("adm-1"), [
    "schedule:baths",
    "patient:adm-1:bath",
    "patient:adm-1:logs",
    ...notificationTags,
  ]);
});

test("admission mutations invalidate all schedule caches", () => {
  assert.deepEqual(getAdmissionMutationTags("adm-1").slice(0, 12), [
    "schedule:meds",
    "schedule:feedings",
    "schedule:baths",
    "patient:adm-1:shell",
    "patient:adm-1:vitals",
    "patient:adm-1:meds",
    "patient:adm-1:food",
    "patient:adm-1:notes",
    "patient:adm-1:labs",
    "patient:adm-1:bath",
    "patient:adm-1:isolation",
    "patient:adm-1:logs",
  ]);
  assert.deepEqual(getAdmissionMutationTags("adm-1").slice(12), [
    ...notificationTags,
  ]);
});

test("multi-admission invalidation covers every affected patient page cache", () => {
  assert.equal(typeof getAdmissionMutationTagsForAdmissions, "function");
  assert.deepEqual(getAdmissionMutationTagsForAdmissions?.(["adm-1", "adm-2"]), [
    "schedule:meds",
    "schedule:feedings",
    "schedule:baths",
    "patient:adm-1:shell",
    "patient:adm-1:vitals",
    "patient:adm-1:meds",
    "patient:adm-1:food",
    "patient:adm-1:notes",
    "patient:adm-1:labs",
    "patient:adm-1:bath",
    "patient:adm-1:isolation",
    "patient:adm-1:logs",
    "patient:adm-2:shell",
    "patient:adm-2:vitals",
    "patient:adm-2:meds",
    "patient:adm-2:food",
    "patient:adm-2:notes",
    "patient:adm-2:labs",
    "patient:adm-2:bath",
    "patient:adm-2:isolation",
    "patient:adm-2:logs",
    ...notificationTags,
  ]);
});

test("vitals mutations invalidate all notification caches", () => {
  assert.deepEqual(getVitalsMutationTags("adm-1"), [
    "patient:adm-1:vitals",
    "patient:adm-1:logs",
    ...notificationTags,
  ]);
});

test("isolation mutations invalidate all notification caches", () => {
  assert.deepEqual(getIsolationMutationTags("adm-1"), [
    "patient:adm-1:isolation",
    "patient:adm-1:logs",
    ...notificationTags,
  ]);
});

test("lab mutations invalidate the lab and isolation tabs", () => {
  assert.deepEqual(getLabMutationTags("adm-1"), [
    "patient:adm-1:labs",
    "patient:adm-1:isolation",
  ]);
});

test("note mutations invalidate notes and logs", () => {
  assert.deepEqual(getNoteMutationTags("adm-1"), [
    "patient:adm-1:notes",
    "patient:adm-1:logs",
  ]);
});

test("fluid mutations invalidate meds, notes, and logs", () => {
  assert.deepEqual(getFluidMutationTags("adm-1"), [
    "patient:adm-1:meds",
    "patient:adm-1:notes",
    "patient:adm-1:logs",
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
    "registerPatient",
    "cancelRegistration",
    "editRegisteredPatient",
    "clinicalSetup",
    "updateCondition",
    "transferWard",
    "updateAdmission",
    "dischargePatient",
  ]) {
    assert.match(
      getFunctionSource(admissionsSource, name),
      /updateClinicalTags\(\s*getAdmissionMutationTags\([\s\S]*?\)\s*\);/
    );
  }
});

test("patient-wide admission actions invalidate every admission cache for that patient", () => {
  for (const name of ["updatePatient", "archivePatient", "restorePatient"]) {
    assert.match(
      getFunctionSource(admissionsSource, name),
      /getAdmissionMutationTagsForAdmissions\([\s\S]*?\)/
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

test("fluid actions use the fluid invalidation contract", () => {
  for (const name of [
    "startFluidTherapy",
    "changeFluidRate",
    "updateFluidTherapy",
    "stopFluids",
    "restartFluidTherapy",
    "deleteFluidTherapy",
  ]) {
    assert.match(
      getFunctionSource(fluidsSource, name),
      /updateClinicalTags\(\s*getFluidMutationTags\([\s\S]*?\)\s*\);/
    );
  }
});

test("lab actions use the lab invalidation contract", () => {
  for (const name of ["addLabResult", "updateLabResult", "deleteLabResult"]) {
    assert.match(
      getFunctionSource(labsSource, name),
      /updateClinicalTags\(\s*getLabMutationTags\([\s\S]*?\)\s*\);/
    );
  }
});

test("note actions use the note invalidation contract", () => {
  for (const name of ["addNote", "updateNote", "deleteNote"]) {
    assert.match(
      getFunctionSource(notesSource, name),
      /updateClinicalTags\(\s*getNoteMutationTags\([\s\S]*?\)\s*\);/
    );
  }
});
