# Internal Clinical Performance Design

**Problem**

The internal clinical flow still feels slow in live use even after the first patient-route refactor. The most obvious warm-path bottlenecks are:

- [`src/app/(app)/page.tsx`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/app/(app)/page.tsx), which loads a broad admission graph for the dashboard and derives all summary and queue state from one expensive query.
- [`src/app/(app)/schedule/page.tsx`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/app/(app)/schedule/page.tsx), which loads all active admissions with treatment, feeding, and bath relations before grouping tasks server-side.
- [`src/app/api/notifications/route.ts`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/app/api/notifications/route.ts), which recomputes a full operational notification snapshot on each request while the client polls.
- The shared internal shell in [`src/app/(app)/layout.tsx`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/app/(app)/layout.tsx), [`src/components/layout/top-header.tsx`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/components/layout/top-header.tsx), and [`src/components/layout/critical-banner.tsx`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/components/layout/critical-banner.tsx), where notifications affect multiple mounted surfaces.

The app needs to become materially faster without retraining clinic staff or risking stale clinical truth after writes.

**Goals**

- Make the internal clinical flow feel fast on warm paths: dashboard, patient pages, schedule, and notifications.
- Preserve the current clinic UI structure and workflows so staff muscle memory remains intact.
- Use short-lived cached reads where safe, but ensure immediate correctness after clinical writes.
- Replace broad over-fetching with focused read models that only select the fields each surface actually renders.

**Non-Goals**

- No management-surface work in this pass.
- No major redesign of the clinic UI, navigation, or information architecture.
- No optimistic clinical UI for meds, feedings, vitals, baths, or admission state.
- No admin, archive, or isolation-page optimization in this pass beyond any incidental shared-helper reuse.

**Decision**

Adopt a safety-first performance layer for the internal clinical flow:

1. Enable Next 16 Cache Components in `next.config.ts`.
2. Cache only targeted server read-model functions using `'use cache'`, `cacheLife`, and `cacheTag`.
3. Keep request-specific shells dynamic where they depend on session or search params.
4. Invalidate cached clinical reads immediately from Server Actions using `updateTag(...)` for read-your-own-writes behavior.
5. Preserve background freshness for passive reads using short cache lifetimes and targeted client refresh on visible surfaces.

This design optimizes expensive shared reads without letting recent clinical writes disappear behind stale cache entries.

## Architecture

### 1. Read Model Split

Replace broad route-local Prisma queries with focused server read-model functions under `src/lib/` for:

- dashboard summary
- dashboard patient queue
- dashboard setup/isolation side data
- schedule meds snapshot
- schedule feedings snapshot
- schedule baths snapshot
- notifications snapshot by role
- patient shell and patient tab-specific reads

Each read model should:

- accept only the minimal runtime arguments it needs
- select only fields that the caller renders
- keep runtime APIs such as `cookies()` outside cached scopes
- be independently testable

### 2. Dynamic Shell, Cached Data

The internal layout and route entrypoints should stay request-aware where they need authenticated session state. The expensive shared data fetches should move into cached functions beneath those dynamic shells.

This means:

- [`src/app/(app)/layout.tsx`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/app/(app)/layout.tsx) remains request-aware because of session checks.
- Dashboard, schedule, notifications, and patient routes still read session and params at the page/layout layer.
- Cached functions receive explicit primitive arguments such as `role`, `admissionId`, `todayKey`, or `wardFilter` instead of reading request APIs internally.

### 3. Cache Lifetime Strategy

Define explicit short-lived cache profiles in `next.config.ts`:

- `clinicalLive`: `stale=30s`, `revalidate=30s`, `expire=300s`
- `clinicalWarm`: `stale=60s`, `revalidate=60s`, `expire=600s`

Use them as follows:

- dashboard shared reads: `clinicalLive`
- schedule shared reads: `clinicalLive`
- notifications snapshot: `clinicalLive`
- patient shell and tab reads: `clinicalWarm`, plus immediate invalidation on relevant writes

The design favors short-lived, aggressively invalidated cache entries rather than long-lived cache plus frequent full rerenders.

### 4. Cache Tag Taxonomy

Use explicit tags so writes can invalidate only the data they truly affect.

Shared tags:

- `dashboard:summary`
- `dashboard:queue`
- `dashboard:setup`
- `schedule:meds`
- `schedule:feedings`
- `schedule:baths`
- `notifications:doctor`
- `notifications:admin`
- `notifications:paravet`

Patient tags:

- `patient:{id}:shell`
- `patient:{id}:vitals`
- `patient:{id}:meds`
- `patient:{id}:food`
- `patient:{id}:notes`
- `patient:{id}:labs`
- `patient:{id}:bath`
- `patient:{id}:photos`
- `patient:{id}:isolation`
- `patient:{id}:logs`

If a patient-specific read contributes to a shared summary surface, both the patient tag and the relevant shared tag must be attached or invalidated.

## Route Plans

### Dashboard (`/`)

Refactor [`src/app/(app)/page.tsx`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/app/(app)/page.tsx) into three focused reads:

- `getDashboardSummary()`
- `getDashboardQueue({ wardFilter })`
- `getDashboardSecondaryData()`

Summary should compute:

- active admissions
- critical count
- pending meds count
- upcoming feedings count
- baths due count

Queue should fetch only the fields rendered by [`src/components/dashboard/patient-card.tsx`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/components/dashboard/patient-card.tsx), instead of hydrating broad nested relations that are only partially used.

Secondary data should cover:

- pending registered admissions for setup
- isolation alert inputs

The current visible layout stays intact. The implementation changes the query shape and cache strategy, not the clinic-facing composition.

### Schedule (`/schedule`)

Refactor [`src/app/(app)/schedule/page.tsx`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/app/(app)/schedule/page.tsx) into separate read models:

- `getScheduleMedTasks(today)`
- `getScheduleFeedingTasks(today)`
- `getScheduleBathTasks()`

Each should select only the fields used by:

- [`src/components/schedule/schedule-med-row.tsx`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/components/schedule/schedule-med-row.tsx)
- [`src/components/schedule/schedule-feeding-row.tsx`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/components/schedule/schedule-feeding-row.tsx)
- [`src/components/schedule/bath-due-section.tsx`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/components/schedule/bath-due-section.tsx)

The page keeps the existing grouping and presentation model, but it should no longer require a single broad admission graph to render.

### Notifications (`/api/notifications`)

Refactor [`src/app/api/notifications/route.ts`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/app/api/notifications/route.ts) so the expensive notification computation lives in a cached server helper:

- `getNotificationsSnapshot(role, nowKey)`

The route handler should:

- authenticate the session
- derive the role
- call the cached snapshot function
- return the filtered notification payload

The client provider in [`src/components/layout/notification-provider.tsx`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/components/layout/notification-provider.tsx) should remain familiar but become smarter:

- refresh on mount
- refresh when the document becomes visible again
- poll only while the tab is visible

This keeps the bell and critical banner behavior recognizable while reducing unnecessary DB work.

### Patient Detail (`/patients/[admissionId]`)

Keep the targeted tab-loading structure already established in [`src/app/(app)/patients/[admissionId]/page.tsx`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/app/(app)/patients/%5BadmissionId%5D/page.tsx) and [`src/lib/patient-page-data.ts`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/lib/patient-page-data.ts).

Extend it by tagging:

- the shell read
- each tab read
- any shared patient photo/profile helpers

The `logs` tab remains the intentionally heavier path because it needs broader historical context, but it should still use its own explicit tag rather than relying only on path-level invalidation.

## Mutation Invalidation Model

Clinical writes must invalidate affected cache tags immediately using `updateTag(...)` inside Server Actions. Path-level revalidation can stay where route shells need it, but tag invalidation becomes the primary source of correctness.

### Medication writes

Actions in [`src/actions/medications.ts`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/actions/medications.ts) should invalidate:

- `patient:{id}:meds`
- `patient:{id}:logs`
- `dashboard:summary`
- `dashboard:queue`
- `schedule:meds`
- all relevant `notifications:*` tags

### Feeding writes

Actions in [`src/actions/feeding.ts`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/actions/feeding.ts) should invalidate:

- `patient:{id}:food`
- `patient:{id}:logs`
- `dashboard:summary`
- `schedule:feedings`
- all relevant `notifications:*` tags

### Vitals writes

Actions in [`src/actions/vitals.ts`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/actions/vitals.ts) should invalidate:

- `patient:{id}:vitals`
- `patient:{id}:logs`
- `dashboard:queue`
- all relevant `notifications:*` tags

### Bath writes

Actions in [`src/actions/baths.ts`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/actions/baths.ts) should invalidate:

- `patient:{id}:bath`
- `patient:{id}:logs`
- `dashboard:summary`
- `dashboard:queue`
- `schedule:baths`
- all relevant `notifications:*` tags

### Notes, labs, media, isolation

Actions in:

- [`src/actions/notes.ts`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/actions/notes.ts)
- [`src/actions/labs.ts`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/actions/labs.ts)
- [`src/actions/patient-media.ts`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/actions/patient-media.ts)
- [`src/actions/isolation.ts`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/actions/isolation.ts)

should invalidate the relevant patient tab tags and any shared notification or dashboard tags if the changed data affects summary state.

### Admission/setup/condition/ward writes

Actions in [`src/actions/admissions.ts`](/Users/kaivan108icloud.com/Documents/IPD-%20management/src/actions/admissions.ts) should invalidate:

- `patient:{id}:shell` when a patient context exists
- `dashboard:summary`
- `dashboard:queue`
- `dashboard:setup`
- relevant schedule tags if the admission is active
- relevant notifications tags

## UX Policy

- Keep the current clinic-facing layout and navigation model.
- Avoid retraining design changes.
- Allow only light visual polish that improves perceived speed without altering habits:
  - cleaner loading/empty states
  - less janky pending feedback
  - better visual stability while cached reads refresh

No section of this work should require staff to learn a new dashboard concept.

## Testing

Add automated coverage for:

- dashboard query shaping
- schedule query shaping
- notification snapshot filtering by role
- patient tag naming and load-plan stability
- mutation-to-tag invalidation helpers

Verification should include:

- targeted `node:test` or equivalent unit tests for read-model helpers
- typecheck
- targeted lint on changed files
- live login verification
- live timing checks for dashboard, patient tabs, schedule, and notifications before and after the refactor

## Rollout

Implement in this order:

1. Shared performance helpers and cache-tag taxonomy
2. Mutation invalidation helpers
3. Dashboard read-model refactor
4. Schedule read-model refactor
5. Notifications snapshot refactor and client polling improvements
6. Patient-route tag integration
7. Live verification and timing comparison

This order delivers the biggest user-visible speed wins early while keeping the clinical correctness model intact from the start.

## Success Criteria

- The internal clinical dashboard no longer takes multiple seconds on warm reads due to a single oversized query.
- Schedule and notifications stop recomputing full operational state unnecessarily.
- Patient tabs remain targeted and immediately reflect successful writes.
- The existing clinic UI and workflows remain familiar.
- Cached reads never hide successful clinical writes from the next request after a Server Action completes.
