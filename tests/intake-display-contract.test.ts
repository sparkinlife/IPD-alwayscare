import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const patientQueriesSource = readFileSync(
  new URL("../src/lib/patient-page-queries.ts", import.meta.url),
  "utf8"
);
const patientHeaderSource = readFileSync(
  new URL("../src/components/patient/patient-header.tsx", import.meta.url),
  "utf8"
);
const managementDashboardSource = readFileSync(
  new URL("../src/lib/management-dashboard-queries.ts", import.meta.url),
  "utf8"
);
const managementCardSource = readFileSync(
  new URL("../src/components/management/patient-card.tsx", import.meta.url),
  "utf8"
);
const managementPageSource = readFileSync(
  new URL("../src/app/(management)/management/page.tsx", import.meta.url),
  "utf8"
);
const managementShellSource = readFileSync(
  new URL("../src/lib/management-patient-page-queries.ts", import.meta.url),
  "utf8"
);
const managementDetailPageSource = readFileSync(
  new URL("../src/app/(management)/management/patients/[admissionId]/page.tsx", import.meta.url),
  "utf8"
);

test("patient shell queries include patient number, handling note, and viral risk", () => {
  assert.match(patientQueriesSource, /patientNumber:\s*true/);
  assert.match(patientQueriesSource, /handlingNote:\s*true/);
  assert.match(patientQueriesSource, /registrationMode:\s*true/);
  assert.match(patientQueriesSource, /registrationModeOther:\s*true/);
  assert.match(patientQueriesSource, /viralRisk:\s*true/);
});

test("patient header renders patient number and triage badges", () => {
  assert.match(patientHeaderSource, /patient\.patientNumber/);
  assert.match(patientHeaderSource, /handlingNote/);
  assert.match(patientHeaderSource, /viralRisk/);
});

test("management dashboard and detail views render patient numbers", () => {
  assert.match(managementDashboardSource, /patientNumber:/);
  assert.match(managementCardSource, /patient\.patientNumber/);
  assert.match(managementPageSource, /p\.patientNumber/);
  assert.match(managementShellSource, /patientNumber:\s*true/);
  assert.match(managementDetailPageSource, /shell\.patient\.patientNumber/);
});
