import test from "node:test";
import assert from "node:assert/strict";
import { db } from "@/lib/db";
import { timed, createPerfCollector } from "../support/real-timing";
import { toUTCDate, getTodayIST, isBathDue } from "@/lib/date-utils";

const DRILL_ID = `DRILL-${Date.now()}`;
const perf = createPerfCollector();
const today = toUTCDate(getTodayIST());

function tag(label: string) { return `${DRILL_ID} ${label}`; }

// ── Types ───────────────────────────────────────────────────────────────────

interface DrillPatient {
  id: string;
  admissionId: string;
  name: string;
  ward: string;
  cageNumber: string;
  meds: { id: string; drugName: string; scheduledTimes: string[] }[];
  dietPlanId?: string;
  feedingSchedules: { id: string; scheduledTime: string }[];
  fluidId?: string;
  isolationProtocolId?: string;
}

const patients: DrillPatient[] = [];
let doctorId: string;
let paravetId: string;

// ── Setup ───────────────────────────────────────────────────────────────────

test("drill setup: find staff", async () => {
  const doctor = await db.staff.findFirst({ where: { role: "DOCTOR", isActive: true, deletedAt: null }, select: { id: true } });
  const paravet = await db.staff.findFirst({ where: { role: { in: ["PARAVET", "ATTENDANT"] }, isActive: true, deletedAt: null }, select: { id: true } });
  assert.ok(doctor && paravet, "Need active doctor and paravet/attendant");
  doctorId = doctor.id;
  paravetId = paravet.id;
});

test("drill setup: create 10 patients with full clinical data", { timeout: 120_000 }, async () => {
  const roster = [
    { name: "General-Critical-1", ward: "GENERAL", cage: `DG1-${DRILL_ID.slice(-4)}`, condition: "CRITICAL",
      meds: [
        { drug: "Ceftriaxone", dose: "25 mg/kg", route: "IV", freq: "BID", times: ["08:00", "20:00"] },
        { drug: "Meloxicam", dose: "0.1 mg/kg", route: "IV", freq: "SID", times: ["08:00"] },
        { drug: "Ondansetron", dose: "0.5 mg/kg", route: "IV", freq: "TID", times: ["08:00", "14:00", "20:00"] },
      ],
      diet: { type: "Soft recovery diet", meals: [{ time: "08:00", food: "Soft diet", portion: "200g" }, { time: "14:00", food: "Soft diet", portion: "200g" }, { time: "20:00", food: "Soft diet", portion: "200g" }] },
    },
    { name: "General-Critical-2", ward: "GENERAL", cage: `DG2-${DRILL_ID.slice(-4)}`, condition: "CRITICAL",
      meds: [
        { drug: "Amoxicillin", dose: "20 mg/kg", route: "PO", freq: "BID", times: ["08:00", "20:00"] },
        { drug: "Pantoprazole", dose: "1 mg/kg", route: "IV", freq: "SID", times: ["08:00"] },
      ],
      diet: { type: "High-calorie gruel", meals: [{ time: "06:00", food: "Gruel", portion: "25ml" }, { time: "10:00", food: "Gruel", portion: "25ml" }, { time: "14:00", food: "Gruel", portion: "25ml" }, { time: "18:00", food: "Gruel", portion: "25ml" }] },
    },
    { name: "General-Stable", ward: "GENERAL", cage: `DG3-${DRILL_ID.slice(-4)}`, condition: "STABLE",
      meds: [
        { drug: "Amoxicillin-Clav", dose: "20 mg/kg", route: "PO", freq: "BID", times: ["08:00", "20:00"] },
        { drug: "Tramadol", dose: "3 mg/kg", route: "PO", freq: "BID", times: ["08:00", "20:00"] },
      ],
      diet: { type: "Chicken + rice", meals: [{ time: "08:00", food: "Boiled chicken", portion: "150g" }, { time: "14:00", food: "Boiled chicken", portion: "150g" }, { time: "20:00", food: "Boiled chicken", portion: "150g" }] },
    },
    { name: "General-Improving", ward: "GENERAL", cage: `DG4-${DRILL_ID.slice(-4)}`, condition: "IMPROVING",
      meds: [{ drug: "Vitamin B Complex", dose: "1 ml/10 kg", route: "IM", freq: "SID", times: ["08:00"] }],
      diet: { type: "Recovery gruel", meals: [{ time: "08:00", food: "Gruel", portion: "30ml" }, { time: "14:00", food: "Gruel", portion: "30ml" }, { time: "20:00", food: "Gruel", portion: "30ml" }] },
      fluid: { type: "Ringer's Lactate", rate: "40 ml/hr" },
    },
    { name: "ISO-CDV", ward: "ISOLATION", cage: `DI1-${DRILL_ID.slice(-4)}`, condition: "GUARDED",
      meds: [
        { drug: "Ceftriaxone", dose: "25 mg/kg", route: "IV", freq: "BID", times: ["08:00", "20:00"] },
        { drug: "Nebulization", dose: "3 ml", route: "NEBULIZER", freq: "TID", times: ["08:00", "14:00", "20:00"] },
        { drug: "B-Complex", dose: "1 ml", route: "IM", freq: "SID", times: ["08:00"] },
      ],
      diet: { type: "Syringe feed", meals: [{ time: "08:00", food: "Gruel syringe", portion: "20ml" }, { time: "12:00", food: "Gruel syringe", portion: "20ml" }, { time: "16:00", food: "Gruel syringe", portion: "20ml" }, { time: "20:00", food: "Gruel syringe", portion: "20ml" }] },
      isolation: { disease: "Canine Distemper (CDV)", ppe: ["Gloves", "Gown", "Shoe covers"], disinfectant: "QAC", interval: "Q4H" },
    },
    { name: "ISO-Parvo", ward: "ISOLATION", cage: `DI2-${DRILL_ID.slice(-4)}`, condition: "CRITICAL",
      meds: [
        { drug: "Ceftriaxone", dose: "25 mg/kg", route: "IV", freq: "BID", times: ["08:00", "20:00"] },
        { drug: "Metoclopramide", dose: "0.3 mg/kg", route: "SC", freq: "SID", times: ["08:00"] },
      ],
      diet: { type: "NPO then syringe", meals: [{ time: "10:00", food: "Syringe electrolyte", portion: "10ml" }, { time: "14:00", food: "Syringe electrolyte", portion: "10ml" }, { time: "18:00", food: "Syringe gruel", portion: "15ml" }] },
      isolation: { disease: "Canine Parvovirus", ppe: ["Gloves", "Gown", "Shoe covers", "Face mask"], disinfectant: "Bleach 1:32", interval: "Q4H" },
    },
    { name: "ISO-Ringworm", ward: "ISOLATION", cage: `DI3-${DRILL_ID.slice(-4)}`, condition: "STABLE",
      meds: [{ drug: "Itraconazole", dose: "5 mg/kg", route: "PO", freq: "SID", times: ["08:00"] }],
      diet: { type: "Normal diet", meals: [{ time: "08:00", food: "Regular kibble", portion: "200g" }, { time: "14:00", food: "Regular kibble", portion: "200g" }, { time: "20:00", food: "Regular kibble", portion: "200g" }] },
      isolation: { disease: "Dermatophytosis (Ringworm)", ppe: ["Gloves"], disinfectant: "Chlorhexidine", interval: "Q6H" },
    },
    { name: "ICU-Post-Op", ward: "ICU", cage: `DC1-${DRILL_ID.slice(-4)}`, condition: "GUARDED",
      meds: [
        { drug: "Fentanyl CRI", dose: "2 mcg/kg/hr", route: "IV", freq: "Q4H", times: ["08:00", "12:00", "16:00", "20:00"] },
        { drug: "Cefazolin", dose: "22 mg/kg", route: "IV", freq: "BID", times: ["08:00", "20:00"] },
        { drug: "Famotidine", dose: "0.5 mg/kg", route: "IV", freq: "SID", times: ["08:00"] },
      ],
      diet: { type: "Liquid diet", meals: [{ time: "08:00", food: "Liquid nutrition", portion: "50ml" }, { time: "12:00", food: "Liquid nutrition", portion: "50ml" }, { time: "16:00", food: "Liquid nutrition", portion: "50ml" }, { time: "20:00", food: "Liquid nutrition", portion: "50ml" }] },
      fluid: { type: "Normal Saline", rate: "60 ml/hr" },
    },
    { name: "ICU-Trauma", ward: "ICU", cage: `DC2-${DRILL_ID.slice(-4)}`, condition: "CRITICAL",
      meds: [
        { drug: "Fentanyl CRI", dose: "3 mcg/kg/hr", route: "IV", freq: "Q4H", times: ["08:00", "12:00", "16:00", "20:00"] },
        { drug: "Ceftriaxone", dose: "25 mg/kg", route: "IV", freq: "BID", times: ["08:00", "20:00"] },
        { drug: "Metoclopramide", dose: "0.3 mg/kg", route: "IV", freq: "TID", times: ["08:00", "14:00", "20:00"] },
        { drug: "Mannitol", dose: "0.5 g/kg", route: "IV", freq: "PRN", times: [] },
      ],
      diet: null, // NPO
      fluid: { type: "Hypertonic Saline", rate: "20 ml/hr" },
    },
  ];

  for (const r of roster) {
    const t = await timed(`create ${r.name}`, async () => {
      const patient = await db.patient.create({
        data: {
          name: tag(r.name), species: "DOG", sex: "UNKNOWN", isStray: true,
          admissions: {
            create: {
              status: "ACTIVE", ward: r.ward as any, cageNumber: r.cage,
              diagnosis: tag(`${r.name} diagnosis`), condition: r.condition as any,
              attendingDoctor: "Drill Doctor", admittedById: doctorId,
              ...(r.isolation ? {
                isolationProtocol: {
                  create: {
                    disease: r.isolation.disease, ppeRequired: r.isolation.ppe,
                    disinfectant: r.isolation.disinfectant, disinfectionInterval: r.isolation.interval,
                    createdById: doctorId,
                  },
                },
              } : {}),
            },
          },
        },
        include: { admissions: { take: 1, include: { isolationProtocol: true } } },
      });

      const admissionId = patient.admissions[0].id;
      const meds: DrillPatient["meds"] = [];

      for (const m of r.meds) {
        const med = await db.treatmentPlan.create({
          data: {
            admissionId, drugName: tag(m.drug), dose: m.dose, route: m.route as any,
            frequency: m.freq as any, scheduledTimes: m.times, isActive: true,
            startDate: new Date(), createdById: doctorId,
          },
        });
        meds.push({ id: med.id, drugName: med.drugName, scheduledTimes: m.times });
      }

      const feedingSchedules: DrillPatient["feedingSchedules"] = [];
      let dietPlanId: string | undefined;
      if (r.diet) {
        const diet = await db.dietPlan.create({
          data: {
            admissionId, dietType: tag(r.diet.type), instructions: `${r.diet.type} for ${r.name}`,
            isActive: true, createdById: doctorId,
            feedingSchedules: { create: r.diet.meals.map((m) => ({ scheduledTime: m.time, foodType: m.food, portion: m.portion })) },
          },
          include: { feedingSchedules: true },
        });
        dietPlanId = diet.id;
        for (const fs of diet.feedingSchedules) {
          feedingSchedules.push({ id: fs.id, scheduledTime: fs.scheduledTime });
        }
      }

      let fluidId: string | undefined;
      if ((r as any).fluid) {
        const fluid = await db.fluidTherapy.create({
          data: { admissionId, fluidType: (r as any).fluid.type, rate: (r as any).fluid.rate, isActive: true, startTime: new Date(), createdById: doctorId },
        });
        fluidId = fluid.id;
      }

      return {
        id: patient.id, admissionId, name: r.name, ward: r.ward, cageNumber: r.cage,
        meds, dietPlanId, feedingSchedules, fluidId,
        isolationProtocolId: patient.admissions[0].isolationProtocol?.id,
      } satisfies DrillPatient;
    });
    patients.push(t.result);
    perf.recordTimed("setup", t, "pass", `${r.name}: ${r.meds.length} meds, ${r.diet?.meals.length ?? 0} meals`);
  }

  // Patient 10: registered (no clinical data)
  const reg = await timed("create Registered-New", async () => {
    const p = await db.patient.create({
      data: {
        name: tag("Registered-New"), species: "DOG", sex: "FEMALE", isStray: true,
        admissions: { create: { status: "REGISTERED", admittedById: paravetId, chiefComplaint: tag("Found injured") } },
      },
      include: { admissions: { take: 1 } },
    });
    return { id: p.id, admissionId: p.admissions[0].id, name: "Registered-New", ward: "", cageNumber: "", meds: [], feedingSchedules: [] } satisfies DrillPatient;
  });
  patients.push(reg.result);
  perf.recordTimed("setup", reg, "pass", "registered patient (pending setup)");

  assert.equal(patients.length, 10, "Should have 10 patients");
  console.log(`\n  Created ${patients.length} patients for drill ${DRILL_ID}\n`);
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE A: MORNING SHIFT
// ═══════════════════════════════════════════════════════════════════════════

test("phase A: morning shift", { timeout: 120_000 }, async (t) => {
  const active = patients.filter((p) => p.ward); // skip registered

  // A1: Vitals round
  await t.test("A1: vitals round for all 9 active patients", async () => {
    for (const p of active) {
      const temp = 37.5 + Math.random() * 3; // 37.5 - 40.5
      const hr = 60 + Math.floor(Math.random() * 100);
      const v = await timed(`vitals ${p.name}`, () =>
        db.vitalRecord.create({ data: { admissionId: p.admissionId, temperature: +temp.toFixed(1), heartRate: hr, respRate: 20 + Math.floor(Math.random() * 20), recordedById: paravetId } }),
      );
      perf.recordTimed("A1-vitals", v, "pass", `temp=${v.result.temperature} hr=${v.result.heartRate}`);
    }
    // Verify: count vitals for one patient
    const count = await db.vitalRecord.count({ where: { admissionId: active[0].admissionId } });
    assert.ok(count >= 1, "Should have at least 1 vital record");
  });

  // A2: Med round 08:00
  await t.test("A2: administer all 08:00 medications", async () => {
    let administered = 0;
    for (const p of active) {
      for (const med of p.meds) {
        if (!med.scheduledTimes.includes("08:00")) continue;
        const a = await timed(`med ${p.name}/${med.drugName.split(" ").pop()}`, () =>
          db.medicationAdministration.upsert({
            where: { treatmentPlanId_scheduledDate_scheduledTime: { treatmentPlanId: med.id, scheduledDate: today, scheduledTime: "08:00" } },
            create: { treatmentPlanId: med.id, scheduledDate: today, scheduledTime: "08:00", wasAdministered: true, actualTime: new Date(), administeredById: paravetId },
            update: { wasAdministered: true, actualTime: new Date(), administeredById: paravetId },
          }),
        );
        perf.recordTimed("A2-meds-0800", a, "pass", `administered`);
        administered++;
      }
    }
    assert.ok(administered > 0, "Should have administered at least 1 dose");
    // Verify schedule reflects administered status
    const adminRecords = await db.medicationAdministration.findMany({
      where: { scheduledDate: today, scheduledTime: "08:00", treatmentPlan: { admissionId: active[0].admissionId } },
    });
    assert.ok(adminRecords.every((r) => r.wasAdministered), "All 08:00 doses should be administered");
  });

  // A3: Feeding round 08:00
  await t.test("A3: log all 08:00 feedings", async () => {
    const statuses = ["EATEN", "EATEN", "EATEN", "PARTIAL", "EATEN", "REFUSED", "EATEN", "EATEN", "EATEN"] as const;
    let logged = 0;
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const schedule = p.feedingSchedules.find((fs) => fs.scheduledTime === "08:00");
      if (!schedule) continue;
      const status = statuses[i % statuses.length];
      const f = await timed(`feed ${p.name}`, () =>
        db.feedingLog.upsert({
          where: { feedingScheduleId_date: { feedingScheduleId: schedule.id, date: today } },
          create: { feedingScheduleId: schedule.id, date: today, status, amountConsumed: status === "EATEN" ? "full" : status === "PARTIAL" ? "half" : undefined, loggedById: paravetId },
          update: { status, amountConsumed: status === "EATEN" ? "full" : status === "PARTIAL" ? "half" : undefined, loggedById: paravetId },
        }),
      );
      perf.recordTimed("A3-feeding-0800", f, "pass", `${status}`);
      logged++;
    }
    assert.ok(logged > 0, "Should have logged at least 1 feeding");
  });

  // A4: Bath round
  await t.test("A4: baths for 3 patients", async () => {
    const bathPatients = [patients[2], patients[6], patients[7]]; // Stable, Ringworm, PostOp
    for (const p of bathPatients) {
      const b = await timed(`bath ${p.name}`, () =>
        db.bathLog.create({ data: { admissionId: p.admissionId, bathedById: paravetId, notes: tag("Morning bath") } }),
      );
      perf.recordTimed("A4-bath", b, "pass", `bathed`);
    }
    // Verify isBathDue returns false
    const lastBath = await db.bathLog.findFirst({ where: { admissionId: patients[2].admissionId }, orderBy: { bathedAt: "desc" } });
    assert.ok(lastBath, "Bath log should exist");
    const dueStatus = isBathDue(lastBath!.bathedAt);
    assert.equal(dueStatus.isDue, false, "Should not be bath due after just bathing");
  });

  // A5: Isolation disinfection round 1
  await t.test("A5: disinfection for 3 isolation patients", async () => {
    const isoPatients = patients.filter((p) => p.isolationProtocolId);
    for (const p of isoPatients) {
      const d = await timed(`disinfect ${p.name}`, () =>
        db.disinfectionLog.create({ data: { isolationProtocolId: p.isolationProtocolId!, performedById: paravetId, notes: tag("Morning disinfection") } }),
      );
      perf.recordTimed("A5-disinfect", d, "pass", `disinfected`);
    }
    assert.equal(isoPatients.length, 3, "Should have 3 isolation patients");
  });

  // A6: Doctor morning notes
  await t.test("A6: doctor notes on 5 patients", async () => {
    for (let i = 0; i < 5; i++) {
      const p = active[i];
      const n = await timed(`note ${p.name}`, () =>
        db.clinicalNote.create({ data: { admissionId: p.admissionId, category: "DOCTOR_ROUND", content: tag(`Morning round: ${p.name} assessment`), recordedById: doctorId } }),
      );
      perf.recordTimed("A6-notes", n, "pass", `note added`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE B: MID-DAY
// ═══════════════════════════════════════════════════════════════════════════

test("phase B: mid-day operations", { timeout: 120_000 }, async (t) => {
  const active = patients.filter((p) => p.ward);

  await t.test("B1: lab results for 3 patients", async () => {
    const labPatients = [
      { p: patients[0], test: "CBC", result: "WBC 15.2, RBC 5.8, Hgb 12.1" },
      { p: patients[1], test: "BLOOD_CHEMISTRY", result: "BUN 28, Creatinine 1.4, ALT 45" },
      { p: patients[4], test: "PCR", result: "CDV PCR: Positive (Ct 22.5)" },
    ];
    for (const { p, test: testType, result } of labPatients) {
      const l = await timed(`lab ${p.name}`, () =>
        db.labResult.create({ data: { admissionId: p.admissionId, testType: testType as any, testName: tag(testType), result, isAbnormal: testType === "PCR", createdById: doctorId } }),
      );
      perf.recordTimed("B1-labs", l, "pass", `${testType}`);
    }
  });

  await t.test("B2: prescribe new med for General-Improving", async () => {
    const p = patients[3];
    const m = await timed("new prescription", () =>
      db.treatmentPlan.create({
        data: {
          admissionId: p.admissionId, drugName: tag("Metronidazole"), dose: "15 mg/kg",
          route: "PO", frequency: "BID", scheduledTimes: ["08:00", "20:00"],
          isActive: true, startDate: new Date(), createdById: doctorId,
        },
      }),
    );
    p.meds.push({ id: m.result.id, drugName: m.result.drugName, scheduledTimes: ["08:00", "20:00"] });
    perf.recordTimed("B2-prescribe", m, "pass", "Metronidazole BID prescribed");

    // Verify it shows in active med plans
    const activeMeds = await db.treatmentPlan.count({ where: { admissionId: p.admissionId, isActive: true } });
    assert.ok(activeMeds >= 2, "Should have 2+ active meds after new prescription");
  });

  await t.test("B3: skip 14:00 dose for General-Stable", async () => {
    const p = patients[2];
    const med = p.meds.find((m) => m.scheduledTimes.includes("14:00"));
    if (!med) { perf.record("B3-skip", "skip dose", 0, "pass", "no 14:00 med"); return; }

    const s = await timed("skip dose", () =>
      db.medicationAdministration.upsert({
        where: { treatmentPlanId_scheduledDate_scheduledTime: { treatmentPlanId: med.id, scheduledDate: today, scheduledTime: "14:00" } },
        create: { treatmentPlanId: med.id, scheduledDate: today, scheduledTime: "14:00", wasAdministered: false, wasSkipped: true, skipReason: "Patient sleeping", administeredById: paravetId },
        update: { wasAdministered: false, wasSkipped: true, skipReason: "Patient sleeping" },
      }),
    );
    assert.equal(s.result.wasSkipped, true);
    assert.equal(s.result.skipReason, "Patient sleeping");
    perf.recordTimed("B3-skip", s, "pass", "skipped with reason");
  });

  await t.test("B4: administer remaining 14:00 meds", async () => {
    for (const p of active) {
      for (const med of p.meds) {
        if (!med.scheduledTimes.includes("14:00")) continue;
        if (p.name === "General-Stable") continue; // skipped above
        const a = await timed(`med14 ${p.name}`, () =>
          db.medicationAdministration.upsert({
            where: { treatmentPlanId_scheduledDate_scheduledTime: { treatmentPlanId: med.id, scheduledDate: today, scheduledTime: "14:00" } },
            create: { treatmentPlanId: med.id, scheduledDate: today, scheduledTime: "14:00", wasAdministered: true, actualTime: new Date(), administeredById: paravetId },
            update: { wasAdministered: true, actualTime: new Date(), administeredById: paravetId },
          }),
        );
        perf.recordTimed("B4-meds-1400", a, "pass", "administered");
      }
    }
  });

  await t.test("B5: log 14:00 feedings", async () => {
    for (const p of active) {
      const schedule = p.feedingSchedules.find((fs) => fs.scheduledTime === "14:00");
      if (!schedule) continue;
      const status = Math.random() > 0.3 ? "EATEN" : "PARTIAL";
      const f = await timed(`feed14 ${p.name}`, () =>
        db.feedingLog.upsert({
          where: { feedingScheduleId_date: { feedingScheduleId: schedule.id, date: today } },
          create: { feedingScheduleId: schedule.id, date: today, status: status as any, loggedById: paravetId },
          update: { status: status as any, loggedById: paravetId },
        }),
      );
      perf.recordTimed("B5-feeding-1400", f, "pass", status);
    }
  });

  await t.test("B6: isolation disinfection round 2", async () => {
    for (const p of patients.filter((p) => p.isolationProtocolId)) {
      const d = await timed(`disinfect2 ${p.name}`, () =>
        db.disinfectionLog.create({ data: { isolationProtocolId: p.isolationProtocolId!, performedById: paravetId, notes: tag("Midday disinfection") } }),
      );
      perf.recordTimed("B6-disinfect-2", d, "pass", "disinfected");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE C: BEHAVIORAL EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════

test("phase C: behavioral edge cases", { timeout: 120_000 }, async (t) => {

  await t.test("C1: edit diet after feeding logged — immutable history", async () => {
    const p = patients[0]; // General-Critical-1 — has 08:00 feeding logged
    const oldSchedule08 = p.feedingSchedules.find((fs) => fs.scheduledTime === "08:00");
    assert.ok(oldSchedule08, "Should have 08:00 feeding schedule");

    // Verify the 08:00 log exists
    const oldLog = await db.feedingLog.findUnique({
      where: { feedingScheduleId_date: { feedingScheduleId: oldSchedule08!.id, date: today } },
    });
    assert.ok(oldLog, "08:00 feeding log should exist before edit");
    assert.equal(oldLog!.status, "EATEN");

    // Edit diet: deactivate old schedule (has log), create new one
    const t1 = await timed("edit diet (deactivate old + create new)", async () => {
      // Mark old schedule inactive (immutable — has logs)
      await db.feedingSchedule.update({ where: { id: oldSchedule08!.id }, data: { isActive: false } });
      // Create new schedule with updated values
      const newSchedule = await db.feedingSchedule.create({
        data: { dietPlanId: p.dietPlanId!, scheduledTime: "08:00", foodType: "Updated recovery food", portion: "250g" },
      });
      return newSchedule;
    });
    perf.recordTimed("C1-diet-edit", t1, "pass", "old deactivated, new created");

    // VERIFY: old log STILL EXISTS on the old (now inactive) schedule
    const oldLogAfter = await db.feedingLog.findUnique({
      where: { feedingScheduleId_date: { feedingScheduleId: oldSchedule08!.id, date: today } },
    });
    assert.ok(oldLogAfter, "BEHAVIORAL CHECK: old feeding log must survive diet edit");
    assert.equal(oldLogAfter!.status, "EATEN", "BEHAVIORAL CHECK: old log status preserved");
    perf.record("C1-diet-edit", "old log survives edit", 0, "pass", "immutable history preserved");

    // VERIFY: new schedule exists but has no log for today (past time, would need manual logging)
    const newLogs = await db.feedingLog.findFirst({
      where: { feedingScheduleId: t1.result.id, date: today },
    });
    assert.equal(newLogs, null, "BEHAVIORAL CHECK: new schedule should have no log for today (past time)");
    perf.record("C1-diet-edit", "new schedule has no log", 0, "pass", "new 08:00 schedule clean for today");
  });

  await t.test("C2: edit medication after dose administered", async () => {
    const p = patients[0]; // General-Critical-1
    const med = p.meds[0]; // Ceftriaxone

    // Verify 08:00 administration exists
    const adminBefore = await db.medicationAdministration.findUnique({
      where: { treatmentPlanId_scheduledDate_scheduledTime: { treatmentPlanId: med.id, scheduledDate: today, scheduledTime: "08:00" } },
    });
    assert.ok(adminBefore?.wasAdministered, "08:00 dose should be administered before edit");

    // Edit the medication dose
    const t1 = await timed("update med dose", () =>
      db.treatmentPlan.update({ where: { id: med.id }, data: { dose: "30 mg/kg", calculatedDose: "720 mg IV" } }),
    );
    perf.recordTimed("C2-med-edit", t1, "pass", "dose updated to 30 mg/kg");

    // VERIFY: 08:00 administration STILL EXISTS and is still marked administered
    const adminAfter = await db.medicationAdministration.findUnique({
      where: { treatmentPlanId_scheduledDate_scheduledTime: { treatmentPlanId: med.id, scheduledDate: today, scheduledTime: "08:00" } },
    });
    assert.ok(adminAfter?.wasAdministered, "BEHAVIORAL CHECK: administration survives med edit");
    perf.record("C2-med-edit", "administration survives edit", 0, "pass", "08:00 still administered after dose change");

    // VERIFY: treatment plan shows new dose
    const plan = await db.treatmentPlan.findUnique({ where: { id: med.id } });
    assert.equal(plan?.dose, "30 mg/kg", "BEHAVIORAL CHECK: plan reflects new dose");
  });

  await t.test("C3: stop medication — schedule cleanup", async () => {
    const p = patients[1]; // General-Critical-2
    const med = p.meds[0]; // Amoxicillin

    const t1 = await timed("stop medication", () =>
      db.treatmentPlan.update({ where: { id: med.id }, data: { isActive: false, endDate: new Date() } }),
    );
    perf.recordTimed("C3-stop-med", t1, "pass", "Amoxicillin stopped");

    // VERIFY: schedule no longer includes this med
    const activeMeds = await db.treatmentPlan.findMany({
      where: { admissionId: p.admissionId, isActive: true, deletedAt: null },
    });
    assert.ok(!activeMeds.some((m) => m.id === med.id), "BEHAVIORAL CHECK: stopped med not in active list");

    // VERIFY: past administrations still exist in DB
    const pastAdmins = await db.medicationAdministration.findMany({ where: { treatmentPlanId: med.id } });
    assert.ok(pastAdmins.length > 0, "BEHAVIORAL CHECK: past administrations preserved after stop");
    perf.record("C3-stop-med", "past admins preserved", 0, "pass", `${pastAdmins.length} past records intact`);
  });

  await t.test("C4: undo administration — reverts to pending", async () => {
    const p = patients[2]; // General-Stable
    const med = p.meds[0];

    // Verify it's currently administered
    const before = await db.medicationAdministration.findUnique({
      where: { treatmentPlanId_scheduledDate_scheduledTime: { treatmentPlanId: med.id, scheduledDate: today, scheduledTime: "08:00" } },
    });
    assert.ok(before?.wasAdministered, "Should be administered before undo");

    const t1 = await timed("undo administration", () =>
      db.medicationAdministration.update({
        where: { treatmentPlanId_scheduledDate_scheduledTime: { treatmentPlanId: med.id, scheduledDate: today, scheduledTime: "08:00" } },
        data: { wasAdministered: false, wasSkipped: false, actualTime: null, administeredById: null },
      }),
    );
    perf.recordTimed("C4-undo", t1, "pass", "reverted to pending");

    assert.equal(t1.result.wasAdministered, false, "BEHAVIORAL CHECK: dose reverted to not administered");
    assert.equal(t1.result.actualTime, null, "BEHAVIORAL CHECK: actualTime cleared");
  });

  await t.test("C5: transfer patient — data follows", async () => {
    const p = patients[3]; // General-Improving
    const newCage = `DC3-${DRILL_ID.slice(-4)}`;

    const t1 = await timed("transfer to ICU", () =>
      db.admission.update({ where: { id: p.admissionId }, data: { ward: "ICU", cageNumber: newCage } }),
    );
    perf.recordTimed("C5-transfer", t1, "pass", `moved to ICU cage ${newCage}`);

    // VERIFY: all records still accessible
    const [vitals, notes, meds] = await Promise.all([
      db.vitalRecord.count({ where: { admissionId: p.admissionId } }),
      db.clinicalNote.count({ where: { admissionId: p.admissionId } }),
      db.treatmentPlan.count({ where: { admissionId: p.admissionId } }),
    ]);
    assert.ok(vitals > 0, "BEHAVIORAL CHECK: vitals survive transfer");
    assert.ok(meds > 0, "BEHAVIORAL CHECK: meds survive transfer");
    perf.record("C5-transfer", "data integrity after transfer", 0, "pass", `vitals=${vitals} notes=${notes} meds=${meds}`);
    p.ward = "ICU";
    p.cageNumber = newCage;
  });

  await t.test("C6: update condition — reflected in DB", async () => {
    const p = patients[0]; // General-Critical-1
    const t1 = await timed("update condition", () =>
      db.admission.update({ where: { id: p.admissionId }, data: { condition: "GUARDED" } }),
    );
    perf.recordTimed("C6-condition", t1, "pass", "CRITICAL → GUARDED");
    assert.equal(t1.result.condition, "GUARDED");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE D: AFTERNOON SHIFT
// ═══════════════════════════════════════════════════════════════════════════

test("phase D: afternoon shift", { timeout: 120_000 }, async (t) => {

  await t.test("D1: clinical setup for registered patient", async () => {
    const p = patients[9]; // Registered-New
    const cage = `DG5-${DRILL_ID.slice(-4)}`;

    const t1 = await timed("clinical setup", () =>
      db.admission.update({
        where: { id: p.admissionId },
        data: { status: "ACTIVE", ward: "GENERAL", cageNumber: cage, diagnosis: tag("Post-injury assessment"), condition: "STABLE", attendingDoctor: "Drill Doctor" },
      }),
    );
    perf.recordTimed("D1-setup", t1, "pass", `now ACTIVE in GENERAL/${cage}`);
    p.ward = "GENERAL";
    p.cageNumber = cage;

    // Verify it appears in active admissions
    const active = await db.admission.findFirst({ where: { id: p.admissionId, status: "ACTIVE" } });
    assert.ok(active, "BEHAVIORAL CHECK: registered patient now ACTIVE");
  });

  await t.test("D2: discharge General-Stable", async () => {
    const p = patients[2]; // General-Stable
    const t1 = await timed("discharge", async () => {
      await db.$transaction(async (tx: any) => {
        await tx.admission.update({ where: { id: p.admissionId }, data: { status: "DISCHARGED", condition: "RECOVERED", dischargeDate: new Date() } });
        await tx.treatmentPlan.updateMany({ where: { admissionId: p.admissionId, isActive: true }, data: { isActive: false } });
        await tx.dietPlan.updateMany({ where: { admissionId: p.admissionId, isActive: true }, data: { isActive: false } });
        await tx.fluidTherapy.updateMany({ where: { admissionId: p.admissionId, isActive: true }, data: { isActive: false } });
      });
    });
    perf.recordTimed("D2-discharge", t1, "pass", "discharged as RECOVERED");

    // VERIFY: all plans deactivated
    const activePlans = await db.treatmentPlan.count({ where: { admissionId: p.admissionId, isActive: true } });
    assert.equal(activePlans, 0, "BEHAVIORAL CHECK: all plans deactivated after discharge");

    // VERIFY: not in dashboard query
    const inDashboard = await db.admission.findFirst({ where: { id: p.admissionId, status: "ACTIVE", deletedAt: null } });
    assert.equal(inDashboard, null, "BEHAVIORAL CHECK: discharged patient not in active query");

    // VERIFY: cage freed
    const cageOccupied = await db.admission.findFirst({
      where: { cageNumber: p.cageNumber, ward: "GENERAL", status: "ACTIVE", deletedAt: null, patient: { deletedAt: null } },
    });
    assert.equal(cageOccupied, null, "BEHAVIORAL CHECK: cage freed after discharge");
    perf.record("D2-discharge", "all post-discharge checks", 0, "pass", "plans off, cage free, not in dashboard");
  });

  await t.test("D3: doctor afternoon notes on remaining active patients", async () => {
    const active = patients.filter((p) => p.ward && p.name !== "General-Stable");
    for (const p of active) {
      const n = await timed(`note-pm ${p.name}`, () =>
        db.clinicalNote.create({ data: { admissionId: p.admissionId, category: "OBSERVATION", content: tag(`Afternoon check: ${p.name}`), recordedById: doctorId } }),
      );
      perf.recordTimed("D3-notes-pm", n, "pass", "afternoon note");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE E: EVENING SHIFT
// ═══════════════════════════════════════════════════════════════════════════

test("phase E: evening shift", { timeout: 120_000 }, async (t) => {
  const active = patients.filter((p) => p.ward && p.name !== "General-Stable"); // exclude discharged

  await t.test("E1: evening vitals", async () => {
    for (const p of active) {
      const v = await timed(`vitals-pm ${p.name}`, () =>
        db.vitalRecord.create({ data: { admissionId: p.admissionId, temperature: +(37.5 + Math.random() * 2.5).toFixed(1), heartRate: 70 + Math.floor(Math.random() * 80), respRate: 18 + Math.floor(Math.random() * 15), recordedById: paravetId } }),
      );
      perf.recordTimed("E1-vitals-pm", v, "pass", `temp=${v.result.temperature}`);
    }
  });

  await t.test("E2: administer all 20:00 meds", async () => {
    for (const p of active) {
      for (const med of p.meds) {
        if (!med.scheduledTimes.includes("20:00")) continue;
        // Skip stopped meds
        const plan = await db.treatmentPlan.findUnique({ where: { id: med.id }, select: { isActive: true } });
        if (!plan?.isActive) continue;
        const a = await timed(`med20 ${p.name}`, () =>
          db.medicationAdministration.upsert({
            where: { treatmentPlanId_scheduledDate_scheduledTime: { treatmentPlanId: med.id, scheduledDate: today, scheduledTime: "20:00" } },
            create: { treatmentPlanId: med.id, scheduledDate: today, scheduledTime: "20:00", wasAdministered: true, actualTime: new Date(), administeredById: paravetId },
            update: { wasAdministered: true, actualTime: new Date(), administeredById: paravetId },
          }),
        );
        perf.recordTimed("E2-meds-2000", a, "pass", "administered");
      }
    }
  });

  await t.test("E3: log 20:00 feedings", async () => {
    for (const p of active) {
      const schedule = p.feedingSchedules.find((fs) => fs.scheduledTime === "20:00");
      if (!schedule) continue;
      // Check schedule is still active
      const fs = await db.feedingSchedule.findUnique({ where: { id: schedule.id }, select: { isActive: true } });
      if (fs && !fs.isActive) continue;
      const f = await timed(`feed20 ${p.name}`, () =>
        db.feedingLog.upsert({
          where: { feedingScheduleId_date: { feedingScheduleId: schedule.id, date: today } },
          create: { feedingScheduleId: schedule.id, date: today, status: "EATEN", amountConsumed: "full", loggedById: paravetId },
          update: { status: "EATEN", amountConsumed: "full", loggedById: paravetId },
        }),
      );
      perf.recordTimed("E3-feeding-2000", f, "pass", "EATEN");
    }
  });

  await t.test("E4: final isolation disinfection", async () => {
    for (const p of patients.filter((pp) => pp.isolationProtocolId)) {
      const d = await timed(`disinfect3 ${p.name}`, () =>
        db.disinfectionLog.create({ data: { isolationProtocolId: p.isolationProtocolId!, performedById: paravetId, notes: tag("Evening disinfection") } }),
      );
      perf.recordTimed("E4-disinfect-3", d, "pass", "disinfected");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE F: FULL-STACK READ PERFORMANCE (with realistic data)
// ═══════════════════════════════════════════════════════════════════════════

test("phase F: read performance with loaded data", { timeout: 60_000 }, async (t) => {

  await t.test("F1: dashboard queries", async () => {
    const t1 = await timed("dashboard summary", () =>
      db.admission.findMany({
        where: { status: "ACTIVE", deletedAt: null, patient: { deletedAt: null } },
        select: { id: true, ward: true, condition: true, treatmentPlans: { where: { isActive: true }, select: { scheduledTimes: true, administrations: { where: { scheduledDate: today }, select: { scheduledTime: true, wasAdministered: true } } } }, dietPlans: { where: { isActive: true }, select: { feedingSchedules: { where: { isActive: true }, select: { scheduledTime: true, feedingLogs: { where: { date: today }, take: 1, select: { status: true } } } } } }, bathLogs: { take: 1, orderBy: { bathedAt: "desc" as const }, select: { bathedAt: true } } },
      }),
    );
    perf.recordTimed("F1-dashboard", t1, t1.durationMs > 500 ? "warn" : "pass", `${t1.result.length} active admissions`);

    const t2 = await timed("dashboard queue", () =>
      db.admission.findMany({
        where: { status: "ACTIVE", deletedAt: null, patient: { deletedAt: null } },
        include: { patient: { select: { id: true, name: true, species: true } }, vitalRecords: { take: 1, orderBy: { recordedAt: "desc" as const } }, bathLogs: { take: 1, orderBy: { bathedAt: "desc" as const } }, treatmentPlans: { where: { isActive: true }, include: { administrations: { where: { scheduledDate: today } } } } },
      }),
    );
    perf.recordTimed("F1-dashboard", t2, t2.durationMs > 500 ? "warn" : "pass", `${t2.result.length} rows`);
  });

  await t.test("F2: patient page queries (heaviest patient)", async () => {
    const p = patients[0]; // General-Critical-1 — most records
    const aid = p.admissionId;

    const queries = [
      { name: "shell", fn: () => db.admission.findUnique({ where: { id: aid }, include: { patient: true } }) },
      { name: "vitals", fn: () => db.vitalRecord.findMany({ where: { admissionId: aid }, orderBy: { recordedAt: "desc" as const }, include: { recordedBy: { select: { name: true } } } }) },
      { name: "meds", fn: () => db.treatmentPlan.findMany({ where: { admissionId: aid }, include: { administrations: { where: { scheduledDate: today } }, createdBy: { select: { name: true } } } }) },
      { name: "food", fn: () => db.dietPlan.findMany({ where: { admissionId: aid }, include: { feedingSchedules: { include: { feedingLogs: { where: { date: today }, take: 1 } } } } }) },
      { name: "notes", fn: () => db.clinicalNote.findMany({ where: { admissionId: aid }, orderBy: { recordedAt: "desc" as const }, include: { recordedBy: { select: { name: true, role: true } } } }) },
      { name: "labs", fn: () => db.labResult.findMany({ where: { admissionId: aid }, orderBy: { resultDate: "desc" as const } }) },
      { name: "bath", fn: () => db.bathLog.findMany({ where: { admissionId: aid }, orderBy: { bathedAt: "desc" as const }, include: { bathedBy: { select: { name: true } } } }) },
      { name: "logs", fn: async () => {
        const [medAdmins, vitals, feedings, baths, notes] = await Promise.all([
          db.medicationAdministration.findMany({ where: { treatmentPlan: { admissionId: aid }, OR: [{ wasAdministered: true }, { wasSkipped: true }] }, include: { treatmentPlan: { select: { drugName: true } }, administeredBy: { select: { name: true } } } }),
          db.vitalRecord.findMany({ where: { admissionId: aid }, select: { id: true, temperature: true, heartRate: true, recordedAt: true } }),
          db.feedingLog.findMany({ where: { feedingSchedule: { dietPlan: { admissionId: aid } }, status: { not: "PENDING" } }, include: { feedingSchedule: { select: { foodType: true } } } }),
          db.bathLog.findMany({ where: { admissionId: aid }, select: { id: true, bathedAt: true } }),
          db.clinicalNote.findMany({ where: { admissionId: aid }, select: { id: true, category: true, recordedAt: true } }),
        ]);
        return { meds: medAdmins.length, vitals: vitals.length, feedings: feedings.length, baths: baths.length, notes: notes.length };
      }},
    ];

    for (const q of queries) {
      const t = await timed(`patient ${q.name}`, q.fn);
      const detail = typeof t.result === "object" && t.result !== null && "length" in t.result ? `${(t.result as any[]).length} rows` : typeof t.result === "object" && t.result !== null && "meds" in t.result ? JSON.stringify(t.result) : "loaded";
      perf.recordTimed("F2-patient-page", t, t.durationMs > 500 ? "warn" : "pass", detail);
    }
  });

  await t.test("F3: schedule queries", async () => {
    const t1 = await timed("schedule meds", () =>
      db.treatmentPlan.findMany({
        where: { isActive: true, deletedAt: null, admission: { status: "ACTIVE", deletedAt: null, patient: { deletedAt: null } } },
        include: { admission: { include: { patient: { select: { name: true } } } }, administrations: { where: { scheduledDate: today } } },
      }),
    );
    perf.recordTimed("F3-schedule", t1, t1.durationMs > 500 ? "warn" : "pass", `${t1.result.length} active plans`);

    const t2 = await timed("schedule feedings", () =>
      db.dietPlan.findMany({
        where: { isActive: true, admission: { status: "ACTIVE", deletedAt: null, patient: { deletedAt: null } } },
        include: { admission: { include: { patient: { select: { name: true } } } }, feedingSchedules: { where: { isActive: true }, include: { feedingLogs: { where: { date: today }, take: 1 } } } },
      }),
    );
    perf.recordTimed("F3-schedule", t2, t2.durationMs > 500 ? "warn" : "pass", `${t2.result.length} active diets`);
  });

  await t.test("F4: notification snapshot", async () => {
    const t1 = await timed("notification snapshot", () =>
      db.admission.findMany({
        where: { status: "ACTIVE", deletedAt: null, patient: { deletedAt: null } },
        include: { patient: { select: { name: true } }, treatmentPlans: { where: { isActive: true }, include: { administrations: { where: { scheduledDate: today } } } }, dietPlans: { where: { isActive: true }, include: { feedingSchedules: { where: { isActive: true }, include: { feedingLogs: { where: { date: today }, take: 1 } } } } }, bathLogs: { take: 1, orderBy: { bathedAt: "desc" as const } }, vitalRecords: { take: 1, orderBy: { recordedAt: "desc" as const } }, isolationProtocol: { include: { disinfectionLogs: { take: 1, orderBy: { performedAt: "desc" as const } } } } },
      }),
    );
    perf.recordTimed("F4-notifications", t1, t1.durationMs > 1000 ? "fail" : t1.durationMs > 500 ? "warn" : "pass", `${t1.result.length} admissions with full snapshot`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE G: LOGS AUDIT
// ═══════════════════════════════════════════════════════════════════════════

test("phase G: logs audit for 3 patients", { timeout: 60_000 }, async (t) => {
  const auditPatients = [patients[0], patients[4], patients[7]]; // General-Critical-1, ISO-CDV, ICU-Post-Op

  for (const p of auditPatients) {
    await t.test(`logs audit: ${p.name}`, async () => {
      const aid = p.admissionId;

      // Fetch all log sources
      const [medAdmins, vitals, feedings, baths, notes, disinfections] = await Promise.all([
        db.medicationAdministration.findMany({ where: { treatmentPlan: { admissionId: aid }, OR: [{ wasAdministered: true }, { wasSkipped: true }] } }),
        db.vitalRecord.findMany({ where: { admissionId: aid } }),
        db.feedingLog.findMany({ where: { feedingSchedule: { dietPlan: { admissionId: aid } }, status: { not: "PENDING" } } }),
        db.bathLog.findMany({ where: { admissionId: aid } }),
        db.clinicalNote.findMany({ where: { admissionId: aid } }),
        p.isolationProtocolId ? db.disinfectionLog.findMany({ where: { isolationProtocolId: p.isolationProtocolId } }) : Promise.resolve([]),
      ]);

      const totalEntries = medAdmins.length + vitals.length + feedings.length + baths.length + notes.length + disinfections.length;

      // Verify no entries from other patients leaked in
      for (const v of vitals) assert.equal(v.admissionId, aid, "Vitals should belong to this admission");
      for (const n of notes) assert.equal(n.admissionId, aid, "Notes should belong to this admission");
      for (const b of baths) assert.equal(b.admissionId, aid, "Baths should belong to this admission");

      const detail = `meds=${medAdmins.length} vitals=${vitals.length} feedings=${feedings.length} baths=${baths.length} notes=${notes.length} disinfections=${disinfections.length}`;
      perf.record("G-logs-audit", p.name, 0, totalEntries > 0 ? "pass" : "fail", `${totalEntries} total entries: ${detail}`);

      // Verify expected minimum entries
      assert.ok(vitals.length >= 2, `${p.name} should have at least 2 vital records (morning + evening)`);
      assert.ok(notes.length >= 1, `${p.name} should have at least 1 clinical note`);
      if (p.meds.length > 0) assert.ok(medAdmins.length >= 1, `${p.name} should have at least 1 med administration`);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE H: REPORT
// ═══════════════════════════════════════════════════════════════════════════

test("phase H: write drill report", async () => {
  const reportPath = await perf.writeReport("test-results/real-system", DRILL_ID);
  console.log(`\n📊 Drill report: ${reportPath}`);

  const summary = perf.getSummary();
  console.log(`   Total operations: ${summary.total}`);
  console.log(`   Passed: ${summary.passed} | Warnings: ${summary.warned} | Failed: ${summary.failed}`);
  if (summary.slowest.length > 0) {
    console.log(`   Top 3 slowest:`);
    for (const s of summary.slowest.slice(0, 3)) {
      console.log(`     ${s.durationMs}ms — ${s.scenario} > ${s.action}`);
    }
  }
  console.log();
});
