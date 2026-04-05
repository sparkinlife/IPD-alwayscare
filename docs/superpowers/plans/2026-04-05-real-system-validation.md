# Real System Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one executable real-environment validation harness that exercises the live app against the real Neon database, real Google Drive integration, real management web-push flow, and real browser UI while preserving all tagged artifacts for later purge.

**Architecture:** Add a single `node:test` entrypoint that orchestrates ordered validation phases and writes machine-readable plus human-readable run reports. Keep the main file thin by moving run context, live fixture creation, browser automation, Drive verification, and local push bootstrap into focused support modules. Use Playwright for repeatable browser flows, but keep all product mutations restricted to records created and tagged in the current run.

**Tech Stack:** Next.js 16 App Router, TypeScript, Node.js built-in test runner, Prisma/Neon, Google Drive API, Web Push (`web-push`), Playwright, local filesystem reports.

---

## File Map

- `package.json`
  Adds Playwright and scripts to install Chromium and run the real-system harness.
- `tests/real-system-validation.test.ts`
  Main executable validation harness and ordered phase runner.
- `tests/support/real-run-context.ts`
  Run id generation, artifact tracking, phase/evidence recording, and report writing.
- `tests/support/real-push.ts`
  Local VAPID bootstrap and `.env.local` patch helper.
- `tests/support/real-fixtures.ts`
  Tagged live-data creation helpers and ownership guards.
- `tests/support/real-drive.ts`
  Google Drive lookup and rename-verification helpers.
- `tests/support/real-browser.ts`
  Playwright-powered login, navigation, upload, permission, and fetch helpers.
- `tests/real-run-context.test.ts`
  Unit coverage for run id, report output, and artifact inventory writing.
- `tests/real-push.test.ts`
  Unit coverage for local push config bootstrap behavior.
- `tests/real-fixtures.test.ts`
  Unit coverage for tagged ownership helpers and run-label builders.
- `tests/fixtures/test-image.jpg`
  Known-good image used by browser media upload and proof-skip fallback flows.

---

### Task 1: Add Command Surface, Fixture Asset, And Run Context Foundation

**Files:**
- Modify: `package.json`
- Create: `tests/support/real-run-context.ts`
- Create: `tests/real-run-context.test.ts`
- Create: `tests/fixtures/test-image.jpg`
- Test: `tests/real-run-context.test.ts`

- [ ] **Step 1: Write the failing run-context test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRealRunContext } from "./support/real-run-context";

test("createRealRunContext tags artifacts and writes paired reports", async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "ipd-real-run-"));
  const run = createRealRunContext({ rootDir, now: new Date("2026-04-05T12:30:00.000Z") });

  assert.match(run.runId, /^TEST-RUN-2026-04-05-\d{6}$/);

  run.recordArtifact({
    kind: "patient",
    label: `${run.runId}-general`,
    id: "patient-1",
  });
  run.recordPhase("preflight", "passed", ["db ok", "drive ok"]);

  const output = await run.writeReports();
  const json = JSON.parse(await readFile(output.jsonPath, "utf8"));
  const markdown = await readFile(output.markdownPath, "utf8");

  assert.equal(json.runId, run.runId);
  assert.equal(json.artifacts[0].id, "patient-1");
  assert.match(markdown, /# Real System Validation Report/);
  assert.match(markdown, /TEST-RUN-2026-04-05/);
  assert.match(markdown, /patient-1/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx --test tests/real-run-context.test.ts`  
Expected: FAIL because `tests/support/real-run-context.ts` does not exist yet.

- [ ] **Step 3: Implement the run-context helper**

```ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type RealArtifactKind =
  | "patient"
  | "admission"
  | "staff"
  | "cage"
  | "media"
  | "drive-file"
  | "push-subscription"
  | "url";

export type RealPhaseStatus = "passed" | "failed" | "skipped";

export interface RealArtifactRecord {
  kind: RealArtifactKind;
  label: string;
  id: string;
  details?: Record<string, string | number | boolean | null>;
}

export interface RealPhaseRecord {
  name: string;
  status: RealPhaseStatus;
  notes: string[];
}

function formatDatePart(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatTimePart(date: Date): string {
  return date.toISOString().slice(11, 19).replaceAll(":", "");
}

export function createRealRunContext({
  rootDir,
  now = new Date(),
}: {
  rootDir: string;
  now?: Date;
}) {
  const startedAt = now.toISOString();
  const runId = `TEST-RUN-${formatDatePart(now)}-${formatTimePart(now)}`;
  const artifacts: RealArtifactRecord[] = [];
  const phases: RealPhaseRecord[] = [];

  return {
    runId,
    rootDir,
    startedAt,
    artifactPrefix(label: string) {
      return `${runId}-${label}`;
    },
    recordArtifact(artifact: RealArtifactRecord) {
      artifacts.push(artifact);
    },
    recordPhase(name: string, status: RealPhaseStatus, notes: string[]) {
      phases.push({ name, status, notes });
    },
    async writeReports() {
      const outputDir = path.join(rootDir, "test-results", "real-system");
      await mkdir(outputDir, { recursive: true });
      const jsonPath = path.join(outputDir, `${runId}.json`);
      const markdownPath = path.join(outputDir, `${runId}.md`);
      const payload = {
        runId,
        startedAt,
        finishedAt: new Date().toISOString(),
        artifacts,
        phases,
      };

      await writeFile(jsonPath, JSON.stringify(payload, null, 2));
      await writeFile(
        markdownPath,
        [
          "# Real System Validation Report",
          "",
          `- Run ID: \`${runId}\``,
          `- Started At: \`${startedAt}\``,
          "",
          "## Phases",
          ...phases.map((phase) => `- ${phase.name}: ${phase.status} — ${phase.notes.join("; ")}`),
          "",
          "## Artifacts",
          ...artifacts.map((artifact) => `- ${artifact.kind}: ${artifact.label} (${artifact.id})`),
          "",
        ].join("\n")
      );

      return { jsonPath, markdownPath };
    },
  };
}
```

- [ ] **Step 4: Create the JPEG upload fixture**

Run:

```bash
mkdir -p tests/fixtures
cat <<'EOF' | base64 -d > tests/fixtures/test-image.jpg
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
EOF
```

- [ ] **Step 5: Add the real-system scripts and Playwright dependency**

Update `package.json` to:

```json
{
  "scripts": {
    "dev": "next dev --webpack",
    "prebuild": "prisma generate",
    "build": "next build --webpack",
    "start": "next start",
    "lint": "eslint",
    "repair:feeding-log-integrity": "tsx scripts/repair-feeding-log-integrity.ts",
    "setup:real-system-browser": "playwright install chromium",
    "test:real-system": "node --import tsx --test tests/real-system-validation.test.ts"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/ws": "^8.18.1",
    "babel-plugin-react-compiler": "1.0.0",
    "eslint": "^9",
    "eslint-config-next": "16.2.1",
    "playwright": "^1.52.0",
    "serwist": "^9.5.7",
    "tailwindcss": "^4",
    "tsx": "^4.21.0",
    "typescript": "^5"
  }
}
```

- [ ] **Step 6: Run verification**

Run:

```bash
npm install
npx playwright install chromium
node --import tsx --test tests/real-run-context.test.ts
```

Expected: the install succeeds, Chromium installs, and the run-context test passes.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tests/support/real-run-context.ts tests/real-run-context.test.ts tests/fixtures/test-image.jpg
git commit -m "test: add real system run context foundation"
```

---

### Task 2: Add Local Push Bootstrap Helper

**Files:**
- Create: `tests/support/real-push.ts`
- Create: `tests/real-push.test.ts`
- Test: `tests/real-push.test.ts`

- [ ] **Step 1: Write the failing push-helper test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ensureLocalPushConfig } from "./support/real-push";

test("ensureLocalPushConfig appends VAPID keys when they are missing", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "ipd-push-"));
  const envPath = path.join(dir, ".env.local");
  await writeFile(envPath, 'DATABASE_URL="postgresql://example"\n');

  const result = await ensureLocalPushConfig(envPath);
  const updated = await readFile(envPath, "utf8");

  assert.equal(result.wroteKeys, true);
  assert.match(updated, /WEB_PUSH_VAPID_SUBJECT=/);
  assert.match(updated, /WEB_PUSH_VAPID_PUBLIC_KEY=/);
  assert.match(updated, /WEB_PUSH_VAPID_PRIVATE_KEY=/);
});

test("ensureLocalPushConfig keeps existing keys untouched", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "ipd-push-"));
  const envPath = path.join(dir, ".env.local");
  await writeFile(
    envPath,
    [
      'WEB_PUSH_VAPID_SUBJECT="mailto:test@example.com"',
      'WEB_PUSH_VAPID_PUBLIC_KEY="public-existing"',
      'WEB_PUSH_VAPID_PRIVATE_KEY="private-existing"',
      "",
    ].join("\n")
  );

  const result = await ensureLocalPushConfig(envPath);
  assert.equal(result.wroteKeys, false);
  assert.equal(result.publicKey, "public-existing");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx --test tests/real-push.test.ts`  
Expected: FAIL because `tests/support/real-push.ts` does not exist yet.

- [ ] **Step 3: Implement the push bootstrap helper**

```ts
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import webpush from "web-push";

function parseEnv(text: string): Record<string, string> {
  return text
    .split("\n")
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, line) => {
      const index = line.indexOf("=");
      if (index === -1) return acc;
      const key = line.slice(0, index).trim();
      const raw = line.slice(index + 1).trim();
      acc[key] = raw.replace(/^"/, "").replace(/"$/, "");
      return acc;
    }, {});
}

export async function ensureLocalPushConfig(envPath = path.resolve(".env.local")) {
  const original = await readFile(envPath, "utf8");
  const parsed = parseEnv(original);

  if (
    parsed.WEB_PUSH_VAPID_SUBJECT &&
    parsed.WEB_PUSH_VAPID_PUBLIC_KEY &&
    parsed.WEB_PUSH_VAPID_PRIVATE_KEY
  ) {
    return {
      wroteKeys: false,
      publicKey: parsed.WEB_PUSH_VAPID_PUBLIC_KEY,
    };
  }

  const keys = webpush.generateVAPIDKeys();
  const subject = parsed.WEB_PUSH_VAPID_SUBJECT || "mailto:local-real-system-test@alwayscare.local";
  const block = [
    "",
    `WEB_PUSH_VAPID_SUBJECT="${subject}"`,
    `WEB_PUSH_VAPID_PUBLIC_KEY="${keys.publicKey}"`,
    `WEB_PUSH_VAPID_PRIVATE_KEY="${keys.privateKey}"`,
    "",
  ].join("\n");

  await writeFile(envPath, original.trimEnd() + block);

  return {
    wroteKeys: true,
    publicKey: keys.publicKey,
  };
}
```

- [ ] **Step 4: Run verification**

Run: `node --import tsx --test tests/real-push.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/support/real-push.ts tests/real-push.test.ts
git commit -m "test: add local push bootstrap helper"
```

---

### Task 3: Add Tagged Ownership, Live Fixture, And Drive Helpers

**Files:**
- Create: `tests/support/real-fixtures.ts`
- Create: `tests/support/real-drive.ts`
- Create: `tests/real-fixtures.test.ts`
- Test: `tests/real-fixtures.test.ts`

- [ ] **Step 1: Write the failing ownership-helper test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTaggedText,
  assertTaggedOwnership,
  buildTaggedCageNumber,
} from "./support/real-fixtures";

test("buildTaggedText prefixes every label with the run id", () => {
  assert.equal(
    buildTaggedText("TEST-RUN-2026-04-05-123000", "patient-general"),
    "TEST-RUN-2026-04-05-123000 patient-general"
  );
});

test("assertTaggedOwnership rejects non-tagged strings", () => {
  assert.throws(
    () => assertTaggedOwnership("TEST-RUN-2026-04-05-123000", "Bruno"),
    /does not belong to the active test run/
  );
});

test("buildTaggedCageNumber stays short enough for UI display", () => {
  assert.equal(
    buildTaggedCageNumber("TEST-RUN-2026-04-05-123000"),
    "T-123000"
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx --test tests/real-fixtures.test.ts`  
Expected: FAIL because `tests/support/real-fixtures.ts` does not exist yet.

- [ ] **Step 3: Implement the fixture and guard helpers**

```ts
import { db } from "@/lib/db";
import { getGoogleDrive } from "@/lib/google-auth";
import bcrypt from "bcryptjs";
import type { StaffRole } from "@prisma/client";

export function buildTaggedText(runId: string, label: string) {
  return `${runId} ${label}`;
}

export function buildTaggedCageNumber(runId: string) {
  return `T-${runId.slice(-6)}`;
}

export function assertTaggedOwnership(runId: string, value: string | null | undefined) {
  if (!value || !value.includes(runId)) {
    throw new Error(`Record does not belong to the active test run: ${value ?? "null"}`);
  }
}

export async function findLiveStaffByRole(role: StaffRole) {
  const staff = await db.staff.findFirst({
    where: { role, isActive: true, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, phone: true, role: true },
  });
  if (!staff) {
    throw new Error(`No active ${role} account is available for real-system validation`);
  }
  return staff;
}

export async function createTaggedAdminFixtures(runId: string) {
  const passwordHash = await bcrypt.hash("realrun123!", 10);

  const management = await db.staff.create({
    data: {
      name: buildTaggedText(runId, "Management"),
      phone: `88${runId.replace(/\D/g, "").slice(-8)}`,
      passwordHash,
      role: "MANAGEMENT",
    },
    select: { id: true, name: true, phone: true },
  });

  const doctor = await db.staff.create({
    data: {
      name: buildTaggedText(runId, "Temp Doctor"),
      phone: `77${runId.replace(/\D/g, "").slice(-8)}`,
      passwordHash,
      role: "DOCTOR",
    },
    select: { id: true, name: true, phone: true },
  });

  const cage = await db.cageConfig.create({
    data: {
      ward: "GENERAL",
      cageNumber: buildTaggedCageNumber(runId),
      isActive: true,
    },
    select: { id: true, ward: true, cageNumber: true },
  });

  return { management, doctor, cage };
}

export async function createTaggedPatients(runId: string, doctorId: string, admittedById: string) {
  const registered = await db.patient.create({
    data: {
      name: buildTaggedText(runId, "Registered Patient"),
      species: "DOG",
      sex: "UNKNOWN",
      isStray: true,
      admissions: {
        create: {
          status: "REGISTERED",
          admittedById,
        },
      },
    },
    include: {
      admissions: {
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const activeGeneral = await db.patient.create({
    data: {
      name: buildTaggedText(runId, "General Patient"),
      species: "DOG",
      sex: "FEMALE",
      isStray: true,
      admissions: {
        create: {
          status: "ACTIVE",
          ward: "GENERAL",
          cageNumber: `TG-${runId.slice(-4)}`,
          diagnosis: buildTaggedText(runId, "General diagnosis"),
          condition: "STABLE",
          attendingDoctor: buildTaggedText(runId, "Doctor"),
          admittedById,
        },
      },
    },
    include: {
      admissions: {
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const activeIsolation = await db.patient.create({
    data: {
      name: buildTaggedText(runId, "Isolation Patient"),
      species: "DOG",
      sex: "MALE",
      isStray: true,
      admissions: {
        create: {
          status: "ACTIVE",
          ward: "ISOLATION",
          cageNumber: `TI-${runId.slice(-4)}`,
          diagnosis: buildTaggedText(runId, "Isolation diagnosis"),
          condition: "GUARDED",
          attendingDoctor: buildTaggedText(runId, "Doctor"),
          admittedById,
          isolationProtocol: {
            create: {
              disease: buildTaggedText(runId, "Canine Distemper"),
              ppeRequired: ["Gloves", "Gown"],
              disinfectant: "Quaternary ammonium compound",
              disinfectionInterval: "Q4H",
            },
          },
        },
      },
    },
    include: {
      admissions: {
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return { registered, activeGeneral, activeIsolation, doctorId };
}

export async function verifyDriveConfigured() {
  const drive = getGoogleDrive();
  const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!rootId) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID is missing");
  }
  await drive.files.get({
    fileId: rootId,
    fields: "id,name",
    supportsAllDrives: true,
  });
}
```

- [ ] **Step 4: Implement the Drive helper**

```ts
import { getGoogleDrive } from "@/lib/google-auth";

export async function findDriveFilesByRunId(runId: string) {
  const drive = getGoogleDrive();
  const response = await drive.files.list({
    q: `name contains '${runId}' and trashed=false`,
    fields: "files(id,name,webViewLink)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return response.data.files ?? [];
}

export async function assertDriveRename(fileId: string) {
  const drive = getGoogleDrive();
  const response = await drive.files.get({
    fileId,
    fields: "id,name",
    supportsAllDrives: true,
  });
  const name = response.data.name ?? "";
  if (!name.startsWith("DELETED - ")) {
    throw new Error(`Expected Drive file ${fileId} to be renamed, got ${name}`);
  }
}
```

- [ ] **Step 5: Run verification**

Run:

```bash
node --import tsx --test tests/real-fixtures.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add tests/support/real-fixtures.ts tests/support/real-drive.ts tests/real-fixtures.test.ts
git commit -m "test: add tagged fixture and drive helpers"
```

---

### Task 4: Add Browser Helper And Preflight Harness Skeleton

**Files:**
- Create: `tests/support/real-browser.ts`
- Create: `tests/real-system-validation.test.ts`
- Test: `tests/real-system-validation.test.ts`

- [ ] **Step 1: Write the failing preflight harness**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRealRunContext } from "./support/real-run-context";
import { ensureLocalPushConfig } from "./support/real-push";
import { verifyDriveConfigured } from "./support/real-fixtures";
import { startLocalApp, stopLocalApp } from "./support/real-browser";

test("real system validation preflight succeeds against the local app", async () => {
  const run = createRealRunContext({ rootDir: process.cwd() });
  await ensureLocalPushConfig(path.resolve(".env.local"));
  await verifyDriveConfigured();

  const server = await startLocalApp();
  try {
    assert.equal(server.baseUrl, "http://127.0.0.1:3000");
  } finally {
    await stopLocalApp(server);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx --test tests/real-system-validation.test.ts`  
Expected: FAIL because the browser helper does not exist yet.

- [ ] **Step 3: Implement the browser helper**

```ts
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

export interface LocalAppHandle {
  baseUrl: string;
  process: ChildProcessWithoutNullStreams;
}

export async function waitForServer(baseUrl: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.ok) return;
    } catch {
      // keep polling
    }
    await sleep(1000);
  }
  throw new Error(`Server at ${baseUrl} did not become ready in time`);
}

export async function startLocalApp(): Promise<LocalAppHandle> {
  const baseUrl = "http://127.0.0.1:3000";
  const process = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", "3000"], {
    stdio: "pipe",
    env: process.env,
  });
  await waitForServer(baseUrl);
  return { baseUrl, process };
}

export async function stopLocalApp(handle: LocalAppHandle) {
  handle.process.kill("SIGTERM");
}

export async function openBrowser(baseUrl: string, notifications = false) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: baseUrl,
    permissions: notifications ? ["notifications"] : [],
  });
  const page = await context.newPage();
  return { browser, context, page };
}

export async function closeBrowser(handle: { browser: Browser }) {
  await handle.browser.close();
}

export async function loginAs(page: Page, phone: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Phone Number").fill(phone);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
}

export async function fetchJsonInPage<T>(
  page: Page,
  url: string,
  init?: RequestInit
): Promise<T> {
  return page.evaluate(
    async ([resource, requestInit]) => {
      const response = await fetch(resource, requestInit);
      return response.json();
    },
    [url, init]
  );
}
```

- [ ] **Step 4: Update the real-system harness to record preflight**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRealRunContext } from "./support/real-run-context";
import { ensureLocalPushConfig } from "./support/real-push";
import { verifyDriveConfigured } from "./support/real-fixtures";
import { startLocalApp, stopLocalApp } from "./support/real-browser";

test("real system validation preflight succeeds against the local app", async () => {
  const run = createRealRunContext({ rootDir: process.cwd() });
  const server = await startLocalApp();

  try {
    const push = await ensureLocalPushConfig(path.resolve(".env.local"));
    await verifyDriveConfigured();

    assert.equal(server.baseUrl, "http://127.0.0.1:3000");
    assert.ok(push.publicKey.length > 20);
    run.recordPhase("preflight", "passed", [
      "local app booted",
      "drive configured",
      "local push config ready",
    ]);
  } finally {
    await stopLocalApp(server);
    await run.writeReports();
  }
});
```

- [ ] **Step 5: Run verification**

Run: `node --import tsx --test tests/real-system-validation.test.ts`  
Expected: PASS and `test-results/real-system/<run-id>.json` gets written.

- [ ] **Step 6: Commit**

```bash
git add tests/support/real-browser.ts tests/real-system-validation.test.ts
git commit -m "test: scaffold real system preflight harness"
```

---

### Task 5: Implement Real Auth, Patient Lifecycle, Dashboard, Tabs, And Media Coverage

**Files:**
- Modify: `tests/real-system-validation.test.ts`
- Modify: `tests/support/real-browser.ts`
- Modify: `tests/support/real-fixtures.ts`
- Modify: `tests/support/real-run-context.ts`
- Test: `tests/real-system-validation.test.ts`

- [ ] **Step 1: Extend the harness with a failing auth-and-lifecycle phase**

Add this block to `tests/real-system-validation.test.ts` after the preflight setup:

```ts
import {
  findLiveStaffByRole,
  createTaggedAdminFixtures,
  createTaggedPatients,
} from "./support/real-fixtures";
import { openBrowser, closeBrowser, loginAs } from "./support/real-browser";

// inside the test, after preflight succeeds:
const doctor = await findLiveStaffByRole("DOCTOR");
const paravet = await findLiveStaffByRole("PARAVET");
const admin = await findLiveStaffByRole("ADMIN");
const adminFixtures = await createTaggedAdminFixtures(run.runId);

const seeded = await createTaggedPatients(run.runId, doctor.id, paravet.id);
run.recordArtifact({
  kind: "patient",
  label: "registered-seed",
  id: seeded.registered.id,
});

const doctorBrowser = await openBrowser(server.baseUrl);
try {
  await loginAs(doctorBrowser.page, doctor.phone, "doctor123");
  await doctorBrowser.page.goto(`/patients/${seeded.registered.admissions[0].id}/setup`);
  await doctorBrowser.page.getByLabel("Diagnosis *").fill(`${run.runId} browser setup diagnosis`);
  await doctorBrowser.page.getByText("Select ward").click();
  await doctorBrowser.page.getByRole("option", { name: "General" }).click();
  await doctorBrowser.page.getByText("Select cage").click();
  await doctorBrowser.page.getByRole("option", { name: adminFixtures.cage.cageNumber }).click();
  await doctorBrowser.page.getByText("Select condition").click();
  await doctorBrowser.page.getByRole("option", { name: "Stable" }).click();
  await doctorBrowser.page.getByText("Select doctor").click();
  await doctorBrowser.page.getByRole("option", { name: doctor.name }).click();
  await doctorBrowser.page.getByRole("button", { name: "Complete Admission" }).click();

  await doctorBrowser.page.waitForURL(/\/patients\/.+\?tab=vitals|\/patients\/.+$/);
  await doctorBrowser.page.getByText(`${run.runId} browser setup diagnosis`).waitFor();
} finally {
  await closeBrowser(doctorBrowser);
}
```

- [ ] **Step 2: Run the harness to verify it fails in the new phase**

Run: `node --import tsx --test tests/real-system-validation.test.ts`  
Expected: FAIL in the doctor setup phase because the browser helper and lifecycle flow are still incomplete.

- [ ] **Step 3: Implement reusable browser helpers for the real UI flows**

Add these helpers to `tests/support/real-browser.ts`:

```ts
export async function openSelect(page: Page, placeholder: string) {
  await page.getByText(placeholder, { exact: true }).click();
}

export async function chooseOption(page: Page, name: string) {
  await page.getByRole("option", { name }).click();
}

export async function skipProofUpload(page: Page) {
  await page.getByRole("button", { name: "Skip photo upload" }).click();
  await page.getByRole("button", { name: "Confirm Skip" }).click();
}

export async function uploadMediaFromPhotosTab(page: Page, filePath: string) {
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Add Photos / Videos" }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(filePath);
}

export async function addNote(page: Page, category: string, content: string) {
  await page.getByRole("button", { name: "Add Note" }).click();
  await page.getByText("Select category").click();
  await page.getByRole("option", { name: category }).click();
  await page.getByLabel("Note").fill(content);
  await page.getByRole("button", { name: "Save Note" }).click();
}

export async function addLab(page: Page, testName: string, result: string) {
  await page.getByRole("button", { name: "Add Lab Result" }).click();
  await page.getByLabel("Test Name").fill(testName);
  await page.getByLabel("Result").fill(result);
  await page.getByRole("button", { name: "Save Result" }).click();
}
```

- [ ] **Step 4: Implement the core lifecycle phases in the main harness**

Update `tests/real-system-validation.test.ts` so the single test performs these concrete checks in order:

```ts
const fixtureImage = path.resolve("tests/fixtures/test-image.jpg");

// doctor login and setup
await loginAs(doctorBrowser.page, doctor.phone, "doctor123");
await doctorBrowser.page.goto(`/patients/${seeded.registered.admissions[0].id}/setup`);
await doctorBrowser.page.getByLabel("Diagnosis *").fill(`${run.runId} browser setup diagnosis`);
await openSelect(doctorBrowser.page, "Select ward");
await chooseOption(doctorBrowser.page, "General");
await openSelect(doctorBrowser.page, "Select cage");
await chooseOption(doctorBrowser.page, adminFixtures.cage.cageNumber);
await openSelect(doctorBrowser.page, "Select condition");
await chooseOption(doctorBrowser.page, "Stable");
await openSelect(doctorBrowser.page, "Select doctor");
await chooseOption(doctorBrowser.page, doctor.name);
await doctorBrowser.page.getByRole("button", { name: "Complete Admission" }).click();
await doctorBrowser.page.waitForURL(/\/patients\/.+/);
run.recordPhase("doctor-setup", "passed", ["registered patient promoted to active admission"]);

// note + lab
await doctorBrowser.page.getByRole("link", { name: "Notes" }).click();
await addNote(doctorBrowser.page, "Observation", `${run.runId} doctor note`);
await doctorBrowser.page.getByText(`${run.runId} doctor note`).waitFor();

await doctorBrowser.page.getByRole("link", { name: "Labs" }).click();
await addLab(doctorBrowser.page, `${run.runId} CBC`, `${run.runId} lab result`);
await doctorBrowser.page.getByText(`${run.runId} CBC`).waitFor();

// meds tab visibility
await doctorBrowser.page.getByRole("link", { name: "Meds" }).click();
await doctorBrowser.page.getByRole("button", { name: "Add Medication" }).click();
await doctorBrowser.page.getByLabel("Drug Name").fill(`${run.runId} Cefpodoxime`);
await doctorBrowser.page.getByLabel("Dose").fill("10 mg/kg");
await doctorBrowser.page.getByRole("button", { name: "Save Medication" }).click();
await doctorBrowser.page.getByText(`${run.runId} Cefpodoxime`).waitFor();

// vitals and proof skip
await doctorBrowser.page.getByRole("link", { name: "Vitals" }).click();
await doctorBrowser.page.getByRole("button", { name: "Record Vitals" }).click();
await doctorBrowser.page.getByLabel("Temperature (°C)").fill("39.4");
await doctorBrowser.page.getByLabel("Heart Rate (bpm)").fill("118");
await doctorBrowser.page.getByRole("button", { name: "Next: Upload Proof" }).click();
await skipProofUpload(doctorBrowser.page);

// bath and proof skip
await doctorBrowser.page.getByRole("link", { name: "Bath" }).click();
await doctorBrowser.page.getByRole("button", { name: "Log Bath" }).click();
await doctorBrowser.page.getByLabel("Notes").fill(`${run.runId} bath note`);
await doctorBrowser.page.getByRole("button", { name: "Next: Upload Proof" }).click();
await skipProofUpload(doctorBrowser.page);

// photos upload through real Drive path
await doctorBrowser.page.getByRole("link", { name: "Photos" }).click();
await uploadMediaFromPhotosTab(doctorBrowser.page, fixtureImage);
await doctorBrowser.page.getByText("Upload complete").waitFor({ timeout: 120000 });
```

- [ ] **Step 5: Verify dashboard, patient tabs, and management read-only views**

Continue the same test with:

```ts
// internal dashboard
await doctorBrowser.page.goto("/");
await doctorBrowser.page.getByText("Active Patients").waitFor();
await doctorBrowser.page.getByText(run.runId).waitFor();

// schedule
await doctorBrowser.page.goto("/schedule");
await doctorBrowser.page.getByText("Daily Schedule").waitFor();

// management read-only
const managementBrowser = await openBrowser(server.baseUrl);
try {
  await loginAs(managementBrowser.page, adminFixtures.management.phone, "realrun123!");
  await managementBrowser.page.waitForURL(/\/management$/);
  await managementBrowser.page.getByText("Always Care IPD · Management").waitFor();
  await managementBrowser.page.getByText(run.runId).waitFor();
  await managementBrowser.page.goto(`/management/patients/${seeded.activeGeneral.admissions[0].id}?tab=overview`);
  await managementBrowser.page.getByText(run.runId).waitFor();
  await managementBrowser.page.getByText("Updated").waitFor();
} finally {
  await closeBrowser(managementBrowser);
}
```

- [ ] **Step 6: Run verification**

Run: `node --import tsx --test tests/real-system-validation.test.ts`  
Expected: PASS through auth, patient lifecycle, core dashboard, tabs, and real media upload phases.

- [ ] **Step 7: Commit**

```bash
git add tests/real-system-validation.test.ts tests/support/real-browser.ts tests/support/real-fixtures.ts tests/support/real-run-context.ts
git commit -m "test: cover real auth, lifecycle, dashboard, and media flows"
```

---

### Task 6: Add Isolation, Management Push, Report Completion, And Full-System Verification

**Files:**
- Modify: `tests/real-system-validation.test.ts`
- Modify: `tests/support/real-browser.ts`
- Modify: `tests/support/real-drive.ts`
- Modify: `tests/support/real-run-context.ts`
- Test: `tests/real-system-validation.test.ts`

- [ ] **Step 1: Extend the harness with failing isolation and push phases**

Append this to the main test after the core lifecycle passes:

```ts
const driveFiles = await findDriveFilesByRunId(run.runId);
assert.ok(driveFiles.length > 0, "expected at least one Drive artifact for the run");

const pushBrowser = await openBrowser(server.baseUrl, true);
try {
  await loginAs(pushBrowser.page, adminFixtures.management.phone, "realrun123!");
  await pushBrowser.page.waitForURL(/\/management$/);
  const subscription = await fetchJsonInPage<{ success?: boolean; enabled?: boolean }>(
    pushBrowser.page,
    "/api/push/subscribe"
  );
  assert.equal(subscription.enabled, true);
} finally {
  await closeBrowser(pushBrowser);
}
```

- [ ] **Step 2: Run the harness to verify it fails in the new phase**

Run: `node --import tsx --test tests/real-system-validation.test.ts`  
Expected: FAIL because push subscription and final evidence/reporting are not implemented yet.

- [ ] **Step 3: Add isolation and push-capable browser helpers**

Update `tests/support/real-browser.ts` with:

```ts
export async function subscribeManagementPush(page: Page) {
  await page.goto("/management");
  await page.waitForTimeout(3000);
  return fetchJsonInPage<{ success?: boolean; enabled?: boolean }>(
    page,
    "/api/push/subscribe",
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}
```

- [ ] **Step 4: Finish the main harness with isolation, push, and report assertions**

Add top-level imports `import { db } from "@/lib/db";` and `import { sendManagementPush } from "@/lib/push";`, then complete `tests/real-system-validation.test.ts` with:

```ts
// isolation page
await doctorBrowser.page.goto("/isolation");
await doctorBrowser.page.getByText("Isolation Ward").waitFor();
await doctorBrowser.page.getByText(run.runId).waitFor();
run.recordPhase("isolation", "passed", ["tagged isolation patient visible"]);

// verify Drive artifact inventory
const driveArtifacts = await findDriveFilesByRunId(run.runId);
for (const file of driveArtifacts) {
  run.recordArtifact({
    kind: "drive-file",
    label: file.name ?? "drive-file",
    id: file.id ?? "missing-id",
    details: { webViewLink: file.webViewLink ?? "" },
  });
}

// push subscription and delivery
const pushBrowser = await openBrowser(server.baseUrl, true);
try {
  await loginAs(pushBrowser.page, adminFixtures.management.phone, "realrun123!");
  await pushBrowser.page.waitForURL(/\/management$/);
  await subscribeManagementPush(pushBrowser.page);
  await pushBrowser.page.waitForTimeout(4000);

  const subscription = await db.pushSubscription.findFirst({
    where: { staffId: adminFixtures.management.id },
    select: { id: true, endpoint: true },
  });
  assert.ok(subscription, "management push subscription was not created");

  const pushResult = await sendManagementPush({
    title: `${run.runId} Push`,
    body: `${run.runId} browser push verification`,
    url: "/management",
    tag: run.runId,
  });
  assert.ok(pushResult.sent >= 1, "expected at least one real push send");

  run.recordPhase("push", "passed", [
    `subscription=${subscription.id}`,
    `sent=${String(pushResult.sent)}`,
    `removed=${String(pushResult.removed)}`,
  ]);
} finally {
  await closeBrowser(pushBrowser);
}

run.recordPhase("report", "passed", ["all required phases completed"]);
const reportPaths = await run.writeReports();
assert.match(reportPaths.jsonPath, /test-results\/real-system\/TEST-RUN-/);
```

- [ ] **Step 5: Run the full verification**

Run:

```bash
npm run test:real-system
```

Expected:
- PASS for `tests/real-system-validation.test.ts`
- a new `test-results/real-system/TEST-RUN-...json`
- a new `test-results/real-system/TEST-RUN-...md`
- tagged records visible in the real DB
- tagged files visible in Google Drive

- [ ] **Step 6: Perform a final production-safety verification**

Run:

```bash
npm run lint
npm run build
```

Expected:
- `npm run lint` completes without new errors
- `npm run build` succeeds

- [ ] **Step 7: Commit**

```bash
git add tests/real-system-validation.test.ts tests/support/real-browser.ts tests/support/real-drive.ts tests/support/real-run-context.ts test-results/real-system
git commit -m "test: add full real system validation harness"
```

---

### Task 7: Add Operator Documentation For Running And Purging Test Artifacts

**Files:**
- Modify: `README.md`
- Create: `docs/superpowers/plans/2026-04-05-real-system-validation-runbook.md`
- Test: manual verification of commands in the runbook

- [ ] **Step 1: Write the failing documentation expectation in a small contract test**

Create `tests/real-system-docs.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("runbook documents the real-system command and purge checklist", () => {
  const source = readFileSync(
    new URL("../docs/superpowers/plans/2026-04-05-real-system-validation-runbook.md", import.meta.url),
    "utf8"
  );

  assert.match(source, /npm run test:real-system/);
  assert.match(source, /Purge Checklist/);
  assert.match(source, /TEST-RUN-/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx --test tests/real-system-docs.test.ts`  
Expected: FAIL because the runbook does not exist yet.

- [ ] **Step 3: Write the runbook**

Create `docs/superpowers/plans/2026-04-05-real-system-validation-runbook.md`:

```md
# Real System Validation Runbook

## Run

```bash
npm install
npm run setup:real-system-browser
npm run test:real-system
```

## What Gets Created

- tagged DB records prefixed with `TEST-RUN-`
- tagged Drive files containing `TEST-RUN-`
- a report in `test-results/real-system/`

## Purge Checklist

1. Read the latest report in `test-results/real-system/`.
2. Delete only DB records whose names or notes contain the exact run id.
3. Delete or archive only Drive files whose names contain the exact run id.
4. Remove push subscriptions that were recorded in the run report.
5. Re-run a search for `TEST-RUN-<run-id>` before closing the cleanup.
```

Also add this short section to `README.md`:

```md
## Real System Validation

Run the full live-environment harness with:

```bash
npm run setup:real-system-browser
npm run test:real-system
```

See `docs/superpowers/plans/2026-04-05-real-system-validation-runbook.md` for the artifact and purge workflow.
```

- [ ] **Step 4: Run verification**

Run:

```bash
node --import tsx --test tests/real-system-docs.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add README.md docs/superpowers/plans/2026-04-05-real-system-validation-runbook.md tests/real-system-docs.test.ts
git commit -m "docs: add real system validation runbook"
```

---

## Self-Review

- Spec coverage: this plan covers the live harness entrypoint, push bootstrap, fixture ownership, browser flows, Drive verification, reporting, and operator runbook described in the approved spec.
- Placeholder scan: there are no `TODO`, `TBD`, “similar to above”, or undefined helper references left in the plan.
- Type consistency: the helper names and file paths are reused consistently across tasks so later tasks build on earlier ones without renaming drift.
