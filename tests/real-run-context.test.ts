import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRealRunContext } from "./support/real-run-context";

test("createRealRunContext generates run ID from date", () => {
  const run = createRealRunContext({
    rootDir: "/tmp",
    now: new Date("2026-04-05T12:30:00.000Z"),
  });
  assert.match(run.runId, /^TEST-RUN-2026-04-05-\d{6}$/);
});

test("taggedText prefixes with run ID", () => {
  const run = createRealRunContext({
    rootDir: "/tmp",
    now: new Date("2026-04-05T12:30:00.000Z"),
  });
  assert.match(run.taggedText("General Patient"), /^TEST-RUN-2026-04-05-\d+ General Patient$/);
});

test("createRealRunContext tracks artifacts and writes paired reports", async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "ipd-real-run-"));
  const run = createRealRunContext({ rootDir, now: new Date("2026-04-05T12:30:00.000Z") });

  run.recordArtifact({
    kind: "patient",
    label: "general-test",
    id: "patient-1",
  });
  run.recordPhase("preflight", "passed", ["db ok", "drive ok"]);

  const output = await run.writeReports();

  const json = JSON.parse(await readFile(output.jsonPath, "utf8"));
  assert.equal(json.runId, run.runId);
  assert.equal(json.artifacts.length, 1);
  assert.equal(json.artifacts[0].id, "patient-1");
  assert.equal(json.phases.length, 1);
  assert.equal(json.phases[0].name, "preflight");
  assert.equal(json.phases[0].status, "passed");

  const markdown = await readFile(output.markdownPath, "utf8");
  assert.match(markdown, /# Real System Validation Report/);
  assert.match(markdown, /TEST-RUN-2026-04-05/);
  assert.match(markdown, /patient-1/);
  assert.match(markdown, /Purge Checklist/);
});
