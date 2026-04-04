import test from "node:test";
import assert from "node:assert/strict";
import {
  filterNotificationsForRole,
  sortNotificationsByPriority,
} from "../src/lib/notification-snapshot";

const notifications = [
  { id: "med-1", type: "urgent", category: "MEDS" },
  { id: "food-1", type: "due", category: "FOOD" },
  { id: "vitals-1", type: "critical", category: "VITALS" },
  { id: "setup-1", type: "info", category: "ADMISSION" },
];

test("doctor sees urgent, critical, and setup notifications", () => {
  const filtered = filterNotificationsForRole(notifications as any, "DOCTOR");
  assert.deepEqual(filtered.map((item) => item.id), ["med-1", "vitals-1", "setup-1"]);
});

test("paravet sees meds plus critical items only", () => {
  const filtered = filterNotificationsForRole(notifications as any, "PARAVET");
  assert.deepEqual(filtered.map((item) => item.id), ["med-1", "vitals-1"]);
});

test("sortNotificationsByPriority keeps urgent before critical before due", () => {
  const sorted = sortNotificationsByPriority(notifications as any);
  assert.deepEqual(sorted.map((item) => item.id), ["med-1", "vitals-1", "food-1", "setup-1"]);
});
