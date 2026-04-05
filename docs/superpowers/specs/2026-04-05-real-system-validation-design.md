# Real System Validation Design

**Problem**

The repo has good targeted unit and contract coverage, but it does not yet have one trusted real-environment validation flow that proves the product works end-to-end against the live Neon database, the real Google Drive integration, the real management push flow, and the actual browser UI. The user wants a single aggressive test system that exercises the whole application with production-like behavior, keeps all generated artifacts for later review, and avoids accidental mutation of any non-test clinic data.

**Decision**

Build one primary executable system-validation harness centered on a single entrypoint test file, [`tests/real-system-validation.test.ts`](/Users/kaivan108icloud.com/Documents/IPD- management/tests/real-system-validation.test.ts), backed by a small set of focused support helpers. The harness will run against the real connected database, use the real Google Drive integration, enable real web-push locally with temporary VAPID keys, drive the application through real browser sessions for every important role, omit WhatsApp delivery entirely, and preserve every created artifact for later purge.

**Scope**

- Validate the app against the real Neon database configured in the current environment.
- Use the real Google Drive upload, media, and rename-on-delete flows.
- Enable and verify real management web-push delivery locally for the test run.
- Exercise browser-driven flows for doctor, paravet, admin, and management roles.
- Verify major product areas: auth, dashboard, pending setup, registration, doctor-only clinical setup, patient detail tabs, schedule, isolation, archive-adjacent flows, admin, management read-only flows, media, notifications, and cron-alert-triggering behavior.
- Keep all tagged test data and external artifacts after the run for later review and explicit purge.

**Out of Scope**

- Real WhatsApp delivery through Interakt.
- Automatic cleanup or rollback at the end of the run.
- Any mutation of pre-existing non-tagged production records.

**Architecture**

The system-validation harness will use `node:test` as the outer runner so it fits the current repository test style. A single top-level test will orchestrate ordered phases: preflight, tagged fixture creation, browser auth flows, internal-staff write flows, dashboard and patient-page verification, isolation verification, management verification, real push subscription and delivery, and final reporting.

The main entrypoint will delegate to focused support modules so failures stay diagnosable. A run-context helper will generate a unique run id, record created artifacts, and persist the final report. Fixture helpers will create test-owned data in the live database. Browser helpers will handle login, navigation, upload, and push-subscription flows. Drive helpers will verify file existence and renamed-deleted behavior. Push helpers will generate temporary VAPID keys and patch `.env.local` only for the local environment that is running the test harness.

**Run Identity And Test Ownership**

Every run will generate a unique id in the form `TEST-RUN-YYYY-MM-DD-<timestamp>`. That id must appear in all test-owned data so the harness can prove ownership and make later purge safe. The run id will be embedded in patient names, diagnosis text, note content, diet instructions, lab names, media filenames, created staff display names, created cage numbers where needed, and both machine-readable and human-readable report output.

The harness may read shared/global views to verify behavior, but it must only create, update, archive, delete, or otherwise mutate records that it created and tagged in the same run, or explicitly tagged admin fixtures created for that purpose. It must never mutate any pre-existing patient, admission, staff, cage, media, subscription, or note that does not contain the current run id.

**Live Data Strategy**

The tagged fixture set should stay small but expressive:

1. One tagged patient in `REGISTERED` state to validate pending clinical setup.
2. One tagged active general-ward patient to validate the main internal workflows.
3. One tagged active isolation patient to validate isolation-specific behavior.
4. One management browser subscription target for real push verification.
5. A minimal tagged set of admin-only objects, such as temporary staff and cages, for destructive admin flows.

The harness may log in with existing real seeded staff credentials for the browser role flows because that exercises the application honestly. For admin destructive coverage, it should create additional tagged staff and cage fixtures and mutate only those tagged fixtures.

**Coverage Matrix**

The harness will treat the following as required coverage:

1. `Auth and role routing`
   Validate successful login for doctor, paravet, admin, and management. Internal staff should land on `/`, management should land on `/management`, and unauthenticated requests should be rejected where expected.

2. `Role permissions`
   Validate that management is read-only, internal staff have write access, and doctor/admin-only clinical setup and treatment-edit actions remain enforced in both UI visibility and actual action behavior.

3. `Patient registration and doctor-only setup`
   Create a tagged patient, verify it appears in pending setup, complete clinical setup as doctor, and verify the admission becomes active with the correct ward, cage, condition, and attending doctor.

4. `Main dashboard`
   Verify summary cards, pending setup visibility, grouped active-patient display, ward filtering, and refresh behavior after mutations.

5. `Patient detail page`
   Exercise the important tabs for tagged admissions: `vitals`, `meds`, `food`, `notes`, `labs`, `bath`, `isolation`, `logs`, and `photos`. Each write should appear in the correct tab and propagate to the other views that rely on the same data.

6. `Medication and schedule workflows`
   Prescribe medications as doctor, mark doses as administered or skipped as internal staff, and verify the changes surface correctly on the patient page, daily schedule, logs timeline, dashboard-derived states, and overdue logic.

7. `Diet and feeding workflows`
   Create and update diet plans, log feedings, and verify food-tab and schedule behavior.

8. `Vitals and critical-state workflows`
   Record normal and abnormal vitals and verify patient detail updates, management visibility, notification-snapshot consequences, and cron-alert eligibility.

9. `Notes, labs, baths, fluids, and isolation`
   Add representative records for each of these areas and verify they appear in the expected patient tabs, timeline/log views, and isolation-specific surfaces.

10. `Drive-backed media`
    Perform real upload init, real chunk upload, real Drive file creation, real media proxy retrieval, DB media persistence, profile-photo assignment, and delete behavior including Drive rename-to-deleted behavior.

11. `Isolation ward page`
    Validate PPE rendering, disinfection timing and overdue warning behavior, and logging disinfection against tagged isolation data.

12. `Management dashboard and management patient detail`
    Validate read-only management access, overdue med/feeding visibility, critical-case visibility, recent activity, overview/media/logs views, and the absence of write controls.

13. `Real push`
    Generate temporary VAPID keys locally, subscribe a real management browser session, trigger a real management push event, and verify actual delivery in the browser.

14. `Admin flows`
    Create tagged staff, toggle active state, reset passwords, soft-delete tagged staff, create tagged cages, toggle cage state, and delete tagged cages, all without touching non-tagged records.

15. `Report generation`
    Persist a complete report of created artifacts, visited URLs, results, and purge checklist.

**Drive Strategy**

The media portion of the run will use explicit tagged filenames such as `TEST-RUN-...-profile.jpg` and Drive folder segments that include the current run id. This keeps test artifacts attributable. Delete-path verification will rely on the application’s real behavior of renaming files to `DELETED - ...` rather than performing permanent irreversible removal through the harness. The test will confirm both DB-side media behavior and Drive-side side effects.

**Push Strategy**

The harness will enable real push locally by generating temporary VAPID keys and patching `.env.local` if the keys are absent. The application will then expose a real public key through the push subscription route, and a management browser session will create a real subscription. The harness will record the resulting subscription endpoint and verify actual delivery after triggering a qualifying management push event. Push configuration changes are limited to the local environment running the harness and do not imply any change to deployed infrastructure.

**WhatsApp Strategy**

WhatsApp delivery is intentionally omitted. The current environment has no configured Interakt key or alert numbers, so real delivery would add risk with no extra confidence. The harness may still exercise code paths whose other side effects are meaningful, but it must not attempt to configure or send WhatsApp traffic.

**Preflight Guardrails**

Before creating any test-owned data, the harness must verify all of the following:

- Database connectivity works against the configured `DATABASE_URL`.
- Required auth and application secrets exist for local app execution.
- Google Drive credentials exist and the configured base folder is reachable.
- `.env.local` is writable if temporary push configuration must be added.
- The app can start locally and serve requests successfully.
- The environment still appears quiescent enough that preserving tagged test artifacts is acceptable.

If any preflight check fails, the run must stop immediately before creating artifacts.

**Failure Model**

The harness is intentionally fail-fast and non-cleaning. If a phase fails, the run should stop, preserve all artifacts already created, write a partial report, and expose the exact failing step and last known state. There should be no automatic rollback, no best-effort purge, and no guessing about whether a record is safe to delete. The report is the source of truth for investigation and later cleanup.

**Harness Structure**

The harness will consist of:

- [`tests/real-system-validation.test.ts`](/Users/kaivan108icloud.com/Documents/IPD- management/tests/real-system-validation.test.ts)
  Main executable validation entrypoint and ordered phase orchestrator.
- [`tests/support/real-run-context.ts`](/Users/kaivan108icloud.com/Documents/IPD- management/tests/support/real-run-context.ts)
  Run id generation, artifact tracking, evidence capture, and report writing.
- [`tests/support/real-fixtures.ts`](/Users/kaivan108icloud.com/Documents/IPD- management/tests/support/real-fixtures.ts)
  Safe tagged fixture creation in the live database.
- [`tests/support/real-browser.ts`](/Users/kaivan108icloud.com/Documents/IPD- management/tests/support/real-browser.ts)
  Browser login, navigation, upload, and push-subscription helpers.
- [`tests/support/real-drive.ts`](/Users/kaivan108icloud.com/Documents/IPD- management/tests/support/real-drive.ts)
  Drive verification helpers.
- [`tests/support/real-push.ts`](/Users/kaivan108icloud.com/Documents/IPD- management/tests/support/real-push.ts)
  Temporary local VAPID setup and push preflight helpers.
- [`tests/fixtures/test-image.jpg`](/Users/kaivan108icloud.com/Documents/IPD- management/tests/fixtures/test-image.jpg)
  Known-good image fixture for real upload and profile-photo coverage.

The top-level ordered phases will be:

1. `preflight`
2. `fixture creation`
3. `browser auth flows`
4. `internal-staff workflows`
5. `dashboard and patient-page verification`
6. `isolation workflow`
7. `management workflow`
8. `push trigger and verification`
9. `report writeout`

**Pass Criteria**

The run is considered successful only if:

- preflight passes completely,
- all four role flows pass,
- tagged patient lifecycle coverage passes,
- real media upload/proxy/profile/delete coverage passes,
- real push subscription and delivery pass,
- no non-tagged records are mutated,
- and the final report is complete.

Any failure in these categories fails the run.

**Reporting**

The harness will emit both machine-readable and human-readable output:

- [`test-results/real-system/<run-id>.json`](/Users/kaivan108icloud.com/Documents/IPD- management/test-results/real-system)
  Structured summary, phase results, artifact inventory, and failure metadata.
- [`test-results/real-system/<run-id>.md`](/Users/kaivan108icloud.com/Documents/IPD- management/test-results/real-system)
  Human-readable summary, notable evidence, and explicit purge checklist.

Each report must include:

- run id,
- start and end time,
- environment summary,
- phase-by-phase pass/fail status,
- every created database id,
- every created or mutated Drive file id,
- push subscription details relevant to cleanup,
- tested URLs and key observations,
- failure details if any,
- and a complete later purge checklist.

**Planned Execution Command**

```bash
node --import tsx --test tests/real-system-validation.test.ts
```

If browser automation requires a local dev server during execution, the main harness will start or verify the app locally and then drive the browser against `http://localhost:3000`.

**Success Criteria**

- The clinic can trust one aggressive executable harness to validate the live application stack.
- The run proves real DB writes, real Drive integration, real browser flows, and real management push delivery.
- All generated test artifacts remain clearly owned, reviewable, and purgable later.
- The harness does not mix test behavior into non-tagged production data.
