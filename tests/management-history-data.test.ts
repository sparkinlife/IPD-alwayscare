import test from "node:test";
import assert from "node:assert/strict";

import { buildManagementHistoryDaySections } from "../src/lib/management-history-data";

test("management history groups events into today, yesterday, and dated sections", () => {
  const sections = buildManagementHistoryDaySections(
    {
      labs: [
        {
          id: "lab-today",
          testName: "CBC",
          testType: "BLOOD",
          result: "Hb stable",
          isAbnormal: false,
          resultDate: new Date("2026-04-09T11:15:00+05:30"),
          notes: "Repeat in 48h",
        },
      ],
      logEntries: [
        {
          time: new Date("2026-04-09T09:45:00+05:30"),
          icon: "💊",
          description: "Ceftriaxone 500 mg IV — Given",
          by: "Ravi",
        },
        {
          time: new Date("2026-04-08T20:10:00+05:30"),
          icon: "🍽",
          description: "10:00 Veg kibble: Eaten",
          by: "Priya",
        },
        {
          time: new Date("2026-04-07T08:30:00+05:30"),
          icon: "📝",
          description: "[Doctor Round] Appetite improved",
          by: "Dr Shah",
          roleColor: "text-violet-600",
        },
      ],
    },
    new Date("2026-04-09T13:00:00+05:30")
  );

  assert.deepEqual(
    sections.map((section) => section.label),
    ["Today", "Yesterday", "07 Apr 2026"]
  );

  assert.equal(sections[0].items[0].kindLabel, "Lab");
  assert.equal(sections[0].items[1].kindLabel, "Medication");
  assert.equal(sections[1].items[0].kindLabel, "Feeding");
  assert.equal(sections[2].items[0].kindLabel, "Note");
});

test("management history keeps all events instead of truncating after fifty rows", () => {
  const logEntries = Array.from({ length: 55 }, (_, index) => ({
    time: new Date(`2026-04-06T${String(index % 24).padStart(2, "0")}:00:00+05:30`),
    icon: "💊",
    description: `Dose ${index + 1}`,
    by: "Ravi",
  }));

  const sections = buildManagementHistoryDaySections(
    {
      labs: [],
      logEntries,
    },
    new Date("2026-04-09T13:00:00+05:30")
  );

  assert.equal(sections.length, 1);
  assert.equal(sections[0].items.length, 55);
  assert.ok(sections[0].items.some((item) => item.title === "Dose 1"));
  assert.ok(sections[0].items.some((item) => item.title === "Dose 55"));
});

test("management history folds proof media into the same dated sections", () => {
  const sections = buildManagementHistoryDaySections(
    {
      labs: [],
      logEntries: [],
      proofAttachments: [
        {
          fileId: "proof-1",
          fileName: "ceftriaxone-after.jpg",
          category: "MEDS",
          uploadedBy: "Ravi",
          createdAt: new Date("2026-04-09T12:20:00+05:30"),
          isSkipped: false,
          skipReason: null,
        },
        {
          fileId: "SKIPPED",
          fileName: "SKIPPED",
          category: "FOOD",
          uploadedBy: "Priya",
          createdAt: new Date("2026-04-08T19:10:00+05:30"),
          isSkipped: true,
          skipReason: "Patient was sleeping",
        },
      ],
    },
    new Date("2026-04-09T13:00:00+05:30")
  );

  assert.deepEqual(
    sections.map((section) => section.label),
    ["Today", "Yesterday"]
  );

  assert.equal(sections[0].items[0].kindLabel, "Medication Proof");
  assert.equal(sections[0].items[0].title, "Photo uploaded");
  assert.equal(sections[0].items[0].description, "ceftriaxone-after.jpg");
  assert.equal(sections[0].items[0].media?.fileId, "proof-1");
  assert.equal(sections[0].items[0].media?.isSkipped, false);

  assert.equal(sections[1].items[0].kindLabel, "Feeding Proof");
  assert.equal(sections[1].items[0].title, "Photo skipped");
  assert.equal(sections[1].items[0].description, "Patient was sleeping");
  assert.equal(sections[1].items[0].media?.isSkipped, true);
});
