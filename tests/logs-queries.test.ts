import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const logsQueriesSource = readFileSync(
  new URL("../src/lib/logs-queries.ts", import.meta.url),
  "utf8"
);

test("logs query guards against deleted admissions before loading timeline rows", () => {
  assert.match(
    logsQueriesSource,
    /db\.admission\.findFirst\(\{[\s\S]*where:\s*\{\s*id:\s*admissionId,\s*deletedAt:\s*null\s*\}/
  );
});

test("logs query applies deterministic ordering to each timeline source", () => {
  for (const modelName of [
    "medicationAdministration",
    "vitalRecord",
    "feedingLog",
    "bathLog",
    "clinicalNote",
    "disinfectionLog",
    "fluidTherapy",
  ]) {
    assert.match(
      logsQueriesSource,
      new RegExp(
        String.raw`db\.${modelName}\.findMany\(\{[\s\S]*orderBy:`
      )
    );
  }

  assert.match(
    logsQueriesSource,
    /rateChanges:\s*\{[\s\S]*orderBy:\s*\[\{[\s\S]*changedAt:\s*"desc"/
  );
});
