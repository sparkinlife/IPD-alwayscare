# Registration Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a required "Mode of Registration" field (Walk-in / Always Care Ambulance / Other) to the patient intake form.

**Architecture:** New Prisma enum + two fields on Patient model. Validator in intake-fields.ts, labels in constants.ts. Three server actions updated to parse/persist. Three UI components updated (registration form, pending-setup edit, patient-header edit + display). Three test files updated.

**Tech Stack:** Prisma, Next.js App Router, React (client components), FormData API, node:test

**Spec:** `docs/superpowers/specs/2026-04-11-registration-mode-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify:126-127, 208-209 | Add enum after SpayNeuterStatus, add 2 fields after handlingNote |
| `src/lib/intake-fields.ts` | Modify:1-6, 27-36 | Add REGISTRATION_MODES array, type, validator |
| `src/lib/constants.ts` | Modify:65-71 | Add REGISTRATION_MODE_LABELS after HANDLING_NOTE_LABELS |
| `src/actions/admissions.ts` | Modify:9-14, 46-91, 177-231, 563-608 | Import validator, update 3 action functions |
| `src/components/forms/registration-form.tsx` | Modify:31-37, 112-116, 176-180, 194-195 | Add state, hidden field, form field, submit logic |
| `src/components/dashboard/pending-setup.tsx` | Modify:34-55, 78-93, 100-105, 117-125, 406 | Update interface, state, form, edit sheet, display |
| `src/components/patient/patient-header.tsx` | Modify:51-67, 85-94, 100-102, 126, 387, 533-544 | Update interface, state, form, edit sheet, display |
| `src/lib/dashboard-queries.ts` | Modify:24-45, 210-225 | Update interface + query select |
| `src/lib/patient-page-queries.ts` | Modify:34-50 | Update query select |
| `tests/intake-schema-contract.test.ts` | Modify:18-28 | Add enum + field assertions |
| `tests/intake-registration-contract.test.ts` | Modify:26-32, 77-88, 90-98 | Add form + action + edit assertions |
| `tests/intake-display-contract.test.ts` | Modify:34-38 | Add query select assertion |

---

### Task 1: Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma:116-127` (add enum after SpayNeuterStatus)
- Modify: `prisma/schema.prisma:208-209` (add fields after handlingNote on Patient)

- [ ] **Step 1: Add RegistrationMode enum to schema**

In `prisma/schema.prisma`, after the `SpayNeuterStatus` enum (line 126), add:

```prisma
enum RegistrationMode {
  WALK_IN
  AMBULANCE
  OTHER
}
```

- [ ] **Step 2: Add fields to Patient model**

In the Patient model, after the `handlingNote` field (line 208), add:

```prisma
  registrationMode      RegistrationMode @default(AMBULANCE)
  registrationModeOther String?
```

- [ ] **Step 3: Generate migration**

Run: `npx prisma migrate dev --name add-registration-mode`

Expected: Migration created successfully, no errors.

- [ ] **Step 4: Verify Prisma client regenerated**

Run: `npx prisma generate`

Expected: `Generated Prisma Client` output with no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add RegistrationMode enum and fields to Patient model"
```

---

### Task 2: Validator + Labels

**Files:**
- Modify: `src/lib/intake-fields.ts:1-6` (add array + type)
- Modify: `src/lib/intake-fields.ts:27-36` (add validator after validateHandlingNote)
- Modify: `src/lib/constants.ts:65` (add labels after HANDLING_NOTE_LABELS)

- [ ] **Step 1: Add REGISTRATION_MODES array and type to intake-fields.ts**

At the top of `src/lib/intake-fields.ts`, after the `SPAY_NEUTER_STATUSES` array (line 11), add:

```typescript
const REGISTRATION_MODES = [
  "WALK_IN",
  "AMBULANCE",
  "OTHER",
] as const;

export type RegistrationModeValue = (typeof REGISTRATION_MODES)[number];
```

- [ ] **Step 2: Add validateRegistrationMode function**

After the `validateSpayNeuterStatus` function (line 36), add:

```typescript
export function validateRegistrationMode(value: string): RegistrationModeValue {
  if (!REGISTRATION_MODES.includes(value as RegistrationModeValue)) {
    throw new Error(`Invalid registration mode: ${value}`);
  }

  return value as RegistrationModeValue;
}
```

- [ ] **Step 3: Add REGISTRATION_MODE_LABELS to constants.ts**

In `src/lib/constants.ts`, after `HANDLING_NOTE_LABELS` (line 65), add:

```typescript
export const REGISTRATION_MODE_LABELS: Record<string, string> = {
  WALK_IN: "Walk-in",
  AMBULANCE: "Always Care Ambulance",
  OTHER: "Other",
};
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/intake-fields.ts src/lib/constants.ts
git commit -m "feat: add registration mode validator and labels"
```

---

### Task 3: Server Actions

**Files:**
- Modify: `src/actions/admissions.ts:9-14` (import)
- Modify: `src/actions/admissions.ts:46-91` (registerPatient)
- Modify: `src/actions/admissions.ts:177-231` (editRegisteredPatient)
- Modify: `src/actions/admissions.ts:563-608` (updatePatient)

- [ ] **Step 1: Add import for validateRegistrationMode**

In `src/actions/admissions.ts`, update the import from `@/lib/intake-fields` (lines 9-14) to include `validateRegistrationMode`:

```typescript
import {
  formatPatientNumber,
  parseViralRisk,
  validateHandlingNote,
  validateRegistrationMode,
  validateSpayNeuterStatus,
} from "@/lib/intake-fields";
```

- [ ] **Step 2: Update registerPatient**

In `registerPatient()`, after the `handlingNote` parsing (line 64-66), add:

```typescript
    const registrationMode = validateRegistrationMode(
      ((formData.get("registrationMode") as string) || "AMBULANCE").trim()
    );
    const registrationModeOther =
      registrationMode === "OTHER"
        ? (formData.get("registrationModeOther") as string) || undefined
        : undefined;
```

In the `tx.patient.create` data object (after `handlingNote,` on line 88), add:

```typescript
          registrationMode,
          registrationModeOther,
```

- [ ] **Step 3: Update editRegisteredPatient**

In `editRegisteredPatient()`, after the `handlingNote` parsing (lines 195-197), add:

```typescript
    const registrationMode = validateRegistrationMode(
      ((formData.get("registrationMode") as string) || "AMBULANCE").trim()
    );
    const registrationModeOther =
      registrationMode === "OTHER"
        ? (formData.get("registrationModeOther") as string) || null
        : null;
```

In the `tx.patient.update` data object (after `handlingNote,` on line 228), add:

```typescript
          registrationMode,
          registrationModeOther,
```

- [ ] **Step 4: Update updatePatient**

In `updatePatient()`, after the `handlingNote` parsing (lines 586-588), add:

```typescript
    const registrationMode = validateRegistrationMode(
      ((formData.get("registrationMode") as string) || "AMBULANCE").trim()
    );
    const registrationModeOther =
      registrationMode === "OTHER"
        ? (formData.get("registrationModeOther") as string) || null
        : null;
```

In the `db.patient.update` data object (after `handlingNote,` on line 606), add:

```typescript
        registrationMode,
        registrationModeOther,
```

- [ ] **Step 5: Verify build**

Run: `npx next build 2>&1 | head -30`

Expected: No type errors related to registrationMode.

- [ ] **Step 6: Commit**

```bash
git add src/actions/admissions.ts
git commit -m "feat: parse and persist registrationMode in all patient actions"
```

---

### Task 4: Registration Form UI

**Files:**
- Modify: `src/components/forms/registration-form.tsx:31-37` (add state)
- Modify: `src/components/forms/registration-form.tsx:112-116` (submit logic)
- Modify: `src/components/forms/registration-form.tsx:176-180` (hidden fields)
- Modify: `src/components/forms/registration-form.tsx:194-195` (add field after name)

- [ ] **Step 1: Add state for registrationMode**

In `src/components/forms/registration-form.tsx`, after the `handlingNote` state (line 34), add:

```typescript
  const [registrationMode, setRegistrationMode] = useState("AMBULANCE");
```

- [ ] **Step 2: Add to FormData in handleSubmit**

In `handleSubmit`, after `formData.set("handlingNote", handlingNote);` (line 116), add:

```typescript
    formData.set("registrationMode", registrationMode);
    if (registrationMode === "OTHER") {
      const otherInput = e.currentTarget.querySelector<HTMLInputElement>('[name="registrationModeOther"]');
      if (otherInput?.value) formData.set("registrationModeOther", otherInput.value);
    }
```

- [ ] **Step 3: Add hidden field**

After the existing hidden fields (line 180), add:

```tsx
          <input type="hidden" name="registrationMode" value={registrationMode} />
```

- [ ] **Step 4: Add mode selector after Patient Name field**

After the Patient Name `<div>` block (after line 194, before the Species + Sex grid), add:

```tsx
          {/* Mode of Registration */}
          <div className="space-y-1.5">
            <Label>
              Mode of Registration <span className="text-red-500">*</span>
            </Label>
            <Select
              value={registrationMode}
              onValueChange={(v) => setRegistrationMode(v ?? "AMBULANCE")}
            >
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WALK_IN">Walk-in</SelectItem>
                <SelectItem value="AMBULANCE">Always Care Ambulance</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {registrationMode === "OTHER" && (
            <div className="space-y-1.5">
              <Label htmlFor="registrationModeOther">Specify Mode</Label>
              <Input
                id="registrationModeOther"
                name="registrationModeOther"
                placeholder="e.g., Referred by XYZ clinic, Police brought in"
                className="h-12"
              />
            </div>
          )}
```

- [ ] **Step 5: Verify dev server renders correctly**

Run: `npx next dev` and open the registration form in a browser.

Expected: Mode of Registration selector appears after Patient Name, before Species/Sex. Selecting "Other" shows the text input. Default is "Always Care Ambulance".

- [ ] **Step 6: Commit**

```bash
git add src/components/forms/registration-form.tsx
git commit -m "feat: add registration mode selector to intake form"
```

---

### Task 5: Queries — Dashboard + Patient Shell

**Files:**
- Modify: `src/lib/dashboard-queries.ts:24-45` (interface)
- Modify: `src/lib/dashboard-queries.ts:210-225` (query select)
- Modify: `src/lib/patient-page-queries.ts:34-50` (query select)

- [ ] **Step 1: Update DashboardSecondaryData interface**

In `src/lib/dashboard-queries.ts`, in the `DashboardSecondaryData` interface's patient type (after `handlingNote: string;` on line 43), add:

```typescript
      registrationMode: string;
      registrationModeOther: string | null;
```

- [ ] **Step 2: Update getDashboardSecondaryData query select**

In the `getDashboardSecondaryData()` Prisma select for patient (after `handlingNote: true,` on line 224), add:

```typescript
            registrationMode: true,
            registrationModeOther: true,
```

- [ ] **Step 3: Update getPatientPageShell query select**

In `src/lib/patient-page-queries.ts`, in `getPatientPageShell()` patient select (after `handlingNote: true,` on line 48), add:

```typescript
          registrationMode: true,
          registrationModeOther: true,
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/dashboard-queries.ts src/lib/patient-page-queries.ts
git commit -m "feat: include registrationMode in dashboard and patient queries"
```

---

### Task 6: Pending Setup — Edit + Display

**Files:**
- Modify: `src/components/dashboard/pending-setup.tsx:34-55` (interface)
- Modify: `src/components/dashboard/pending-setup.tsx:78-93` (state in EditRegisteredSheet)
- Modify: `src/components/dashboard/pending-setup.tsx:100-105` (form state reset in useEffect)
- Modify: `src/components/dashboard/pending-setup.tsx:117-125` (edit sheet form)
- Modify: `src/components/dashboard/pending-setup.tsx:406` (display in card)

- [ ] **Step 1: Add import for REGISTRATION_MODE_LABELS**

In `src/components/dashboard/pending-setup.tsx`, update the import from constants (line 8) to:

```typescript
import { HANDLING_NOTE_LABELS, REGISTRATION_MODE_LABELS } from "@/lib/constants";
```

- [ ] **Step 2: Update RegisteredAdmission interface**

In the `RegisteredAdmission` interface, after `handlingNote: string;` (line 50), add:

```typescript
    registrationMode: string;
    registrationModeOther: string | null;
```

- [ ] **Step 3: Add state in EditRegisteredSheet**

After the `handlingNote` state (line 82-83), add:

```typescript
  const [registrationMode, setRegistrationMode] = React.useState(
    admission.patient.registrationMode
  );
```

- [ ] **Step 4: Add to useEffect reset**

In the `useEffect` that resets form state (line 86-93), after `setHandlingNote(admission.patient.handlingNote);`, add:

```typescript
      setRegistrationMode(admission.patient.registrationMode);
```

- [ ] **Step 5: Add to FormData in handleSubmit**

In `handleSubmit` (line 101-105), after `formData.set("handlingNote", handlingNote);`, add:

```typescript
    formData.set("registrationMode", registrationMode);
    if (registrationMode === "OTHER") {
      const otherInput = e.currentTarget.querySelector<HTMLInputElement>('[name="registrationModeOther"]');
      if (otherInput?.value) formData.set("registrationModeOther", otherInput.value);
    }
```

- [ ] **Step 6: Add hidden field + form controls in edit sheet**

In the edit form, after the hidden `handlingNote` input (line 273), add:

```tsx
            <input type="hidden" name="registrationMode" value={registrationMode} />
```

After the Handling Note `<div>` block (after the Select for handling note, before the Is Stray toggle), add:

```tsx
          <div className="space-y-1.5">
            <Label>Mode of Registration</Label>
            <Select
              value={registrationMode}
              onValueChange={(v) => setRegistrationMode(v ?? "AMBULANCE")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WALK_IN">Walk-in</SelectItem>
                <SelectItem value="AMBULANCE">Always Care Ambulance</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {registrationMode === "OTHER" && (
            <div className="space-y-1.5">
              <Label htmlFor="edit-registrationModeOther">Specify Mode</Label>
              <Input
                id="edit-registrationModeOther"
                name="registrationModeOther"
                defaultValue={admission.patient.registrationModeOther ?? ""}
              />
            </div>
          )}
```

- [ ] **Step 7: Update display in card**

In the card display section (around line 406), update the secondary info line. Replace:

```tsx
                {HANDLING_NOTE_LABELS[admission.patient.handlingNote] ?? "Standard"}
```

with:

```tsx
                {HANDLING_NOTE_LABELS[admission.patient.handlingNote] ?? "Standard"}
                {" · "}
                {REGISTRATION_MODE_LABELS[admission.patient.registrationMode] ?? admission.patient.registrationMode}
                {admission.patient.registrationMode === "OTHER" && admission.patient.registrationModeOther
                  ? ` (${admission.patient.registrationModeOther})`
                  : ""}
```

- [ ] **Step 8: Commit**

```bash
git add src/components/dashboard/pending-setup.tsx
git commit -m "feat: add registration mode to pending-setup edit and display"
```

---

### Task 7: Patient Header — Edit + Display

**Files:**
- Modify: `src/components/patient/patient-header.tsx:29-33` (import)
- Modify: `src/components/patient/patient-header.tsx:51-67` (interface)
- Modify: `src/components/patient/patient-header.tsx:85-94` (state + useEffect)
- Modify: `src/components/patient/patient-header.tsx:100-102` (handleSubmit)
- Modify: `src/components/patient/patient-header.tsx:124-126` (hidden field + form)
- Modify: `src/components/patient/patient-header.tsx:387` (label in main component)
- Modify: `src/components/patient/patient-header.tsx:533-544` (display section)

- [ ] **Step 1: Add import for REGISTRATION_MODE_LABELS**

In `src/components/patient/patient-header.tsx`, update the import from constants (lines 29-33) to include `REGISTRATION_MODE_LABELS`:

```typescript
import {
  CONDITION_CONFIG,
  HANDLING_NOTE_LABELS,
  REGISTRATION_MODE_LABELS,
  SPAY_NEUTER_STATUS_LABELS,
  WARD_CONFIG,
} from "@/lib/constants";
```

- [ ] **Step 2: Update PatientHeaderProps patient interface**

In the patient type inside `PatientHeaderProps` (after `handlingNote: string;` on line 65), add:

```typescript
      registrationMode: string;
      registrationModeOther: string | null;
```

- [ ] **Step 3: Add state + useEffect in EditPatientSheet**

After the `handlingNote` state (line 87), add:

```typescript
  const [registrationMode, setRegistrationMode] = useState(patient.registrationMode);
```

In the `useEffect` (line 89-94), after `setHandlingNote(patient.handlingNote);`, add:

```typescript
    setRegistrationMode(patient.registrationMode);
```

Also add `patient.registrationMode` to the useEffect dependency array.

- [ ] **Step 4: Add to handleSubmit FormData**

In `handleSubmit` (lines 96-116), after `formData.set("handlingNote", handlingNote);`, add:

```typescript
    formData.set("registrationMode", registrationMode);
    if (registrationMode === "OTHER") {
      const otherInput = e.currentTarget.querySelector<HTMLInputElement>('[name="registrationModeOther"]');
      if (otherInput?.value) formData.set("registrationModeOther", otherInput.value);
    }
```

- [ ] **Step 5: Add hidden field + form controls in EditPatientSheet**

After the hidden `handlingNote` input (line 126), add:

```tsx
          <input type="hidden" name="registrationMode" value={registrationMode} />
```

After the Handling Note Select block (after line 208, before the Stray toggle), add:

```tsx
          <div className="space-y-1.5">
            <Label>Mode of Registration</Label>
            <Select
              value={registrationMode}
              onValueChange={(v) => setRegistrationMode(v ?? "AMBULANCE")}
            >
              <SelectTrigger className="w-full h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WALK_IN">Walk-in</SelectItem>
                <SelectItem value="AMBULANCE">Always Care Ambulance</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {registrationMode === "OTHER" && (
            <div className="space-y-1.5">
              <Label htmlFor="ep-registrationModeOther">Specify Mode</Label>
              <Input
                id="ep-registrationModeOther"
                name="registrationModeOther"
                defaultValue={patient.registrationModeOther ?? ""}
                className="h-12"
              />
            </div>
          )}
```

- [ ] **Step 6: Add display in main PatientHeader component**

In the main component, compute the label after `handlingNoteLabel` (around line 387):

```typescript
  const registrationModeLabel =
    REGISTRATION_MODE_LABELS[patient.registrationMode] ?? patient.registrationMode;
  const registrationModeDisplay =
    patient.registrationMode === "OTHER" && patient.registrationModeOther
      ? `${registrationModeLabel} (${patient.registrationModeOther})`
      : registrationModeLabel;
```

In the info section (lines 533-544), add a `registrationModeDisplay` span. Before the existing `{patient.ambulancePersonName && (` line, add:

```tsx
              <span>Registration: {registrationModeDisplay}</span>
```

Also update the conditional wrapper. Replace:

```tsx
          {(spayNeuterLabel ||
            patient.ambulancePersonName ||
            patient.rescueLocation) && (
```

with:

```tsx
          {(spayNeuterLabel ||
            patient.registrationMode ||
            patient.ambulancePersonName ||
            patient.rescueLocation) && (
```

- [ ] **Step 7: Commit**

```bash
git add src/components/patient/patient-header.tsx
git commit -m "feat: add registration mode to patient header edit and display"
```

---

### Task 8: Tests

**Files:**
- Modify: `tests/intake-schema-contract.test.ts:18-28`
- Modify: `tests/intake-registration-contract.test.ts:26-32, 77-88, 90-98`
- Modify: `tests/intake-display-contract.test.ts:34-38`

- [ ] **Step 1: Update schema contract test**

In `tests/intake-schema-contract.test.ts`, in the `"patient schema stores the approved intake metadata"` test (line 18), add after the `handlingNote` assertion (line 25):

```typescript
  assert.match(schemaSource, /enum RegistrationMode[\s\S]*WALK_IN/);
  assert.match(
    schemaSource,
    /registrationMode\s+RegistrationMode\s+@default\(AMBULANCE\)/
  );
  assert.match(schemaSource, /registrationModeOther\s+String\?/);
```

- [ ] **Step 2: Update registration contract test**

In `tests/intake-registration-contract.test.ts`, in the `"registration defaults stray to false and captures the new intake fields"` test (line 26), add:

```typescript
  assert.match(registrationSource, /name="registrationMode"/);
  assert.match(registrationSource, /name="registrationModeOther"/);
```

In the `"registerPatient persists patient number and new intake metadata"` test (line 77), add:

```typescript
  assert.match(admissionsSource, /const registrationMode = validateRegistrationMode/);
  assert.match(admissionsSource, /registrationMode,/);
  assert.match(admissionsSource, /registrationModeOther,/);
```

In the `"registered-patient editing covers the new intake fields"` test (line 90), add:

```typescript
  assert.match(pendingSetupSource, /name="registrationMode"/);
  assert.match(admissionsSource, /editRegisteredPatient[\s\S]*registrationMode/);
  assert.match(admissionsSource, /updatePatient[\s\S]*registrationMode/);
```

- [ ] **Step 3: Update display contract test**

In `tests/intake-display-contract.test.ts`, in the `"patient shell queries include patient number, handling note, and viral risk"` test (line 34), add:

```typescript
  assert.match(patientQueriesSource, /registrationMode:\s*true/);
```

- [ ] **Step 4: Run all tests**

Run: `node --test tests/intake-*.test.ts`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/intake-schema-contract.test.ts tests/intake-registration-contract.test.ts tests/intake-display-contract.test.ts
git commit -m "test: add registration mode contract assertions"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `node --test tests/`

Expected: All tests pass.

- [ ] **Step 2: Build check**

Run: `npx next build 2>&1 | tail -20`

Expected: Build succeeds with no type errors.

- [ ] **Step 3: Manual smoke test**

Start dev server: `npx next dev`

Verify:
1. Registration form shows "Mode of Registration" after patient name, defaulting to "Always Care Ambulance"
2. Selecting "Other" shows the specify text input
3. Submitting a registration with "Walk-in" saves successfully
4. Pending setup card shows the registration mode
5. Editing a registered patient in pending-setup shows the mode selector with correct current value
6. Patient header for an active patient displays the registration mode
7. Editing patient info (doctor edit sheet) shows the mode selector

- [ ] **Step 4: Final commit if any fixups needed**

```bash
git add -A
git commit -m "fix: registration mode polish"
```
