import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const patientQueriesSource = readFileSync(
  new URL("../src/lib/patient-page-queries.ts", import.meta.url),
  "utf8"
);

const patientPageSource = readFileSync(
  new URL("../src/app/(app)/patients/[admissionId]/page.tsx", import.meta.url),
  "utf8"
);

test("patient logs query uses cache components with a patient logs tag", () => {
  assert.match(
    patientQueriesSource,
    /export async function getPatientLogsData\(\s*admissionId: string\s*\)[\s\S]*?"use cache";/
  );
  assert.match(
    patientQueriesSource,
    /cacheTag\(patientTabTag\(admissionId,\s*"logs"\)\);/
  );
});

test("patient logs query delegates to the unfiltered timeline loader", () => {
  assert.match(
    patientQueriesSource,
    /return getLogsTimelineEntries\(admissionId\);/
  );
  assert.doesNotMatch(
    patientQueriesSource,
    /getLogsTimelineEntries\(admissionId,\s*\{/
  );
});

test("patient detail page loads logs without today or seven-day filters", () => {
  assert.match(
    patientPageSource,
    /loadPlan\.logs\s*\?\s*getPatientLogsData\(admissionId\)/
  );
  assert.doesNotMatch(
    patientPageSource,
    /getPatientLogsData\(admissionId,\s*today,\s*sevenDaysAgo\)/
  );
});
