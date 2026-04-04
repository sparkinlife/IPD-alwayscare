import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  type Notification,
  filterNotificationsForRole,
  sortNotificationsByPriority,
} from "../src/lib/notification-snapshot";

const compactNotifications: Array<
  Pick<Notification, "id" | "type" | "category">
> = [
  { id: "med-1", type: "urgent", category: "MEDS" },
  { id: "food-1", type: "due", category: "FOOD" },
  { id: "vitals-1", type: "critical", category: "VITALS" },
  { id: "setup-1", type: "info", category: "ADMISSION" },
];

const notificationsRouteSource = readFileSync(
  new URL("../src/app/api/notifications/route.ts", import.meta.url),
  "utf8"
);
const serviceWorkerSource = readFileSync(
  new URL("../src/app/sw.ts", import.meta.url),
  "utf8"
);

test("doctor sees urgent, critical, and setup notifications", () => {
  const filtered = filterNotificationsForRole(compactNotifications, "DOCTOR");
  assert.deepEqual(filtered.map((item) => item.id), ["med-1", "vitals-1", "setup-1"]);
});

test("paravet sees meds plus critical items only", () => {
  const filtered = filterNotificationsForRole(compactNotifications, "PARAVET");
  assert.deepEqual(filtered.map((item) => item.id), ["med-1", "vitals-1"]);
});

test("sortNotificationsByPriority keeps urgent before critical before due", () => {
  const sorted = sortNotificationsByPriority(compactNotifications);
  assert.deepEqual(sorted.map((item) => item.id), ["med-1", "vitals-1", "food-1", "setup-1"]);
});

test("notification route preserves the previous client snapshot on refresh failures", () => {
  assert.match(
    notificationsRouteSource,
    /return NextResponse\.json\(\s*\{\s*error:\s*"Failed to load notifications"\s*\},\s*\{\s*status:\s*500\s*\}\s*\);/
  );
});

test("service worker never serves cached notification API responses", () => {
  assert.match(
    serviceWorkerSource,
    /pathname === "\/api\/notifications"[\s\S]*handler:\s*new NetworkOnly\(\)/
  );
  assert.match(serviceWorkerSource, /const runtimeCaching = \[[\s\S]*\.\.\.defaultCache[\s\S]*\];/);
});
