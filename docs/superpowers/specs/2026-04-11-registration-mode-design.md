# Registration Mode Field — Design Spec

**Date:** 2026-04-11
**Status:** Approved

## Summary

Add a required "Mode of Registration" field to the patient intake form with three options: Walk-in, Always Care Ambulance, and Other (with free-text specification). This field captures how the patient arrived at the clinic.

## Requirements

- Field is **required** for all new registrations
- Three options: `WALK_IN`, `AMBULANCE`, `OTHER`
- When "Other" is selected, a free-text input appears to specify the mode
- Existing patients get `AMBULANCE` as the default (the clinic was built for ambulance rescue)
- All existing form fields remain unchanged and optional — no conditional show/hide
- Field is editable on registered patients (pending setup) and active patients (by doctors)
- Field is displayed on patient detail header and pending-setup dashboard cards

## Schema Changes

### New Enum

```prisma
enum RegistrationMode {
  WALK_IN
  AMBULANCE
  OTHER
}
```

### Patient Model — New Fields

```prisma
registrationMode      RegistrationMode @default(AMBULANCE)
registrationModeOther String?
```

- `@default(AMBULANCE)` backfills existing rows safely — no migration risk
- `registrationModeOther` is nullable, only populated when mode = `OTHER`

## Files to Change

### Source Files (9)

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add enum + 2 fields on Patient model |
| `src/lib/intake-fields.ts` | Add `REGISTRATION_MODES` array, `RegistrationModeValue` type, `validateRegistrationMode()` |
| `src/lib/constants.ts` | Add `REGISTRATION_MODE_LABELS` map |
| `src/components/forms/registration-form.tsx` | Add mode selector (Select component) + conditional Other text input, required. Hidden field for controlled value. State: `useState("AMBULANCE")` |
| `src/actions/admissions.ts` | Update 3 functions: `registerPatient()`, `editRegisteredPatient()`, `updatePatient()` — parse, validate, persist |
| `src/components/dashboard/pending-setup.tsx` | Update `RegisteredAdmission` interface, `EditRegisteredSheet` form, optionally display in card |
| `src/components/patient/patient-header.tsx` | Update `PatientHeaderProps` interface, `EditPatientSheet` form, display in info section |
| `src/lib/dashboard-queries.ts` | Update `DashboardSecondaryData` interface + `getDashboardSecondaryData()` Prisma select |
| `src/lib/patient-page-queries.ts` | Update `getPatientPageShell()` Prisma patient select |

### Test Files (3)

| File | Change |
|------|--------|
| `tests/intake-schema-contract.test.ts` | Assert `RegistrationMode` enum + fields exist in schema |
| `tests/intake-registration-contract.test.ts` | Assert form has `registrationMode` field, actions parse it, edit flows include it |
| `tests/intake-display-contract.test.ts` | Assert queries select `registrationMode` |

### Migration (1)

- Prisma migration adding the enum and two columns

### Files NOT Changed

| File | Reason |
|------|--------|
| `src/lib/management-patient-page-queries.ts` | Management shell query only selects basic fields; registration mode not displayed there |
| `src/lib/validators.ts` | Validator goes in `intake-fields.ts` per existing pattern |
| `prisma/seed.ts` | `@default(AMBULANCE)` handles seed data automatically |

## Form Placement

The "Mode of Registration" selector goes **at the top of the form**, immediately after the Patient Name field and before Species/Sex. Rationale: it describes how the patient arrived, which is the first thing staff should record.

## UI Details

- Uses the existing `Select` component (same as Species, Sex, Handling Note)
- When "Other" is selected, an `Input` appears below with placeholder "e.g., Referred by XYZ clinic, Police brought in"
- Required: form cannot submit without a selection
- Client validation: check `registrationMode` is set before `handleSubmit` proceeds
- Server validation: `validateRegistrationMode()` throws on invalid values (same pattern as `validateHandlingNote`)

## Display

### Patient Header (`patient-header.tsx`)

Shown in the info section alongside ambulance person name and rescue location:

```
Registration: Walk-in
```

or

```
Registration: Always Care Ambulance · Ambulance: Rahul
```

or

```
Registration: Other (Police brought in)
```

### Pending Setup Card (`pending-setup.tsx`)

Shown in the secondary info line alongside handling note:

```
IPD-000042 · Standard · Walk-in
```

## Risk Analysis

| Risk | Status |
|------|--------|
| Required field breaks existing rows | Safe — `@default(AMBULANCE)` backfills |
| Old form submissions without the field | Safe — Prisma uses DB default |
| `updatePatient` omits field on edit | Safe — Prisma `update` preserves existing value |
| `registrationModeOther` null when mode != OTHER | Safe — nullable String |
| TypeScript type mismatches | Caught at compile time |
| Seed data | Default handles it |
