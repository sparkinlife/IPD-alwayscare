import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { PatientHeader } from "@/components/patient/patient-header";
import { TabNav } from "@/components/patient/tab-nav";
import { DoctorActions } from "@/components/patient/doctor-actions";
import { VitalsTab } from "@/components/patient/vitals-tab";
import { MedsTab } from "@/components/patient/meds-tab";
import { FoodTab } from "@/components/patient/food-tab";
import { NotesTab } from "@/components/patient/notes-tab";
import { LabsTab } from "@/components/patient/labs-tab";

export default async function PatientDetailPage(props: {
  params: Promise<{ admissionId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { admissionId } = await props.params;
  const searchParams = await props.searchParams;
  const tab = searchParams?.tab || "vitals";

  const session = await getSession();
  const isDoctor = session?.role === "DOCTOR";

  const admission = await db.admission.findUnique({
    where: { id: admissionId },
    include: {
      patient: true,
      admittedBy: { select: { name: true, role: true } },
      dischargedBy: { select: { name: true } },
      vitalRecords: {
        orderBy: { recordedAt: "desc" },
        include: { recordedBy: { select: { name: true } } },
      },
      treatmentPlans: {
        include: {
          administrations: {
            orderBy: { scheduledTime: "asc" },
            include: { administeredBy: { select: { name: true } } },
          },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      fluidTherapies: {
        include: {
          rateChanges: {
            orderBy: { changedAt: "desc" },
            include: { changedBy: { select: { name: true } } },
          },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      dietPlans: {
        include: {
          feedingSchedules: { include: { feedingLogs: { orderBy: { date: "desc" } } } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      clinicalNotes: {
        orderBy: { recordedAt: "desc" },
        include: { recordedBy: { select: { name: true, role: true } } },
      },
      labResults: {
        orderBy: { resultDate: "desc" },
        include: { createdBy: { select: { name: true } } },
      },
      bathLogs: {
        orderBy: { bathedAt: "desc" },
        include: { bathedBy: { select: { name: true } } },
      },
      isolationProtocol: {
        include: {
          disinfectionLogs: {
            orderBy: { performedAt: "desc" },
            include: { performedBy: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!admission) notFound();

  // Fetch available cages for doctor transfer action
  let availableCages: Array<{ ward: string; cageNumber: string }> = [];
  if (isDoctor) {
    const [allCages, occupiedCages] = await Promise.all([
      db.cageConfig.findMany({
        where: { isActive: true },
        orderBy: { cageNumber: "asc" },
      }),
      db.admission.findMany({
        where: { status: "ACTIVE", id: { not: admissionId } },
        select: { cageNumber: true },
      }),
    ]);
    const occupiedSet = new Set(
      occupiedCages.map((a) => a.cageNumber).filter(Boolean) as string[]
    );
    availableCages = allCages
      .filter((c) => !occupiedSet.has(c.cageNumber))
      .map((c) => ({ ward: c.ward, cageNumber: c.cageNumber }));
  }

  const isActive = admission.status === "ACTIVE";

  return (
    <div className={isDoctor && isActive ? "pb-20" : ""}>
      <PatientHeader admission={admission} />
      <TabNav ward={admission.ward} activeTab={tab} />

      {/* Tab content — components plugged in during Tasks 11–18 */}
      <div className="p-4">
        {tab === "vitals" && (
          <VitalsTab admissionId={admissionId} vitals={admission.vitalRecords} />
        )}
        {tab === "meds" && (
          <MedsTab
            admissionId={admissionId}
            treatmentPlans={admission.treatmentPlans}
            fluidTherapies={admission.fluidTherapies}
            isDoctor={isDoctor}
          />
        )}
        {tab === "food" && (
          <FoodTab admissionId={admissionId} dietPlans={admission.dietPlans} isDoctor={session?.role === "DOCTOR"} />
        )}
        {tab === "notes" && (
          <NotesTab admissionId={admissionId} notes={admission.clinicalNotes} isDoctor={isDoctor} />
        )}
        {tab === "labs" && (
          <LabsTab admissionId={admissionId} labResults={admission.labResults} isDoctor={isDoctor} />
        )}
        {tab === "bath" && (
          <div className="text-sm text-gray-500">Bath content — coming in Task 17</div>
        )}
        {tab === "isolation" && admission.ward === "ISOLATION" && (
          <div className="text-sm text-gray-500">Isolation content — coming in Task 18</div>
        )}
      </div>

      {isDoctor && isActive && (
        <DoctorActions
          admissionId={admissionId}
          currentCondition={admission.condition}
          currentWard={admission.ward}
          availableCages={availableCages}
        />
      )}
    </div>
  );
}
