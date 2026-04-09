# Intake And Clinical Field Additions Design

## Overview

Keep the current two-step workflow unchanged:

1. Intake (`Register New Patient`)
2. Clinical setup (`Complete Admission`)

This change only adds fields to the existing forms and data model. It does not merge the screens, move ownership between roles, or introduce a new workflow.

## Approved Scope

### Intake form additions

Add the following to the intake form in `Register New Patient`:

- `isStray` default changes from `true` to `false`
- `locationName` as an optional free-text field
- `locationGpsCoordinates` as an optional free-text field
- `locationPhoto` as an optional uploaded photo
- `ambulancePersonName` as an optional free-text field
- `handlingNote` as a required choice:
  - `STANDARD`
  - `GENTLE`
  - `ADVANCED_HANDLER_ONLY`
- auto-generated patient record number in the format `IPD-000123`

Do not add a second chief complaint field. The existing chief complaint field remains where it already exists.

### Clinical setup additions

Add the following to the doctor-only clinical setup form:

- `viralRisk` as a required yes/no field
- `spayNeuterStatus` as an optional status field with values:
  - `UNKNOWN`
  - `INTACT`
  - `SPAYED_NEUTERED`
- `abcCandidate` as an optional checkbox

## Data Model

### Patient-level fields

These belong to the patient because they describe intake identity or rescue context rather than one doctor setup event:

- `patientNumber`
- `locationName`
- `locationGpsCoordinates`
- `ambulancePersonName`
- `handlingNote`

Existing fields kept in place:

- `isStray`
- `rescueLocation`
- `rescuerInfo`

`rescueLocation` should be treated as the existing legacy location field and replaced in the UI by the new location inputs. Existing data should remain readable and updatable during migration.

### Admission-level fields

These belong to the admission because they are medical or triage decisions recorded during clinical setup:

- `viralRisk`
- `spayNeuterStatus`
- `abcCandidate`

## Patient Number Generation

Generate a clinic record number automatically during intake registration.

Rules:

- format is `IPD-` plus a zero-padded 6-digit sequence
- first generated value is `IPD-000001`
- number is created server-side during successful patient creation
- number must be unique
- number is never edited manually in the UI

Implementation note:

- use a dedicated counter source instead of deriving the next number from total patient count, so deletions or concurrent registrations do not create duplicates

## Form Behavior

### Intake

- intake remains available to any user with current registration access
- `handlingNote` is required so staff see the handling level immediately
- `locationName`, `locationGpsCoordinates`, `locationPhoto`, and `ambulancePersonName` are shown directly on intake and are not gated by the stray toggle
- `locationName`, `locationGpsCoordinates`, and `locationPhoto` are all optional
- `locationPhoto` uses the existing patient media upload flow
- `isStray` starts off as `false`

### Clinical setup

- clinical setup remains doctor-only
- `viralRisk` is required because it affects triage and ward handling
- `spayNeuterStatus` is optional
- `abcCandidate` is optional

## Media Handling

`locationPhoto` should use the existing upload pipeline rather than a new binary field in Prisma.

Store it as patient media and mark it in a way the app can distinguish it from general profile or progress media, either by:

- a new patient media category field, or
- a stable file naming convention plus a dedicated save path

The preferred implementation is a media category field because it is easier to query and render safely later.

## Validation

### Intake validation

- patient name remains required
- handling note is required
- location fields are optional
- ambulance person name is optional

### Clinical setup validation

- existing required setup fields remain required
- viral risk is additionally required
- spay/neuter status is optional
- ABC candidate is optional

## UI Surface Updates

After creation, show the patient record number anywhere the app shows core patient identity, especially:

- pending setup cards
- patient header
- management patient views where practical

This is a display addition only. It should not change routing or lookup behavior in this pass.

## Testing

Add coverage for:

- intake registration with `isStray` defaulting to `false`
- successful patient number generation in the `IPD-000123` format
- patient number uniqueness across multiple registrations
- intake submission with handling note and optional location fields
- clinical setup requiring viral risk
- clinical setup saving spay/neuter status and ABC candidate
- location photo upload continuing to work through the current media pipeline

## Out Of Scope

- moving chief complaint into intake
- merging intake and clinical setup into one screen
- changing search, routing, or barcode behavior to use patient number
- adding map widgets, GPS capture APIs, or geocoding
- changing ambulance or rescuer assignment workflows beyond storing the new fields
