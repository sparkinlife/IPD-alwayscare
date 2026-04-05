import test from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db";
import { timed, createPerfCollector } from "../support/real-timing";
import { toUTCDate, getTodayIST } from "@/lib/date-utils";

const RUN_ID = `SCENARIO-${Date.now()}`;
const perf = createPerfCollector();

function tag(label: string) {
  return `${RUN_ID} ${label}`;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function createPatientWithAdmission(name: string, opts: {
  ward: string;
  cageNumber: string;
  condition: string;
  doctorId: string;
}) {
  return db.patient.create({
    data: {
      name: tag(name),
      species: "DOG",
      sex: "UNKNOWN",
      isStray: true,
      admissions: {
        create: {
          status: "ACTIVE",
          ward: opts.ward as any,
          cageNumber: opts.cageNumber,
          diagnosis: tag(`diagnosis for ${name}`),
          condition: opts.condition as any,
          attendingDoctor: "Test Doctor",
          admittedById: opts.doctorId,
        },
      },
    },
    include: { admissions: { take: 1, orderBy: { createdAt: "desc" } } },
  });
}

async function checkCageOccupied(ward: string, cageNumber: string, excludeAdmissionId?: string) {
  return db.admission.findFirst({
    where: {
      ward: ward as any,
      cageNumber,
      status: "ACTIVE",
      deletedAt: null,
      patient: { deletedAt: null },
      ...(excludeAdmissionId ? { id: { not: excludeAdmissionId } } : {}),
    },
    select: { id: true, patient: { select: { name: true } } },
  });
}

async function createFullPatient(name: string, doctorId: string, cageNumber: string) {
  const patient = await createPatientWithAdmission(name, {
    ward: "GENERAL",
    cageNumber,
    condition: "STABLE",
    doctorId,
  });
  const admissionId = patient.admissions[0].id;

  const [note, vital, med, bath, lab, diet] = await Promise.all([
    db.clinicalNote.create({
      data: { admissionId, category: "OBSERVATION", content: tag("note"), recordedById: doctorId },
    }),
    db.vitalRecord.create({
      data: { admissionId, temperature: 38.5, heartRate: 100, recordedById: doctorId },
    }),
    db.treatmentPlan.create({
      data: {
        admissionId, drugName: tag("Drug"), dose: "10mg", route: "PO",
        frequency: "BID", scheduledTimes: ["08:00", "20:00"], isActive: true, createdById: doctorId,
      },
    }),
    db.bathLog.create({
      data: { admissionId, bathedById: doctorId },
    }),
    db.labResult.create({
      data: { admissionId, testType: "CBC", testName: tag("CBC"), result: "Normal", createdById: doctorId },
    }),
    db.dietPlan.create({
      data: {
        admissionId, dietType: tag("Diet"), instructions: "Test diet", isActive: true, createdById: doctorId,
        feedingSchedules: {
          create: { scheduledTime: "08:00", foodType: "Test food", portion: "100g" },
        },
      },
      include: { feedingSchedules: true },
    }),
  ]);

  // Create a feeding log for the diet
  let feedingLog = null;
  if (diet.feedingSchedules[0]) {
    feedingLog = await db.feedingLog.create({
      data: {
        feedingScheduleId: diet.feedingSchedules[0].id,
        date: toUTCDate(getTodayIST()),
        status: "EATEN",
        loggedById: doctorId,
      },
    });
  }

  return { patient, admissionId, note, vital, med, bath, lab, diet, feedingLog };
}

// ── Get a doctor ID ─────────────────────────────────────────────────────────

let doctorId: string;

test("scenario setup: find doctor", async () => {
  const doctor = await db.staff.findFirst({
    where: { role: "DOCTOR", isActive: true, deletedAt: null },
    select: { id: true },
  });
  assert.ok(doctor, "Need at least one active doctor");
  doctorId = doctor.id;
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 1: Cage Reuse After Discharge
// ═══════════════════════════════════════════════════════════════════════════

test("scenario 1: cage reuse after discharge", async () => {
  const SCENARIO = "1-cage-discharge";
  const cage = `SD-${RUN_ID.slice(-6)}`;

  // Create patient A in cage
  const a = await timed("create patient A", () =>
    createPatientWithAdmission("Discharge-A", { ward: "GENERAL", cageNumber: cage, condition: "STABLE", doctorId }),
  );
  perf.recordTimed(SCENARIO, a, "pass", `patient ${a.result.id} in cage ${cage}`);

  // Verify cage is occupied
  const t1 = await timed("check cage occupied", () => checkCageOccupied("GENERAL", cage));
  assert.ok(t1.result, "Cage should be occupied by patient A");
  perf.recordTimed(SCENARIO, t1, "pass", `cage occupied by ${t1.result!.patient.name}`);

  // Discharge patient A
  const t2 = await timed("discharge patient A", async () => {
    await db.admission.update({
      where: { id: a.result.admissions[0].id },
      data: { status: "DISCHARGED", dischargeDate: new Date() },
    });
    // Deactivate plans like the real action does
    await db.treatmentPlan.updateMany({ where: { admissionId: a.result.admissions[0].id, isActive: true }, data: { isActive: false } });
    await db.dietPlan.updateMany({ where: { admissionId: a.result.admissions[0].id, isActive: true }, data: { isActive: false } });
  });
  perf.recordTimed(SCENARIO, t2, "pass", "discharged");

  // Verify cage is now free (discharge changes status to DISCHARGED, cage check only looks for ACTIVE)
  const t3 = await timed("check cage free after discharge", () => checkCageOccupied("GENERAL", cage));
  assert.equal(t3.result, null, "Cage should be free after discharge");
  perf.recordTimed(SCENARIO, t3, "pass", "cage free");

  // Create patient B in same cage
  const b = await timed("create patient B in same cage", () =>
    createPatientWithAdmission("Discharge-B", { ward: "GENERAL", cageNumber: cage, condition: "STABLE", doctorId }),
  );
  perf.recordTimed(SCENARIO, b, "pass", `patient ${b.result.id} reused cage ${cage}`);

  // Verify B is ACTIVE in that cage
  const t4 = await timed("verify patient B active", async () =>
    db.admission.findFirst({ where: { id: b.result.admissions[0].id, status: "ACTIVE", cageNumber: cage } }),
  );
  assert.ok(t4.result, "Patient B should be ACTIVE in the cage");
  perf.recordTimed(SCENARIO, t4, "pass", "cage reuse confirmed after discharge");
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 2: Cage Reuse After Archive
// ═══════════════════════════════════════════════════════════════════════════

test("scenario 2: cage reuse after archive", async () => {
  const SCENARIO = "2-cage-archive";
  const cage = `SA-${RUN_ID.slice(-6)}`;

  // Create patient C
  const c = await timed("create patient C", () =>
    createPatientWithAdmission("Archive-C", { ward: "GENERAL", cageNumber: cage, condition: "STABLE", doctorId }),
  );
  perf.recordTimed(SCENARIO, c, "pass", `patient ${c.result.id} in cage ${cage}`);

  // Archive patient C (soft delete)
  const t1 = await timed("archive patient C", async () => {
    const now = new Date();
    await db.admission.updateMany({
      where: { patientId: c.result.id, deletedAt: null },
      data: { deletedAt: now },
    });
    await db.patient.update({ where: { id: c.result.id }, data: { deletedAt: now } });
    await db.treatmentPlan.updateMany({ where: { admissionId: c.result.admissions[0].id, isActive: true }, data: { isActive: false } });
    await db.dietPlan.updateMany({ where: { admissionId: c.result.admissions[0].id, isActive: true }, data: { isActive: false } });
  });
  perf.recordTimed(SCENARIO, t1, "pass", "archived");

  // Verify cage is free (archived admission has deletedAt != null, cage check requires deletedAt: null)
  const t2 = await timed("check cage free after archive", () => checkCageOccupied("GENERAL", cage));
  assert.equal(t2.result, null, "Cage should be free after archive");
  perf.recordTimed(SCENARIO, t2, "pass", "cage free");

  // Create patient D in same cage
  const d = await timed("create patient D in same cage", () =>
    createPatientWithAdmission("Archive-D", { ward: "GENERAL", cageNumber: cage, condition: "STABLE", doctorId }),
  );
  perf.recordTimed(SCENARIO, d, "pass", `patient ${d.result.id} reused cage ${cage}`);
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 3: Archive → Restore → Cage Conflict
// ═══════════════════════════════════════════════════════════════════════════

test("scenario 3: archive restore cage conflict", async () => {
  const SCENARIO = "3-restore-conflict";
  const cage = `SR-${RUN_ID.slice(-6)}`;

  // Create patient E with cage
  const e = await timed("create patient E", () =>
    createPatientWithAdmission("Restore-E", { ward: "GENERAL", cageNumber: cage, condition: "STABLE", doctorId }),
  );
  perf.recordTimed(SCENARIO, e, "pass", `patient ${e.result.id} in cage ${cage}`);

  // Archive patient E
  const t1 = await timed("archive patient E", async () => {
    const now = new Date();
    await db.admission.updateMany({ where: { patientId: e.result.id, deletedAt: null }, data: { deletedAt: now } });
    await db.patient.update({ where: { id: e.result.id }, data: { deletedAt: now } });
  });
  perf.recordTimed(SCENARIO, t1, "pass", "archived");

  // Create patient F in same cage (should work — E is archived)
  const f = await timed("create patient F in same cage", () =>
    createPatientWithAdmission("Restore-F", { ward: "GENERAL", cageNumber: cage, condition: "STABLE", doctorId }),
  );
  perf.recordTimed(SCENARIO, f, "pass", `patient ${f.result.id} took cage ${cage}`);

  // Restore patient E (matches fixed restorePatient action — clears cage to prevent conflicts)
  const t2 = await timed("restore patient E", async () => {
    await db.patient.update({ where: { id: e.result.id }, data: { deletedAt: null } });
    await db.admission.updateMany({
      where: { patientId: e.result.id, deletedAt: { not: null } },
      data: { deletedAt: null, cageNumber: null, ward: null },
    });
  });
  perf.recordTimed(SCENARIO, t2, "pass", "restored");

  // Check: BOTH E and F now have ACTIVE status in same cage — this is the conflict!
  const t3 = await timed("count active patients in cage", async () => {
    return db.admission.findMany({
      where: {
        ward: "GENERAL",
        cageNumber: cage,
        status: "ACTIVE",
        deletedAt: null,
        patient: { deletedAt: null },
      },
      select: { id: true, patient: { select: { name: true } } },
    });
  });

  // After fix: restored patient should have cage cleared, so only patient F occupies the cage
  assert.equal(t3.result.length, 1, "Only one patient should occupy the cage after restore clears cage assignment");
  assert.ok(t3.result[0].patient.name.includes("Restore-F"), "Patient F should still have the cage");
  perf.recordTimed(SCENARIO, t3, "pass", "restored patient cage cleared — no conflict");

  // Verify the restored patient's admission has null cage
  const t4 = await timed("verify restored patient cage is null", async () =>
    db.admission.findFirst({
      where: { patientId: e.result.id, deletedAt: null },
      select: { cageNumber: true, ward: true },
    }),
  );
  assert.equal(t4.result?.cageNumber, null, "Restored patient should have null cage");
  assert.equal(t4.result?.ward, null, "Restored patient should have null ward");
  perf.recordTimed(SCENARIO, t4, "pass", "restored patient needs ward/cage reassignment");
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 4: Full Cascade Delete
// ═══════════════════════════════════════════════════════════════════════════

test("scenario 4: full cascade delete", async () => {
  const SCENARIO = "4-cascade-delete";
  const cage = `SC-${RUN_ID.slice(-6)}`;

  // Create patient with everything
  const t1 = await timed("create full patient", () => createFullPatient("Cascade", doctorId, cage));
  perf.recordTimed(SCENARIO, t1, "pass", `patient ${t1.result.patient.id} with all record types`);

  const { patient, admissionId } = t1.result;

  // Archive first (required before permanent delete)
  await db.admission.updateMany({ where: { patientId: patient.id, deletedAt: null }, data: { deletedAt: new Date() } });
  await db.patient.update({ where: { id: patient.id }, data: { deletedAt: new Date() } });

  // Permanently delete
  const t2 = await timed("permanent delete", async () => {
    await db.$transaction(async (tx: any) => {
      await tx.feedingLog.deleteMany({ where: { feedingSchedule: { dietPlan: { admissionId } } } });
      await tx.feedingSchedule.deleteMany({ where: { dietPlan: { admissionId } } });
      await tx.dietPlan.deleteMany({ where: { admissionId } });
      await tx.medicationAdministration.deleteMany({ where: { treatmentPlan: { admissionId } } });
      await tx.treatmentPlan.deleteMany({ where: { admissionId } });
      await tx.vitalRecord.deleteMany({ where: { admissionId } });
      await tx.clinicalNote.deleteMany({ where: { admissionId } });
      await tx.bathLog.deleteMany({ where: { admissionId } });
      await tx.labResult.deleteMany({ where: { admissionId } });
      await tx.admission.deleteMany({ where: { patientId: patient.id } });
      await tx.patient.delete({ where: { id: patient.id } });
    });
  });
  perf.recordTimed(SCENARIO, t2, "pass", `cascade delete in ${t2.durationMs}ms`);

  // Verify everything is gone
  const t3 = await timed("verify cascade clean", async () => {
    const [patients, admissions, notes, vitals, meds, baths, labs] = await Promise.all([
      db.patient.count({ where: { id: patient.id } }),
      db.admission.count({ where: { patientId: patient.id } }),
      db.clinicalNote.count({ where: { admissionId } }),
      db.vitalRecord.count({ where: { admissionId } }),
      db.treatmentPlan.count({ where: { admissionId } }),
      db.bathLog.count({ where: { admissionId } }),
      db.labResult.count({ where: { admissionId } }),
    ]);
    return { patients, admissions, notes, vitals, meds, baths, labs };
  });

  const counts = t3.result;
  const allZero = Object.values(counts).every((c) => c === 0);
  assert.ok(allZero, `All records should be deleted, got: ${JSON.stringify(counts)}`);
  perf.recordTimed(SCENARIO, t3, "pass", "all records deleted — cascade clean");
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 5: Discharge Deactivates Everything
// ═══════════════════════════════════════════════════════════════════════════

test("scenario 5: discharge deactivates plans", async () => {
  const SCENARIO = "5-discharge-deactivate";
  const cage = `SX-${RUN_ID.slice(-6)}`;

  // Create patient with active plans
  const t1 = await timed("create patient with plans", () => createFullPatient("Deactivate", doctorId, cage));
  perf.recordTimed(SCENARIO, t1, "pass", "patient with active plans created");

  const { admissionId } = t1.result;

  // Verify plans are active before discharge
  const activeMeds = await db.treatmentPlan.count({ where: { admissionId, isActive: true } });
  const activeDiets = await db.dietPlan.count({ where: { admissionId, isActive: true } });
  assert.ok(activeMeds > 0, "Should have active treatment plans");
  assert.ok(activeDiets > 0, "Should have active diet plans");

  // Discharge
  const t2 = await timed("discharge patient", async () => {
    await db.$transaction(async (tx: any) => {
      await tx.admission.update({
        where: { id: admissionId },
        data: { status: "DISCHARGED", dischargeDate: new Date() },
      });
      await tx.treatmentPlan.updateMany({ where: { admissionId, isActive: true }, data: { isActive: false } });
      await tx.dietPlan.updateMany({ where: { admissionId, isActive: true }, data: { isActive: false } });
      await tx.fluidTherapy.updateMany({ where: { admissionId, isActive: true }, data: { isActive: false } });
    });
  });
  perf.recordTimed(SCENARIO, t2, "pass", "discharged");

  // Verify all deactivated
  const t3 = await timed("verify deactivation", async () => {
    const [meds, diets, fluids, admission] = await Promise.all([
      db.treatmentPlan.count({ where: { admissionId, isActive: true } }),
      db.dietPlan.count({ where: { admissionId, isActive: true } }),
      db.fluidTherapy.count({ where: { admissionId, isActive: true } }),
      db.admission.findUnique({ where: { id: admissionId }, select: { status: true } }),
    ]);
    return { activeMeds: meds, activeDiets: diets, activeFluids: fluids, status: admission?.status };
  });

  assert.equal(t3.result.activeMeds, 0, "No active meds after discharge");
  assert.equal(t3.result.activeDiets, 0, "No active diets after discharge");
  assert.equal(t3.result.activeFluids, 0, "No active fluids after discharge");
  assert.equal(t3.result.status, "DISCHARGED", "Status should be DISCHARGED");
  perf.recordTimed(SCENARIO, t3, "pass", "all plans deactivated, status DISCHARGED");
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 6: Dashboard Query Performance
// ═══════════════════════════════════════════════════════════════════════════

test("scenario 6: dashboard query performance", async () => {
  const SCENARIO = "6-dashboard-perf";
  const today = toUTCDate(getTodayIST());

  // Replicate getDashboardSummary query
  const t1 = await timed("dashboard summary query", () =>
    db.admission.findMany({
      where: { status: "ACTIVE", deletedAt: null, patient: { deletedAt: null } },
      select: {
        id: true, ward: true, condition: true,
        treatmentPlans: {
          where: { isActive: true },
          select: {
            scheduledTimes: true,
            administrations: {
              where: { scheduledDate: today },
              select: { scheduledTime: true, wasAdministered: true },
            },
          },
        },
        dietPlans: {
          where: { isActive: true },
          select: {
            feedingSchedules: {
              select: {
                scheduledTime: true,
                feedingLogs: { where: { date: today }, take: 1, select: { status: true } },
              },
            },
          },
        },
        bathLogs: { take: 1, orderBy: { bathedAt: "desc" as const }, select: { bathedAt: true } },
      },
    }),
  );
  const warnLevel = t1.durationMs > 500 ? "warn" : "pass";
  perf.recordTimed(SCENARIO, t1, warnLevel, `${t1.result.length} active admissions`);

  // Replicate getDashboardQueue query
  const t2 = await timed("dashboard queue query", () =>
    db.admission.findMany({
      where: { status: "ACTIVE", deletedAt: null, patient: { deletedAt: null } },
      include: {
        patient: { select: { id: true, name: true, species: true, breed: true, age: true, sex: true, isStray: true } },
        vitalRecords: { take: 1, orderBy: { recordedAt: "desc" as const }, select: { temperature: true, heartRate: true, recordedAt: true } },
        bathLogs: { take: 1, orderBy: { bathedAt: "desc" as const }, select: { bathedAt: true } },
        treatmentPlans: {
          where: { isActive: true },
          select: {
            id: true, drugName: true, scheduledTimes: true,
            administrations: {
              where: { scheduledDate: today },
              select: { scheduledTime: true, wasAdministered: true, wasSkipped: true },
            },
          },
        },
      },
      orderBy: { admissionDate: "desc" as const },
    }),
  );
  perf.recordTimed(SCENARIO, t2, t2.durationMs > 500 ? "warn" : "pass", `${t2.result.length} rows`);

  // Replicate getDashboardSecondaryData queries
  const t3 = await timed("dashboard secondary (pending + isolation)", async () => {
    const [pending, isolation] = await Promise.all([
      db.admission.findMany({
        where: { status: "REGISTERED", deletedAt: null, patient: { deletedAt: null } },
        include: { patient: { select: { name: true, species: true } } },
      }),
      db.admission.findMany({
        where: { status: "ACTIVE", ward: "ISOLATION", deletedAt: null, patient: { deletedAt: null } },
        include: {
          patient: { select: { name: true } },
          isolationProtocol: { select: { disease: true, isCleared: true } },
        },
      }),
    ]);
    return { pending: pending.length, isolation: isolation.length };
  });
  perf.recordTimed(SCENARIO, t3, t3.durationMs > 500 ? "warn" : "pass",
    `${t3.result.pending} pending, ${t3.result.isolation} isolation`);
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 7: Patient Page Query Performance
// ═══════════════════════════════════════════════════════════════════════════

test("scenario 7: patient page query performance", async () => {
  const SCENARIO = "7-patient-page-perf";

  // Find an active admission to test against
  const admission = await db.admission.findFirst({
    where: { status: "ACTIVE", deletedAt: null, patient: { deletedAt: null } },
    select: { id: true, patientId: true },
  });
  assert.ok(admission, "Need an active admission for patient page perf test");

  const admissionId = admission.id;
  const today = toUTCDate(getTodayIST());

  // Shell query
  const t1 = await timed("patient shell", () =>
    db.admission.findUnique({
      where: { id: admissionId },
      include: { patient: true },
    }),
  );
  perf.recordTimed(SCENARIO, t1, t1.durationMs > 500 ? "warn" : "pass", "shell loaded");

  // Vitals
  const t2 = await timed("patient vitals", () =>
    db.vitalRecord.findMany({
      where: { admissionId },
      orderBy: { recordedAt: "desc" as const },
      include: { recordedBy: { select: { name: true } } },
    }),
  );
  perf.recordTimed(SCENARIO, t2, t2.durationMs > 500 ? "warn" : "pass", `${t2.result.length} vital records`);

  // Meds
  const t3 = await timed("patient meds", async () => {
    const [plans, fluids] = await Promise.all([
      db.treatmentPlan.findMany({
        where: { admissionId },
        include: {
          administrations: { where: { scheduledDate: today } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" as const },
      }),
      db.fluidTherapy.findMany({
        where: { admissionId },
        include: { rateChanges: { orderBy: { changedAt: "desc" as const } } },
        orderBy: { startTime: "desc" as const },
      }),
    ]);
    return { plans: plans.length, fluids: fluids.length };
  });
  perf.recordTimed(SCENARIO, t3, t3.durationMs > 500 ? "warn" : "pass",
    `${t3.result.plans} plans, ${t3.result.fluids} fluids`);

  // Notes
  const t4 = await timed("patient notes", () =>
    db.clinicalNote.findMany({
      where: { admissionId },
      orderBy: { recordedAt: "desc" as const },
      include: { recordedBy: { select: { name: true, role: true } } },
    }),
  );
  perf.recordTimed(SCENARIO, t4, t4.durationMs > 500 ? "warn" : "pass", `${t4.result.length} notes`);

  // Labs
  const t5 = await timed("patient labs", () =>
    db.labResult.findMany({ where: { admissionId }, orderBy: { resultDate: "desc" as const } }),
  );
  perf.recordTimed(SCENARIO, t5, t5.durationMs > 500 ? "warn" : "pass", `${t5.result.length} labs`);

  // Bath
  const t6 = await timed("patient bath", () =>
    db.bathLog.findMany({
      where: { admissionId },
      orderBy: { bathedAt: "desc" as const },
      include: { bathedBy: { select: { name: true } } },
    }),
  );
  perf.recordTimed(SCENARIO, t6, t6.durationMs > 500 ? "warn" : "pass", `${t6.result.length} baths`);

  // Logs (heaviest — multi-table timeline)
  const t7 = await timed("patient logs (multi-table)", async () => {
    const [meds, vitals, feedings, baths, notes] = await Promise.all([
      db.medicationAdministration.findMany({
        where: { treatmentPlan: { admissionId } },
        include: { treatmentPlan: { select: { drugName: true } }, administeredBy: { select: { name: true } } },
        orderBy: { actualTime: "desc" as const },
      }),
      db.vitalRecord.findMany({
        where: { admissionId },
        select: { id: true, temperature: true, heartRate: true, recordedAt: true },
        orderBy: { recordedAt: "desc" as const },
      }),
      db.feedingLog.findMany({
        where: { feedingSchedule: { dietPlan: { admissionId } } },
        include: { feedingSchedule: { select: { foodType: true, scheduledTime: true } } },
        orderBy: { createdAt: "desc" as const },
      }),
      db.bathLog.findMany({
        where: { admissionId },
        select: { id: true, bathedAt: true },
        orderBy: { bathedAt: "desc" as const },
      }),
      db.clinicalNote.findMany({
        where: { admissionId },
        select: { id: true, category: true, content: true, recordedAt: true },
        orderBy: { recordedAt: "desc" as const },
      }),
    ]);
    return { meds: meds.length, vitals: vitals.length, feedings: feedings.length, baths: baths.length, notes: notes.length };
  });
  perf.recordTimed(SCENARIO, t7, t7.durationMs > 500 ? "warn" : "pass",
    `logs: ${JSON.stringify(t7.result)}`);
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 8: Schedule & Notification Query Performance
// ═══════════════════════════════════════════════════════════════════════════

test("scenario 8: schedule and notification performance", async () => {
  const SCENARIO = "8-schedule-perf";
  const today = toUTCDate(getTodayIST());

  // Med schedule
  const t1 = await timed("schedule meds query", () =>
    db.treatmentPlan.findMany({
      where: {
        isActive: true, deletedAt: null,
        admission: { status: "ACTIVE", deletedAt: null, patient: { deletedAt: null } },
      },
      include: {
        admission: { include: { patient: { select: { name: true } } } },
        administrations: { where: { scheduledDate: today } },
      },
    }),
  );
  perf.recordTimed(SCENARIO, t1, t1.durationMs > 500 ? "warn" : "pass", `${t1.result.length} active med plans`);

  // Feeding schedule
  const t2 = await timed("schedule feedings query", () =>
    db.dietPlan.findMany({
      where: {
        isActive: true,
        admission: { status: "ACTIVE", deletedAt: null, patient: { deletedAt: null } },
      },
      include: {
        admission: { include: { patient: { select: { name: true } } } },
        feedingSchedules: {
          include: { feedingLogs: { where: { date: today }, take: 1 } },
        },
      },
    }),
  );
  perf.recordTimed(SCENARIO, t2, t2.durationMs > 500 ? "warn" : "pass", `${t2.result.length} active diet plans`);

  // Bath schedule
  const t3 = await timed("schedule baths query", () =>
    db.admission.findMany({
      where: { status: "ACTIVE", deletedAt: null, patient: { deletedAt: null } },
      select: {
        id: true, admissionDate: true,
        patient: { select: { name: true } },
        bathLogs: { take: 1, orderBy: { bathedAt: "desc" as const }, select: { bathedAt: true } },
      },
    }),
  );
  perf.recordTimed(SCENARIO, t3, t3.durationMs > 500 ? "warn" : "pass", `${t3.result.length} admissions checked`);

  // Notification snapshot (heaviest query in the app)
  const t4 = await timed("notification snapshot query", () =>
    db.admission.findMany({
      where: { status: "ACTIVE", deletedAt: null, patient: { deletedAt: null } },
      include: {
        patient: { select: { name: true } },
        treatmentPlans: {
          where: { isActive: true },
          include: { administrations: { where: { scheduledDate: today } } },
        },
        dietPlans: {
          where: { isActive: true },
          include: {
            feedingSchedules: {
              include: { feedingLogs: { where: { date: today }, take: 1 } },
            },
          },
        },
        bathLogs: { take: 1, orderBy: { bathedAt: "desc" as const } },
        vitalRecords: { take: 1, orderBy: { recordedAt: "desc" as const } },
        isolationProtocol: {
          include: { disinfectionLogs: { take: 1, orderBy: { performedAt: "desc" as const } } },
        },
      },
    }),
  );
  perf.recordTimed(SCENARIO, t4, t4.durationMs > 1000 ? "fail" : t4.durationMs > 500 ? "warn" : "pass",
    `${t4.result.length} admissions with full notification data`);
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO 9: Dashboard Excludes Archived/Discharged
// ═══════════════════════════════════════════════════════════════════════════

test("scenario 9: dashboard excludes archived and discharged", async () => {
  const SCENARIO = "9-dashboard-filter";

  // Create a patient
  const cage = `SF-${RUN_ID.slice(-6)}`;
  const p = await createPatientWithAdmission("Filter-Test", { ward: "GENERAL", cageNumber: cage, condition: "STABLE", doctorId });

  // Verify it appears in dashboard query
  const t1 = await timed("dashboard includes active patient", async () => {
    const active = await db.admission.findMany({
      where: { status: "ACTIVE", deletedAt: null, patient: { deletedAt: null } },
      select: { id: true, patient: { select: { name: true } } },
    });
    return active.some((a) => a.patient.name.includes(RUN_ID));
  });
  assert.ok(t1.result, "Dashboard should include active tagged patient");
  perf.recordTimed(SCENARIO, t1, "pass", "active patient visible");

  // Discharge it
  await db.admission.update({ where: { id: p.admissions[0].id }, data: { status: "DISCHARGED", dischargeDate: new Date() } });

  // Verify it's gone from dashboard
  const t2 = await timed("dashboard excludes discharged", async () => {
    const active = await db.admission.findMany({
      where: { status: "ACTIVE", deletedAt: null, patient: { deletedAt: null } },
      select: { id: true, patient: { select: { name: true } } },
    });
    return active.some((a) => a.patient.name.includes("Filter-Test"));
  });
  assert.equal(t2.result, false, "Dashboard should NOT include discharged patient");
  perf.recordTimed(SCENARIO, t2, "pass", "discharged patient excluded");
});

// ═══════════════════════════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════════════════════════

test("write performance report", async () => {
  const reportPath = await perf.writeReport("test-results/real-system", RUN_ID);
  console.log(`\n📊 Performance report: ${reportPath}`);

  const summary = perf.getSummary();
  console.log(`   Total: ${summary.total} | Passed: ${summary.passed} | Warnings: ${summary.warned} | Failed: ${summary.failed}`);
  if (summary.slowest.length > 0) {
    console.log(`   Slowest: ${summary.slowest[0].durationMs}ms — ${summary.slowest[0].scenario} > ${summary.slowest[0].action}\n`);
  }
});
