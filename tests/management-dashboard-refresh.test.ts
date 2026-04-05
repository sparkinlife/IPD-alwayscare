import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const liveRefreshPath = new URL(
  "../src/components/management/live-dashboard-refresh.tsx",
  import.meta.url
);
const managementLayoutSource = readFileSync(
  new URL("../src/app/(management)/management/layout.tsx", import.meta.url),
  "utf8"
);

test("management layout wires in a live refresh helper", () => {
  assert.match(managementLayoutSource, /LiveDashboardRefresh/);
});

test("live refresh helper exists and refreshes on interval plus tab visibility", () => {
  assert.equal(existsSync(liveRefreshPath), true);

  const source = readFileSync(liveRefreshPath, "utf8");
  assert.match(source, /router\.refresh\(\)/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /setInterval/);
});
