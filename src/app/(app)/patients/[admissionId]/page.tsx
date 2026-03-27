export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { toZonedTime } from "date-fns-tz";
import { startOfDay } from "date-fns";
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
import { BathTab } from "@/components/patient/bath-tab";
import { IsolationTab } from "@/components/patient/isolation-tab";

export default async function PatientDetailPage(props: {
  params: Promise<{ admissionId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { admissionId } = await props.params;
  const searchParams = await props.searchParams;
  const tab = searchParams?.tab || "vitals";

  const session = await getSession();
  if (!session) redirect("/login");
  const isDoctor = session.role === "DOCTOR";

  // Compute IST-aware "today" for filtering administrations and feeding logs
  const nowIST = toZonedTime(new Date(), "Asia/Kolkata");
  const today = startOfDay(nowIST);

  const admission = await db.admission.findUnique({
    where: { id: admissionId, deletedAt: null },
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
            where: { scheduledDate: today },
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
          feedingSchedules: { include: { feedingLogs: { where: { date: today }, orderBy: { date: "desc" } } } },
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

  if (!admission || admission.patient.deletedAt) notFound();

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
    <div className={isDoctor ? "pb-32" : ""}>
      <PatientHeader admission={admission} isDoctor={isDoctor} />
      <TabNav ward={admission.ward} activeTab={tab} />

      {/* Tab content */}
      <div className="p-4">
        {tab === "vitals" && (
          <VitalsTab
            admissionId={admissionId}
            vitals={admission.vitalRecords}
            isDoctor={isDoctor}
            admissionWeight={admission.patient.weight ?? null}
            patientName={admission.patient.name}
          />
        )}
        {tab === "meds" && (
          <MedsTab
            admissionId={admissionId}
            treatmentPlans={admission.treatmentPlans}
            fluidTherapies={admission.fluidTherapies}
            isDoctor={isDoctor}
            patientName={admission.patient.name}
          />
        )}
        {tab === "food" && (
          <FoodTab admissionId={admissionId} dietPlans={admission.dietPlans} isDoctor={session.role === "DOCTOR"} patientName={admission.patient.name} />
        )}
        {tab === "notes" && (
          <NotesTab admissionId={admissionId} notes={admission.clinicalNotes} isDoctor={isDoctor} />
        )}
        {tab === "labs" && (
          <LabsTab admissionId={admissionId} labResults={admission.labResults} isDoctor={isDoctor} />
        )}
        {tab === "bath" && (
          <BathTab admissionId={admissionId} bathLogs={admission.bathLogs} admissionDate={admission.admissionDate} isDoctor={isDoctor} patientName={admission.patient.name} />
        )}
        {tab === "isolation" && admission.isolationProtocol && (
          <IsolationTab admissionId={admissionId} isolationProtocol={admission.isolationProtocol} labResults={admission.labResults} isDoctor={session.role === "DOCTOR"} patientName={admission.patient.name} />
        )}
      </div>

      {isDoctor && (
        <DoctorActions
          admissionId={admissionId}
          currentCondition={admission.condition}
          currentWard={admission.ward}
          availableCages={availableCages}
          isActive={isActive}
        />
      )}
    </div>
  );
}
