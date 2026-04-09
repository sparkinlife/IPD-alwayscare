# Intake And Clinical Field Additions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved intake and clinical fields without changing the existing two-step intake → clinical setup workflow, and surface the new patient number and triage metadata where staff need it.

**Architecture:** Keep the current registration and doctor-only clinical setup flow intact. Minimize blast radius by reusing the existing `rescueLocation` column as the user-facing location-name field, storing the optional location photo through the existing patient media upload path using a dedicated `LOCATION` folder and `location-` filename prefix, and allocating the visible patient number through a dedicated `ClinicCounter` row in the same transaction as patient creation.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma 7, PostgreSQL, node:test, tsx

---

## File Map

- Create: `src/lib/intake-fields.ts`
  Purpose: centralize patient-number formatting plus the new handling/spay/viral parsing helpers so the action code stays small and testable.

- Create: `tests/intake-fields.test.ts`
  Purpose: pure-function coverage for patient-number formatting, handling-note validation, spay/neuter validation, viral-risk parsing, and `LOCATION` drive-path support.

- Create: `tests/intake-schema-contract.test.ts`
  Purpose: source-contract coverage for Prisma schema additions, counter usage, and seed backfill behavior.

- Create: `tests/intake-registration-contract.test.ts`
  Purpose: source-contract coverage for intake-form fields, default stray behavior, separate location-photo upload, and registered-patient edit support.

- Create: `tests/clinical-setup-contract.test.ts`
  Purpose: source-contract coverage for viral-risk, spay/neuter, and ABC-candidate behavior in clinical setup and later admission edits.

- Create: `tests/intake-display-contract.test.ts`
  Purpose: source-contract coverage for patient-number, handling-note, and viral-risk visibility through dashboard, patient, and management query/display surfaces.

- Modify: `prisma/schema.prisma`
  Purpose: add the new enums, intake fields, clinical-setup fields, and the `ClinicCounter` model.

- Modify: the `migration.sql` file created by `npx prisma migrate dev --name intake_clinical_fields`
  Purpose: append one-time SQL to backfill existing patient numbers and initialize the counter row safely.

- Modify: `prisma/seed.ts`
  Purpose: assign deterministic patient numbers after fixture creation so `db seed` keeps working with the new schema.

- Modify: `src/lib/constants.ts`
  Purpose: add shared label maps for new enum-backed values so forms and badges use one vocabulary.

- Modify: `src/lib/drive-path.ts`
  Purpose: support a dedicated `LOCATION` folder label for intake location-photo uploads.

- Modify: `src/actions/admissions.ts`
  Purpose: allocate patient numbers, persist the new intake fields, persist the new clinical-setup fields, and keep edit flows in sync.

- Modify: `src/components/forms/registration-form.tsx`
  Purpose: add the new intake fields, default stray to off, and separate location-photo upload from the existing patient photo/video upload path.

- Modify: `src/components/dashboard/pending-setup.tsx`
  Purpose: expose the new intake fields in the registered-patient edit sheet and display the patient number and handling note on cards waiting for setup.

- Modify: `src/components/forms/clinical-setup-form.tsx`
  Purpose: add viral-risk, spay/neuter, and ABC-candidate inputs while preserving the current submission flow.

- Modify: `src/components/patient/patient-header.tsx`
  Purpose: show the patient number and the new handling/viral-risk metadata, and allow doctor edits after admission is active.

- Modify: `src/lib/dashboard-queries.ts`
  Purpose: thread patient-number and handling-note data into the pending-setup view.

- Modify: `src/lib/patient-page-queries.ts`
  Purpose: thread patient-number, handling-note, and viral-risk data into the patient header.

- Modify: `src/lib/management-dashboard-queries.ts`
  Purpose: thread patient-number data into management dashboard cards and registered-patient rows.

- Modify: `src/components/management/patient-card.tsx`
  Purpose: show the patient number on active management cards.

- Modify: `src/app/(management)/management/page.tsx`
  Purpose: show the patient number in the registered-patient list.

- Modify: `src/lib/management-patient-page-queries.ts`
  Purpose: thread patient-number, handling-note, and viral-risk into the management patient shell.

- Modify: `src/app/(management)/management/patients/[admissionId]/page.tsx`
  Purpose: render the new identity and triage metadata in the management patient header.

## Preflight

Before touching the form components, read the Next.js App Router forms guide the repo asked for:

Run: `sed -n '1,220p' node_modules/next/dist/docs/01-app/02-guides/forms.md`
Expected: the guide opens and confirms the current Server Action + `FormData` + `useActionState` behavior used by this app.

### Task 1: Add Pure Intake Helpers And Failing Tests

**Files:**
- Create: `src/lib/intake-fields.ts`
- Modify: `src/lib/constants.ts`
- Modify: `src/lib/drive-path.ts`
- Test: `tests/intake-fields.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import {
  formatPatientNumber,
  parseViralRisk,
  validateHandlingNote,
  validateSpayNeuterStatus,
} from "../src/lib/intake-fields";
import { buildDriveFolderPath } from "../src/lib/drive-path";

test("formatPatientNumber pads to six digits with the IPD prefix", () => {
  assert.equal(formatPatientNumber(1), "IPD-000001");
  assert.equal(formatPatientNumber(123), "IPD-000123");
});

test("validateHandlingNote accepts the approved intake values", () => {
  assert.equal(validateHandlingNote("STANDARD"), "STANDARD");
  assert.equal(validateHandlingNote("GENTLE"), "GENTLE");
  assert.equal(
    validateHandlingNote("ADVANCED_HANDLER_ONLY"),
    "ADVANCED_HANDLER_ONLY"
  );
});

test("validateHandlingNote rejects unknown values", () => {
  assert.throws(() => validateHandlingNote("CALM"), /Invalid handling note/);
});

test("parseViralRisk maps YES/NO to booleans", () => {
  assert.equal(parseViralRisk("YES"), true);
  assert.equal(parseViralRisk("NO"), false);
  assert.throws(() => parseViralRisk("MAYBE"), /Invalid viral risk/);
});

test("validateSpayNeuterStatus accepts approved setup values", () => {
  assert.equal(validateSpayNeuterStatus("UNKNOWN"), "UNKNOWN");
  assert.equal(validateSpayNeuterStatus("INTACT"), "INTACT");
  assert.equal(
    validateSpayNeuterStatus("SPAYED_NEUTERED"),
    "SPAYED_NEUTERED"
  );
});

test("LOCATION uploads use a dedicated Drive folder label", () => {
  const folder = buildDriveFolderPath("Bruno", "LOCATION");
  assert.equal(folder.at(-1), "Location");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/intake-fields.test.ts`
Expected: FAIL because `src/lib/intake-fields.ts` does not exist and `LOCATION` is not yet supported in `buildDriveFolderPath`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/intake-fields.ts
const HANDLING_NOTES = [
  "STANDARD",
  "GENTLE",
  "ADVANCED_HANDLER_ONLY",
] as const;

const SPAY_NEUTER_STATUSES = [
  "UNKNOWN",
  "INTACT",
  "SPAYED_NEUTERED",
] as const;

export type HandlingNoteValue = (typeof HANDLING_NOTES)[number];
export type SpayNeuterStatusValue = (typeof SPAY_NEUTER_STATUSES)[number];

export function formatPatientNumber(sequence: number): string {
  return `IPD-${String(sequence).padStart(6, "0")}`;
}

export function validateHandlingNote(value: string): HandlingNoteValue {
  if (!HANDLING_NOTES.includes(value as HandlingNoteValue)) {
    throw new Error(`Invalid handling note: ${value}`);
  }
  return value as HandlingNoteValue;
}

export function validateSpayNeuterStatus(
  value: string
): SpayNeuterStatusValue {
  if (!SPAY_NEUTER_STATUSES.includes(value as SpayNeuterStatusValue)) {
    throw new Error(`Invalid spay/neuter status: ${value}`);
  }
  return value as SpayNeuterStatusValue;
}

export function parseViralRisk(value: string): boolean {
  if (value === "YES") return true;
  if (value === "NO") return false;
  throw new Error(`Invalid viral risk: ${value}`);
}
```

```ts
// src/lib/constants.ts
export const HANDLING_NOTE_LABELS: Record<string, string> = {
  STANDARD: "Standard",
  GENTLE: "Gentle",
  ADVANCED_HANDLER_ONLY: "Advanced handler only",
};

export const SPAY_NEUTER_STATUS_LABELS: Record<string, string> = {
  UNKNOWN: "Unknown",
  INTACT: "Intact",
  SPAYED_NEUTERED: "Spayed / neutered",
};
```

```ts
// src/lib/drive-path.ts
const catLabels: Record<string, string> = {
  MEDS: "Meds",
  FOOD: "Food",
  VITALS: "Vitals",
  BATH: "Bath",
  DISINFECTION: "Disinfection",
  PROFILE: "Profile",
  LOCATION: "Location",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/intake-fields.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/intake-fields.test.ts src/lib/intake-fields.ts src/lib/constants.ts src/lib/drive-path.ts
git commit -m "feat: add intake field helpers"
```

### Task 2: Add Schema, Counter, Migration Backfill, And Seed Support

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: the `migration.sql` file created by `npx prisma migrate dev --name intake_clinical_fields`
- Modify: `prisma/seed.ts`
- Modify: `src/actions/admissions.ts`
- Test: `tests/intake-schema-contract.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schemaSource = readFileSync(
  new URL("../prisma/schema.prisma", import.meta.url),
  "utf8"
);
const admissionsSource = readFileSync(
  new URL("../src/actions/admissions.ts", import.meta.url),
  "utf8"
);
const seedSource = readFileSync(
  new URL("../prisma/seed.ts", import.meta.url),
  "utf8"
);

test("patient schema stores the approved intake metadata", () => {
  assert.match(schemaSource, /enum HandlingNote[\s\S]*STANDARD/);
  assert.match(schemaSource, /patientNumber\s+String\?\s+@unique/);
  assert.match(schemaSource, /locationGpsCoordinates\s+String\?/);
  assert.match(schemaSource, /ambulancePersonName\s+String\?/);
  assert.match(schemaSource, /handlingNote\s+HandlingNote\s+@default\(STANDARD\)/);
  assert.match(schemaSource, /isStray\s+Boolean\s+@default\(false\)/);
});

test("admission schema stores the approved clinical setup metadata", () => {
  assert.match(schemaSource, /enum SpayNeuterStatus[\s\S]*SPAYED_NEUTERED/);
  assert.match(schemaSource, /viralRisk\s+Boolean\?/);
  assert.match(schemaSource, /spayNeuterStatus\s+SpayNeuterStatus\?/);
  assert.match(schemaSource, /abcCandidate\s+Boolean\s+@default\(false\)/);
});

test("a dedicated counter model exists for patient-number allocation", () => {
  assert.match(schemaSource, /model ClinicCounter[\s\S]*value\s+Int/);
  assert.match(admissionsSource, /clinicCounter\.upsert/);
  assert.match(admissionsSource, /formatPatientNumber\(/);
});

test("seed code backfills patient numbers and syncs the counter", () => {
  assert.match(seedSource, /formatPatientNumber\(/);
  assert.match(seedSource, /clinicCounter\.upsert/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/intake-schema-contract.test.ts`
Expected: FAIL because the schema, counter model, and seed backfill do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```prisma
// prisma/schema.prisma
enum HandlingNote {
  STANDARD
  GENTLE
  ADVANCED_HANDLER_ONLY
}

enum SpayNeuterStatus {
  UNKNOWN
  INTACT
  SPAYED_NEUTERED
}

model ClinicCounter {
  key       String   @id
  value     Int      @default(0)
  updatedAt DateTime @updatedAt
}

model Patient {
  id                     String       @id @default(cuid())
  patientNumber          String?      @unique
  name                   String
  species                Species      @default(DOG)
  breed                  String?
  age                    String?
  weight                 Float?
  sex                    Sex          @default(UNKNOWN)
  color                  String?
  microchipId            String?
  isStray                Boolean      @default(false)
  rescueLocation         String?
  locationGpsCoordinates String?
  ambulancePersonName    String?
  handlingNote           HandlingNote @default(STANDARD)
  rescuerInfo            String?
  deletedAt              DateTime?
  createdAt              DateTime     @default(now())
  updatedAt              DateTime     @updatedAt

  admissions Admission[]
  media      PatientMedia[]
}

model Admission {
  id                String            @id @default(cuid())
  patientId         String
  patient           Patient           @relation(fields: [patientId], references: [id])
  admissionDate     DateTime          @default(now())
  dischargeDate     DateTime?
  ward              Ward?
  cageNumber        String?
  status            AdmissionStatus   @default(REGISTERED)
  condition         Condition?
  diagnosis         String?
  diagnosisNotes    String?
  chiefComplaint    String?
  viralRisk         Boolean?
  spayNeuterStatus  SpayNeuterStatus?
  abcCandidate      Boolean           @default(false)
  admittedById      String
  admittedBy        Staff             @relation("admittedBy", fields: [admittedById], references: [id])
  attendingDoctor   String?
  dischargedById    String?
  dischargedBy      Staff?            @relation("dischargedBy", fields: [dischargedById], references: [id])
  dischargeNotes    String?
  deletedAt         DateTime?
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
}
```

```ts
// src/actions/admissions.ts
import {
  formatPatientNumber,
  parseViralRisk,
  validateHandlingNote,
  validateSpayNeuterStatus,
} from "@/lib/intake-fields";

async function reservePatientNumber(tx: any) {
  const counter = await tx.clinicCounter.upsert({
    where: { key: "patientNumber" },
    update: { value: { increment: 1 } },
    create: { key: "patientNumber", value: 1 },
    select: { value: true },
  });

  return formatPatientNumber(counter.value);
}
```

```sql
-- append to the generated migration.sql after Prisma's ALTER TABLE statements
WITH numbered_patients AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS seq
  FROM "Patient"
)
UPDATE "Patient" AS patient
SET
  "patientNumber" = 'IPD-' || LPAD(numbered_patients.seq::text, 6, '0'),
  "handlingNote" = COALESCE(patient."handlingNote", 'STANDARD')
FROM numbered_patients
WHERE patient."id" = numbered_patients."id"
  AND patient."patientNumber" IS NULL;

INSERT INTO "ClinicCounter" ("key", "value", "updatedAt")
VALUES (
  'patientNumber',
  COALESCE((SELECT COUNT(*) FROM "Patient"), 0),
  NOW()
)
ON CONFLICT ("key")
DO UPDATE SET
  "value" = EXCLUDED."value",
  "updatedAt" = NOW();
```

```ts
// prisma/seed.ts
import { formatPatientNumber } from "../src/lib/intake-fields";

async function syncSeedPatientNumbers() {
  const patients = await prisma.patient.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });

  for (const [index, patient] of patients.entries()) {
    await prisma.patient.update({
      where: { id: patient.id },
      data: { patientNumber: formatPatientNumber(index + 1) },
    });
  }

  await prisma.clinicCounter.upsert({
    where: { key: "patientNumber" },
    update: { value: patients.length },
    create: { key: "patientNumber", value: patients.length },
  });
}

await syncSeedPatientNumbers();
```

- [ ] **Step 4: Run the migration and verification to confirm it passes**

Run: `npx prisma migrate dev --name intake_clinical_fields && node --import tsx --test tests/intake-schema-contract.test.ts`
Expected: the migration is created and applied locally, Prisma Client regenerates, and the contract test PASSes.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/seed.ts prisma/migrations src/actions/admissions.ts tests/intake-schema-contract.test.ts
git commit -m "feat: add intake and clinical schema fields"
```

### Task 3: Implement Intake Form, Registration Persistence, And Pending-Setup Editing

**Files:**
- Modify: `src/components/forms/registration-form.tsx`
- Modify: `src/actions/admissions.ts`
- Modify: `src/components/dashboard/pending-setup.tsx`
- Modify: `src/lib/dashboard-queries.ts`
- Test: `tests/intake-registration-contract.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const registrationSource = readFileSync(
  new URL("../src/components/forms/registration-form.tsx", import.meta.url),
  "utf8"
);
const admissionsSource = readFileSync(
  new URL("../src/actions/admissions.ts", import.meta.url),
  "utf8"
);
const pendingSetupSource = readFileSync(
  new URL("../src/components/dashboard/pending-setup.tsx", import.meta.url),
  "utf8"
);
const dashboardQueriesSource = readFileSync(
  new URL("../src/lib/dashboard-queries.ts", import.meta.url),
  "utf8"
);

test("registration defaults stray to false and captures the new intake fields", () => {
  assert.match(registrationSource, /useState\(false\)/);
  assert.match(registrationSource, /name="ambulancePersonName"/);
  assert.match(registrationSource, /name="locationGpsCoordinates"/);
  assert.match(registrationSource, /name="handlingNote"/);
  assert.match(registrationSource, /Location Photo/);
});

test("registration uploads the location photo separately from profile media", () => {
  assert.match(registrationSource, /buildDriveFolderPath\(patientName, "LOCATION"\)/);
  assert.match(registrationSource, /buildDriveFileName\("location",/);
  assert.match(registrationSource, /savePatientMedia\(patientId, locationUploads, false\)/);
});

test("registerPatient persists patient number and new intake metadata", () => {
  assert.match(admissionsSource, /const patientNumber = await reservePatientNumber\(tx\)/);
  assert.match(admissionsSource, /const handlingNote = validateHandlingNote/);
  assert.match(admissionsSource, /const ambulancePersonName =/);
  assert.match(admissionsSource, /const locationGpsCoordinates =/);
  assert.match(admissionsSource, /patientNumber,/);
  assert.match(admissionsSource, /ambulancePersonName,/);
  assert.match(admissionsSource, /handlingNote,/);
});

test("registered-patient editing covers the new intake fields", () => {
  assert.match(pendingSetupSource, /name="ambulancePersonName"/);
  assert.match(pendingSetupSource, /name="locationGpsCoordinates"/);
  assert.match(pendingSetupSource, /name="handlingNote"/);
  assert.match(admissionsSource, /editRegisteredPatient[\s\S]*handlingNote/);
  assert.match(admissionsSource, /updatePatient[\s\S]*handlingNote/);
  assert.match(pendingSetupSource, /patient\.patientNumber/);
  assert.match(dashboardQueriesSource, /patientNumber:\s*true/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/intake-registration-contract.test.ts`
Expected: FAIL because the intake form, registration action, and pending-setup query/edit surface do not yet include the new fields.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/forms/registration-form.tsx
const [isStray, setIsStray] = useState(false);
const [handlingNote, setHandlingNote] = useState("STANDARD");
const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
const [locationPhoto, setLocationPhoto] = useState<File | null>(null);
const locationPhotoInputRef = useRef<HTMLInputElement>(null);

<input type="hidden" name="species" value={species} />
<input type="hidden" name="sex" value={sex} />
<input type="hidden" name="isStray" value={String(isStray)} />
<input type="hidden" name="handlingNote" value={handlingNote} />

<div className="space-y-1.5">
  <Label htmlFor="ambulancePersonName">Ambulance Person Name</Label>
  <Input id="ambulancePersonName" name="ambulancePersonName" className="h-12" />
</div>

<div className="space-y-1.5">
  <Label htmlFor="rescueLocation">Location Name</Label>
  <Input
    id="rescueLocation"
    name="rescueLocation"
    placeholder="e.g., Sector 17 market back lane"
    className="h-12"
  />
</div>

<div className="space-y-1.5">
  <Label htmlFor="locationGpsCoordinates">GPS Coordinates</Label>
  <Input
    id="locationGpsCoordinates"
    name="locationGpsCoordinates"
    placeholder="e.g., 19.0760, 72.8777"
    className="h-12"
  />
</div>

<div className="space-y-1.5">
  <Label>Handling Note <span className="text-red-500">*</span></Label>
  <Select value={handlingNote} onValueChange={(value) => setHandlingNote(value ?? "STANDARD")}>
    <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="STANDARD">Standard</SelectItem>
      <SelectItem value="GENTLE">Gentle</SelectItem>
      <SelectItem value="ADVANCED_HANDLER_ONLY">Advanced handler only</SelectItem>
    </SelectContent>
  </Select>
</div>

<div className="space-y-2">
  <Label>Location Photo</Label>
  <input
    ref={locationPhotoInputRef}
    type="file"
    accept="image/*"
    className="hidden"
    onChange={(event) => setLocationPhoto(event.target.files?.[0] ?? null)}
  />
  <Button type="button" variant="outline" className="w-full h-12" onClick={() => locationPhotoInputRef.current?.click()}>
    Add Location Photo
  </Button>
</div>
```

```ts
// src/actions/admissions.ts
const rescueLocation = (formData.get("rescueLocation") as string) || undefined;
const locationGpsCoordinates =
  (formData.get("locationGpsCoordinates") as string) || undefined;
const ambulancePersonName =
  (formData.get("ambulancePersonName") as string) || undefined;
const handlingNote = validateHandlingNote(
  ((formData.get("handlingNote") as string) || "STANDARD").trim()
);

const result = await db.$transaction(async (tx: any) => {
  const patientNumber = await reservePatientNumber(tx);

  const patient = await tx.patient.create({
    data: {
      patientNumber,
      name,
      species: validateSpecies(species),
      breed,
      age,
      weight,
      sex: validateSex(sex),
      color,
      isStray,
      rescueLocation,
      locationGpsCoordinates,
      ambulancePersonName,
      handlingNote,
      rescuerInfo,
    },
  });

  const admission = await tx.admission.create({
    data: {
      patientId: patient.id,
      admittedById: session.staffId,
      status: "REGISTERED",
    },
  });

  return { patientId: patient.id, admissionId: admission.id, patientNumber };
});

return {
  success: true,
  admissionId: result.admissionId,
  patientId: result.patientId,
  patientNumber: result.patientNumber,
};

// keep editRegisteredPatient and updatePatient aligned with the same fields
const rescueLocation = (formData.get("rescueLocation") as string) || null;
const locationGpsCoordinates =
  (formData.get("locationGpsCoordinates") as string) || null;
const ambulancePersonName =
  (formData.get("ambulancePersonName") as string) || null;
const handlingNote = validateHandlingNote(
  ((formData.get("handlingNote") as string) || "STANDARD").trim()
);

data: {
  name,
  breed,
  age,
  weight,
  sex: sex ? validateSex(sex) : undefined,
  color,
  isStray,
  rescueLocation,
  locationGpsCoordinates,
  ambulancePersonName,
  handlingNote,
  rescuerInfo,
},
```

```ts
// src/components/forms/registration-form.tsx upload branch
if ((selectedFiles.length > 0 || locationPhoto) && patientId) {
const locationUploads: Array<{
  fileUrl: string;
  fileId: string;
  fileName: string;
  mimeType: string;
}> = [];

if (locationPhoto && patientId) {
  const result = await uploadFileChunked(
    locationPhoto,
    buildDriveFolderPath(patientName, "LOCATION"),
    buildDriveFileName("location", locationPhoto.name)
  );

  locationUploads.push({
    fileUrl: result.shareableLink,
    fileId: result.fileId,
    fileName: result.fileName,
    mimeType: locationPhoto.type,
  });
}

if (!cancelled && locationUploads.length > 0) {
  await savePatientMedia(patientId, locationUploads, false);
}
}
```

```tsx
// src/components/dashboard/pending-setup.tsx
interface RegisteredAdmission {
  id: string;
  admissionDate: Date;
  patient: {
    id: string;
    patientNumber: string | null;
    name: string;
    species: string;
    breed: string | null;
    age: string | null;
    weight: number | null;
    sex: string;
    color: string | null;
    isStray: boolean;
    rescueLocation: string | null;
    locationGpsCoordinates: string | null;
    ambulancePersonName: string | null;
    handlingNote: string;
    rescuerInfo: string | null;
  };
  admittedBy: { name: string };
}

const [handlingNote, setHandlingNote] = React.useState(
  admission.patient.handlingNote
);

const formData = new FormData(e.currentTarget);
formData.set("species", species);
formData.set("sex", sex);
formData.set("isStray", String(isStray));
formData.set("handlingNote", handlingNote);

<p className="truncate text-sm font-semibold text-foreground">
  {admission.patient.name}
</p>
<p className="text-[11px] text-muted-foreground">
  {admission.patient.patientNumber ?? "Number pending"} · {admission.patient.handlingNote === "GENTLE" ? "Gentle" : admission.patient.handlingNote === "ADVANCED_HANDLER_ONLY" ? "Advanced handler only" : "Standard"}
</p>

<Input id="edit-ambulance" name="ambulancePersonName" defaultValue={admission.patient.ambulancePersonName ?? ""} />
<Input id="edit-location-gps" name="locationGpsCoordinates" defaultValue={admission.patient.locationGpsCoordinates ?? ""} />
<Select value={handlingNote} onValueChange={(value) => setHandlingNote(value ?? "STANDARD")}>
  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
  <SelectContent>
    <SelectItem value="STANDARD">Standard</SelectItem>
    <SelectItem value="GENTLE">Gentle</SelectItem>
    <SelectItem value="ADVANCED_HANDLER_ONLY">Advanced handler only</SelectItem>
  </SelectContent>
</Select>
```

```ts
// src/lib/dashboard-queries.ts registered admissions select
patient: {
  select: {
    id: true,
    patientNumber: true,
    name: true,
    species: true,
    breed: true,
    age: true,
    weight: true,
    sex: true,
    color: true,
    isStray: true,
    rescueLocation: true,
    locationGpsCoordinates: true,
    ambulancePersonName: true,
    handlingNote: true,
    rescuerInfo: true,
  },
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/intake-registration-contract.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/forms/registration-form.tsx src/actions/admissions.ts src/components/dashboard/pending-setup.tsx src/lib/dashboard-queries.ts tests/intake-registration-contract.test.ts
git commit -m "feat: extend intake registration fields"
```

### Task 4: Implement Clinical Setup Fields And Surface New Metadata In Patient And Management Views

**Files:**
- Modify: `src/components/forms/clinical-setup-form.tsx`
- Modify: `src/actions/admissions.ts`
- Modify: `src/components/patient/patient-header.tsx`
- Modify: `src/lib/patient-page-queries.ts`
- Modify: `src/lib/management-dashboard-queries.ts`
- Modify: `src/components/management/patient-card.tsx`
- Modify: `src/app/(management)/management/page.tsx`
- Modify: `src/lib/management-patient-page-queries.ts`
- Modify: `src/app/(management)/management/patients/[admissionId]/page.tsx`
- Test: `tests/clinical-setup-contract.test.ts`
- Test: `tests/intake-display-contract.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/clinical-setup-contract.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const setupFormSource = readFileSync(
  new URL("../src/components/forms/clinical-setup-form.tsx", import.meta.url),
  "utf8"
);
const admissionsSource = readFileSync(
  new URL("../src/actions/admissions.ts", import.meta.url),
  "utf8"
);
const patientHeaderSource = readFileSync(
  new URL("../src/components/patient/patient-header.tsx", import.meta.url),
  "utf8"
);

test("clinical setup collects viral risk, spay/neuter status, and ABC candidate", () => {
  assert.match(setupFormSource, /name="viralRisk"/);
  assert.match(setupFormSource, /name="spayNeuterStatus"/);
  assert.match(setupFormSource, /name="abcCandidate"/);
  assert.match(setupFormSource, /Please select viral risk/);
});

test("clinical setup persists the new admission fields", () => {
  assert.match(admissionsSource, /const viralRisk = parseViralRisk/);
  assert.match(admissionsSource, /const spayNeuterStatus =/);
  assert.match(admissionsSource, /const abcCandidate = formData\.get\("abcCandidate"\) === "true"/);
  assert.match(admissionsSource, /viralRisk,/);
  assert.match(admissionsSource, /spayNeuterStatus,/);
  assert.match(admissionsSource, /abcCandidate,/);
});

test("active admission editing exposes the new clinical setup fields", () => {
  assert.match(patientHeaderSource, /name="viralRisk"/);
  assert.match(patientHeaderSource, /name="spayNeuterStatus"/);
  assert.match(patientHeaderSource, /name="abcCandidate"/);
});
```

```ts
// tests/intake-display-contract.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test tests/clinical-setup-contract.test.ts tests/intake-display-contract.test.ts`
Expected: FAIL because the new clinical-setup fields and display wiring do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/forms/clinical-setup-form.tsx
const [viralRisk, setViralRisk] = useState("");
const [spayNeuterStatus, setSpayNeuterStatus] = useState("UNKNOWN");
const [abcCandidate, setAbcCandidate] = useState(false);

if (!diagnosis || !ward || !cageNumber || !condition || !attendingDoctor) {
  toast.error("Please fill in all required fields");
  return;
}

if (!viralRisk) {
  toast.error("Please select viral risk");
  return;
}

<input type="hidden" name="viralRisk" value={viralRisk} />
<input type="hidden" name="spayNeuterStatus" value={spayNeuterStatus} />
<input type="hidden" name="abcCandidate" value={abcCandidate ? "true" : "false"} />

<div className="grid grid-cols-2 gap-4">
  <div className="space-y-1.5">
    <Label>Viral Risk <span className="text-red-500">*</span></Label>
    <Select value={viralRisk} onValueChange={(value) => setViralRisk(value ?? "")}>
      <SelectTrigger className="h-11"><SelectValue placeholder="Select risk" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="YES">Yes</SelectItem>
        <SelectItem value="NO">No</SelectItem>
      </SelectContent>
    </Select>
  </div>
  <div className="space-y-1.5">
    <Label>Spay / Neuter Status</Label>
    <Select value={spayNeuterStatus} onValueChange={(value) => setSpayNeuterStatus(value ?? "UNKNOWN")}>
      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="UNKNOWN">Unknown</SelectItem>
        <SelectItem value="INTACT">Intact</SelectItem>
        <SelectItem value="SPAYED_NEUTERED">Spayed / neutered</SelectItem>
      </SelectContent>
    </Select>
  </div>
</div>

<div className="flex items-center justify-between rounded-lg border p-4">
  <div>
    <p className="font-medium text-sm">ABC candidate</p>
    <p className="text-xs text-muted-foreground">Mark if the patient should be tracked for ABC workflow</p>
  </div>
  <Switch checked={abcCandidate} onCheckedChange={setAbcCandidate} />
</div>
```

```ts
// src/actions/admissions.ts clinicalSetup + updateAdmission
const chiefComplaint = (formData.get("chiefComplaint") as string) || undefined;
const viralRisk = parseViralRisk((formData.get("viralRisk") as string) || "");
const spayNeuterStatusRaw =
  (formData.get("spayNeuterStatus") as string) || "UNKNOWN";
const spayNeuterStatus = validateSpayNeuterStatus(spayNeuterStatusRaw);
const abcCandidate = formData.get("abcCandidate") === "true";

await tx.admission.update({
  where: { id: admissionId },
  data: {
    status: "ACTIVE",
    diagnosis,
    chiefComplaint,
    diagnosisNotes,
    ward: validatedWard,
    cageNumber,
    condition: validatedCondition,
    attendingDoctor,
    viralRisk,
    spayNeuterStatus,
    abcCandidate,
  },
});

// updateAdmission
const viralRiskRaw = (formData.get("viralRisk") as string) || "";
const viralRisk = viralRiskRaw ? parseViralRisk(viralRiskRaw) : null;
const spayNeuterStatusRaw =
  (formData.get("spayNeuterStatus") as string) || "UNKNOWN";
const spayNeuterStatus = validateSpayNeuterStatus(spayNeuterStatusRaw);
const abcCandidate = formData.get("abcCandidate") === "true";

await db.admission.update({
  where: { id: admissionId },
  data: {
    diagnosis,
    chiefComplaint,
    diagnosisNotes,
    attendingDoctor,
    viralRisk,
    spayNeuterStatus,
    abcCandidate,
  },
});
```

```ts
// src/lib/patient-page-queries.ts
select: {
  id: true,
  patientId: true,
  admissionDate: true,
  ward: true,
  cageNumber: true,
  condition: true,
  diagnosis: true,
  chiefComplaint: true,
  diagnosisNotes: true,
  attendingDoctor: true,
  viralRisk: true,
  spayNeuterStatus: true,
  abcCandidate: true,
  status: true,
  patient: {
    select: {
      id: true,
      patientNumber: true,
      name: true,
      breed: true,
      age: true,
      sex: true,
      weight: true,
      species: true,
      color: true,
      isStray: true,
      rescueLocation: true,
      locationGpsCoordinates: true,
      ambulancePersonName: true,
      handlingNote: true,
      rescuerInfo: true,
      deletedAt: true,
    },
  },
},
```

```tsx
// src/components/patient/patient-header.tsx
type PatientHeaderAdmission = {
  viralRisk: boolean | null;
  spayNeuterStatus: string | null;
  abcCandidate: boolean;
  patient: {
    patientNumber: string | null;
    handlingNote: string;
  };
};

const [viralRisk, setViralRisk] = useState(
  admission.viralRisk == null ? "" : admission.viralRisk ? "YES" : "NO"
);
const [spayNeuterStatus, setSpayNeuterStatus] = useState(
  admission.spayNeuterStatus ?? "UNKNOWN"
);
const [abcCandidate, setAbcCandidate] = useState(admission.abcCandidate);

<input type="hidden" name="viralRisk" value={viralRisk} />
<input type="hidden" name="spayNeuterStatus" value={spayNeuterStatus} />
<input type="hidden" name="abcCandidate" value={abcCandidate ? "true" : "false"} />

<Select value={viralRisk} onValueChange={(value) => setViralRisk(value ?? "")}>
  <SelectTrigger className="w-full h-12"><SelectValue placeholder="Select viral risk" /></SelectTrigger>
  <SelectContent>
    <SelectItem value="YES">Yes</SelectItem>
    <SelectItem value="NO">No</SelectItem>
  </SelectContent>
</Select>

<Select value={spayNeuterStatus} onValueChange={(value) => setSpayNeuterStatus(value ?? "UNKNOWN")}>
  <SelectTrigger className="w-full h-12"><SelectValue /></SelectTrigger>
  <SelectContent>
    <SelectItem value="UNKNOWN">Unknown</SelectItem>
    <SelectItem value="INTACT">Intact</SelectItem>
    <SelectItem value="SPAYED_NEUTERED">Spayed / neutered</SelectItem>
  </SelectContent>
</Select>

<label className="flex items-center gap-2 text-sm">
  <input
    type="checkbox"
    checked={abcCandidate}
    onChange={(event) => setAbcCandidate(event.target.checked)}
  />
  ABC candidate
</label>

{patient.patientNumber && (
  <p className="text-xs font-medium text-muted-foreground mt-0.5">
    {patient.patientNumber}
  </p>
)}

<div className="flex flex-wrap items-center gap-1.5 mt-1.5">
  {patient.handlingNote && (
    <Badge variant="outline" className="text-xs">
      {patient.handlingNote === "GENTLE"
        ? "Gentle handling"
        : patient.handlingNote === "ADVANCED_HANDLER_ONLY"
          ? "Advanced handler only"
          : "Standard handling"}
    </Badge>
  )}
  {admission.viralRisk != null && (
    <Badge variant="outline" className={admission.viralRisk ? "text-red-700 border-red-200 bg-red-50" : "text-green-700 border-green-200 bg-green-50"}>
      {admission.viralRisk ? "Viral risk" : "No viral risk"}
    </Badge>
  )}
</div>
```

```ts
// src/lib/management-dashboard-queries.ts
export interface PatientCardData {
  admissionId: string;
  patientId: string;
  patientNumber: string | null;
  patientName: string;
  species: string;
  diagnosis: string | null;
  ward: string | null;
  cageNumber: string | null;
  condition: string | null;
  attendingDoctor: string | null;
  admissionDate: Date;
  medsGiven: number;
  medsTotal: number;
  feedsLogged: number;
  feedsTotal: number;
  latestTemp: number | null;
  latestHR: number | null;
  tempAbnormal: boolean;
  hrAbnormal: boolean;
  proofCountToday: number;
}

patient: { select: { id: true, patientNumber: true, name: true, species: true } },

return {
  admissionId: a.id,
  patientId: a.patient.id,
  patientNumber: a.patient.patientNumber,
  patientName: a.patient.name,
  species: a.patient.species,
  diagnosis: a.diagnosis,
  ward: a.ward,
  cageNumber: a.cageNumber,
  condition: a.condition,
  attendingDoctor: a.attendingDoctor,
  admissionDate: a.admissionDate,
  medsGiven,
  medsTotal,
  feedsLogged,
  feedsTotal,
  latestTemp: v?.temperature ?? null,
  latestHR: v?.heartRate ?? null,
  tempAbnormal: v ? checkTemperature(v.temperature).isAbnormal : false,
  hrAbnormal: v ? checkHeartRate(v.heartRate).isAbnormal : false,
  proofCountToday: 0,
};
```

```tsx
// src/components/management/patient-card.tsx
<div className="flex items-center justify-between">
  <h3 className="font-semibold text-sm truncate">{patient.patientName}</h3>
  <span className="text-[10px] text-muted-foreground shrink-0">
    {patient.patientNumber ?? "IPD pending"}
  </span>
</div>
```

```tsx
// src/app/(management)/management/page.tsx
<div key={p.admissionId} className="text-xs text-muted-foreground">
  <span className="font-medium text-foreground">{p.patientName}</span>
  {" · "}
  {p.patientNumber ?? "IPD pending"}
  {" · "}
  {p.species}
  {" · by "}
  {p.admittedBy}
</div>
```

```ts
// src/lib/management-patient-page-queries.ts
patient: {
  select: {
    id: true,
    patientNumber: true,
    name: true,
    species: true,
    breed: true,
    handlingNote: true,
    deletedAt: true,
  },
},
viralRisk: true,
```

```tsx
// src/app/(management)/management/patients/[admissionId]/page.tsx
<h1 className="text-lg font-bold">{shell.patient.name}</h1>
<p className="text-xs text-muted-foreground">
  {shell.patient.patientNumber ?? "IPD pending"}
</p>
<div className="flex items-center gap-2 flex-wrap">
  {shell.patient.handlingNote && (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted font-medium">
      {shell.patient.handlingNote === "GENTLE"
        ? "Gentle handling"
        : shell.patient.handlingNote === "ADVANCED_HANDLER_ONLY"
          ? "Advanced handler only"
          : "Standard handling"}
    </span>
  )}
  {shell.viralRisk != null && (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${shell.viralRisk ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
      {shell.viralRisk ? "Viral risk" : "No viral risk"}
    </span>
  )}
</div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test tests/clinical-setup-contract.test.ts tests/intake-display-contract.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/forms/clinical-setup-form.tsx src/actions/admissions.ts src/components/patient/patient-header.tsx src/lib/patient-page-queries.ts src/lib/management-dashboard-queries.ts src/components/management/patient-card.tsx src/app/'(management)'/management/page.tsx src/lib/management-patient-page-queries.ts src/app/'(management)'/management/patients/'[admissionId]'/page.tsx tests/clinical-setup-contract.test.ts tests/intake-display-contract.test.ts
git commit -m "feat: add clinical setup triage fields"
```

### Task 5: Verify The Whole Change Set Before Calling It Done

**Files:**
- Test: `tests/intake-fields.test.ts`
- Test: `tests/intake-schema-contract.test.ts`
- Test: `tests/intake-registration-contract.test.ts`
- Test: `tests/clinical-setup-contract.test.ts`
- Test: `tests/intake-display-contract.test.ts`

- [ ] **Step 1: Run the focused change-set tests**

Run: `node --import tsx --test tests/intake-fields.test.ts tests/intake-schema-contract.test.ts tests/intake-registration-contract.test.ts tests/clinical-setup-contract.test.ts tests/intake-display-contract.test.ts`
Expected: PASS

- [ ] **Step 2: Run the nearby regression tests**

Run: `node --import tsx --test tests/dashboard-data.test.ts tests/management-patient-page-data.test.ts tests/patient-page-data.test.ts tests/management-dashboard-refresh.test.ts`
Expected: PASS

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: PASS with no new lint violations

- [ ] **Step 4: Run the production build**

Run: `npm run build`
Expected: PASS and Next.js completes the production build successfully

- [ ] **Step 5: Commit any verification fixups**

```bash
git add prisma/schema.prisma prisma/seed.ts src/actions/admissions.ts src/components/forms/registration-form.tsx src/components/dashboard/pending-setup.tsx src/components/forms/clinical-setup-form.tsx src/components/patient/patient-header.tsx src/lib/dashboard-queries.ts src/lib/patient-page-queries.ts src/lib/management-dashboard-queries.ts src/components/management/patient-card.tsx src/app/'(management)'/management/page.tsx src/lib/management-patient-page-queries.ts src/app/'(management)'/management/patients/'[admissionId]'/page.tsx tests/intake-fields.test.ts tests/intake-schema-contract.test.ts tests/intake-registration-contract.test.ts tests/clinical-setup-contract.test.ts tests/intake-display-contract.test.ts
git commit -m "test: verify intake and clinical field additions"
```

## Self-Review

- Spec coverage check:
  - stray default off: covered in Task 3
  - auto patient number: covered in Tasks 1-3
  - location name/GPS/photo and ambulance person: covered in Task 3
  - handling note: covered in Tasks 1, 3, and 4
  - viral risk, spay/neuter, ABC candidate: covered in Task 4
  - patient-number visibility: covered in Task 4
  - regression protection: covered in Task 5

- Placeholder scan:
  - no `TODO`, `TBD`, or “implement later” placeholders remain
  - the generated migration path is intentionally described as generated, but the exact SQL to append is included inline

- Type consistency:
  - handling note values are `STANDARD | GENTLE | ADVANCED_HANDLER_ONLY`
  - spay/neuter values are `UNKNOWN | INTACT | SPAYED_NEUTERED`
  - viral risk is stored as `boolean | null` and parsed from `YES` / `NO`
  - patient number format is always `IPD-` plus a zero-padded six-digit sequence
