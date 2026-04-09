import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const historyTabSource = readFileSync(
  new URL("../src/components/management/history-tab.tsx", import.meta.url),
  "utf8"
);
const managementPatientPageSource = readFileSync(
  new URL("../src/app/(management)/management/patients/[admissionId]/page.tsx", import.meta.url),
  "utf8"
);
const mediaGallerySource = readFileSync(
  new URL("../src/components/management/media-gallery.tsx", import.meta.url),
  "utf8"
);
const proofCarouselSource = readFileSync(
  new URL("../src/components/management/proof-carousel.tsx", import.meta.url),
  "utf8"
);
const proofLightboxSource = readFileSync(
  new URL("../src/components/management/proof-lightbox.tsx", import.meta.url),
  "utf8"
);
const todayTabSource = readFileSync(
  new URL("../src/components/management/today-tab.tsx", import.meta.url),
  "utf8"
);

test("management history tab no longer slices the activity feed to fifty rows", () => {
  assert.doesNotMatch(historyTabSource, /slice\(0,\s*50\)/);
  assert.match(historyTabSource, /buildManagementHistoryDaySections/);
});

test("management history tab receives proof attachments from the page loader", () => {
  assert.match(managementPatientPageSource, /loadPlan\.history\s*\|\|\s*loadPlan\.media/);
  assert.match(managementPatientPageSource, /<HistoryTab[\s\S]*proofAttachments=/);
});

test("management proof placeholders use explicit photo skipped copy", () => {
  for (const source of [
    mediaGallerySource,
    proofCarouselSource,
    proofLightboxSource,
    todayTabSource,
  ]) {
    assert.match(source, /Photo skipped/i);
  }
});
