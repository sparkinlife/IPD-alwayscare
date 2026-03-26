import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isBathDue, getTodayIST } from "@/lib/date-utils";
import { TimeBlock } from "@/components/schedule/time-block";
import { ScheduleMedRow } from "@/components/schedule/schedule-med-row";
import { ScheduleFeedingRow } from "@/components/schedule/schedule-feeding-row";
import {
  BathDueSection,
  type BathDuePatient,
} from "@/components/schedule/bath-due-section";
import { CalendarClock } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MedTask {
  type: "med";
  hour: string;
  scheduledTime: string;
  treatmentPlan: {
    id: string;
    drugName: string;
    dose: string;
    route: string;
  };
  administration: {
    id: string;
    wasAdministered: boolean;
    wasSkipped: boolean;
    skipReason: string | null;
    actualTime: Date | null;
    administeredBy?: { name: string } | null;
  } | null;
  patientName: string;
  ward: string;
  cageNumber: string | null;
  admissionId: string;
}

interface FeedingTask {
  type: "feeding";
  hour: string;
  scheduledTime: string;
  feedingScheduleId: string;
  foodType: string;
  portion: string;
  todayLog: {
    id: string;
    date: Date;
    status: string;
    amountConsumed: string | null;
    notes: string | null;
  } | null;
  patientName: string;
  ward: string;
  cageNumber: string | null;
  admissionId: string;
}

type ScheduleTask = MedTask | FeedingTask;

interface HourGroup {
  hour: string;
  meds: MedTask[];
  feedings: FeedingTask[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SCHEDULE_HOURS = [
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
  "18:00", "19:00", "20:00", "21:00", "22:00", "23:00",
];

/** Map a "HH:mm" time to its nearest hour bucket within SCHEDULE_HOURS */
function getHourBucket(scheduledTime: string): string {
  const [hh] = scheduledTime.split(":").map(Number);
  // Round to the nearest schedule hour
  const bucket = `${String(hh).padStart(2, "0")}:00`;
  // If not in schedule range, fall back to first/last
  if (hh < 6) return "06:00";
  if (hh > 23) return "23:00";
  return bucket;
}

function isDone(task: ScheduleTask): boolean {
  if (task.type === "med") {
    return (
      task.administration?.wasAdministered === true ||
      task.administration?.wasSkipped === true
    );
  }
  const s = task.todayLog?.status;
  return s === "EATEN" || s === "PARTIAL" || s === "REFUSED" || s === "SKIPPED";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SchedulePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIST = getTodayIST();

  // Fetch all ACTIVE admissions with treatment plans, diet plans, bath logs
  const admissions = await db.admission.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
    },
    include: {
      patient: { select: { name: true } },
      treatmentPlans: {
        where: { isActive: true },
        include: {
          administrations: {
            where: { scheduledDate: today },
            include: { administeredBy: { select: { name: true } } },
          },
        },
      },
      dietPlans: {
        where: { isActive: true },
        include: {
          feedingSchedules: {
            include: {
              feedingLogs: {
                where: { date: today },
              },
            },
          },
        },
      },
      bathLogs: {
        orderBy: { bathedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { admissionDate: "desc" },
  });

  // ─── Build flat task list ────────────────────────────────────────────────

  const allTasks: ScheduleTask[] = [];

  for (const admission of admissions) {
    const patientName = admission.patient.name;
    const ward = admission.ward;
    const cageNumber = admission.cageNumber;
    const admissionId = admission.id;

    // Medication tasks
    for (const plan of admission.treatmentPlans) {
      for (const scheduledTime of plan.scheduledTimes) {
        const administration =
          plan.administrations.find((a) => a.scheduledTime === scheduledTime) ??
          null;

        allTasks.push({
          type: "med",
          hour: getHourBucket(scheduledTime),
          scheduledTime,
          treatmentPlan: {
            id: plan.id,
            drugName: plan.drugName,
            dose: plan.dose,
            route: plan.route as string,
          },
          administration,
          patientName,
          ward: ward as string,
          cageNumber,
          admissionId,
        });
      }
    }

    // Feeding tasks
    for (const dietPlan of admission.dietPlans) {
      for (const schedule of dietPlan.feedingSchedules) {
        const todayLog = schedule.feedingLogs[0] ?? null;

        allTasks.push({
          type: "feeding",
          hour: getHourBucket(schedule.scheduledTime),
          scheduledTime: schedule.scheduledTime,
          feedingScheduleId: schedule.id,
          foodType: schedule.foodType,
          portion: schedule.portion,
          todayLog,
          patientName,
          ward: ward as string,
          cageNumber,
          admissionId,
        });
      }
    }
  }

  // ─── Group tasks by hour ─────────────────────────────────────────────────

  const hourMap = new Map<string, HourGroup>();
  for (const h of SCHEDULE_HOURS) {
    hourMap.set(h, { hour: h, meds: [], feedings: [] });
  }

  for (const task of allTasks) {
    const group = hourMap.get(task.hour);
    if (!group) continue;
    if (task.type === "med") group.meds.push(task);
    else group.feedings.push(task);
  }

  // Sort tasks within each group by scheduledTime, then by patientName
  for (const group of hourMap.values()) {
    group.meds.sort(
      (a, b) =>
        a.scheduledTime.localeCompare(b.scheduledTime) ||
        a.patientName.localeCompare(b.patientName)
    );
    group.feedings.sort(
      (a, b) =>
        a.scheduledTime.localeCompare(b.scheduledTime) ||
        a.patientName.localeCompare(b.patientName)
    );
  }

  // ─── Compute bath-due patients ───────────────────────────────────────────

  const bathDuePatients: BathDuePatient[] = [];
  for (const admission of admissions) {
    const lastBath = admission.bathLogs[0]?.bathedAt ?? null;
    const reference = lastBath ?? admission.admissionDate;
    const { isDue: due, isOverdue: overdue, daysSinceLast } = isBathDue(reference);
    if (due) {
      bathDuePatients.push({
        admissionId: admission.id,
        patientName: admission.patient.name,
        ward: admission.ward as string,
        cageNumber: admission.cageNumber,
        daysSinceLast,
        isOverdue: overdue,
      });
    }
  }

  // Sort: overdue first, then by days descending
  bathDuePatients.sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    return b.daysSinceLast - a.daysSinceLast;
  });

  // ─── Compute totals ──────────────────────────────────────────────────────

  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter(isDone).length;

  const hourGroups = SCHEDULE_HOURS.map((h) => hourMap.get(h)!);
  const hasAnyTasks = totalTasks > 0;

  return (
    <div className="mx-auto max-w-2xl p-4 space-y-4">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Daily Schedule</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        {hasAnyTasks && (
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-sm font-semibold text-gray-800">
              {doneTasks}/{totalTasks}
            </span>
            <span className="text-xs text-gray-400">tasks done</span>
          </div>
        )}
      </div>

      {/* Bath due section */}
      <BathDueSection patients={bathDuePatients} />

      {/* No tasks state */}
      {!hasAnyTasks && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <CalendarClock className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No tasks scheduled</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Medications and feedings will appear here once assigned to active patients.
          </p>
        </div>
      )}

      {/* Hourly time blocks */}
      {hasAnyTasks && (
        <div>
          {hourGroups.map((group) => {
            const taskCount = group.meds.length + group.feedings.length;
            if (taskCount === 0) return null;

            const doneCount =
              group.meds.filter((t) => isDone(t)).length +
              group.feedings.filter((t) => isDone(t)).length;

            return (
              <TimeBlock
                key={group.hour}
                hour={group.hour}
                taskCount={taskCount}
                doneCount={doneCount}
              >
                {group.meds.map((task) => (
                  <ScheduleMedRow
                    key={`${task.treatmentPlan.id}-${task.scheduledTime}`}
                    treatmentPlan={task.treatmentPlan}
                    scheduledDate={todayIST}
                    scheduledTime={task.scheduledTime}
                    administration={task.administration}
                    patientName={task.patientName}
                    ward={task.ward}
                    cageNumber={task.cageNumber}
                  />
                ))}
                {group.feedings.map((task) => (
                  <ScheduleFeedingRow
                    key={`${task.feedingScheduleId}-${task.scheduledTime}`}
                    feedingScheduleId={task.feedingScheduleId}
                    scheduledTime={task.scheduledTime}
                    foodType={task.foodType}
                    portion={task.portion}
                    todayLog={task.todayLog}
                    patientName={task.patientName}
                    ward={task.ward}
                    cageNumber={task.cageNumber}
                  />
                ))}
              </TimeBlock>
            );
          })}
        </div>
      )}
    </div>
  );
}
