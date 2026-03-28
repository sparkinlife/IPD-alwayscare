export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getTodayUTCDate } from "@/lib/date-utils";
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
import { LogsTab } from "@/components/patient/logs-tab";
import { PhotosTab } from "@/components/patient/photos-tab";

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

  const today = getTodayUTCDate();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

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
        where: { deletedAt: null },
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
        where: { deletedAt: null },
        include: {
          feedingSchedules: { include: { feedingLogs: { where: { date: { gte: sevenDaysAgo } }, orderBy: { date: "desc" }, include: { loggedBy: { select: { name: true } } } } } },
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

  const profilePhoto = await db.patientMedia.findFirst({
    where: { patientId: admission.patientId, isProfilePhoto: true },
    select: { fileId: true },
  });

  const patientMedia = await db.patientMedia.findMany({
    where: { patientId: admission.patientId },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { name: true } } },
  });

  // Fetch available cages for doctor transfer action
  let availableCages: Array<{ ward: string; cageNumber: string }> = [];
  if (isDoctor) {
    const [allCages, occupiedCages] = await Promise.all([
      db.cageConfig.findMany({
        where: { isActive: true },
        orderBy: { cageNumber: "asc" },
      }),
      db.admission.findMany({
        where: { status: "ACTIVE", deletedAt: null, id: { not: admissionId } },
        select: { ward: true, cageNumber: true },
      }),
    ]);
    const occupiedSet = new Set(
      occupiedCages
        .filter((a: any) => a.ward && a.cageNumber)
        .map((a: any) => `${a.ward}:${a.cageNumber}`)
    );
    availableCages = allCages
      .filter((c: any) => !occupiedSet.has(`${c.ward}:${c.cageNumber}`))
      .map((c: any) => ({ ward: c.ward, cageNumber: c.cageNumber }));
  }

  const isActive = admission.status === "ACTIVE";
  const canEdit = isDoctor && isActive;

  return (
    <div className={isDoctor ? "pb-32" : ""}>
      <PatientHeader admission={admission} isDoctor={isDoctor} profilePhotoFileId={profilePhoto?.fileId ?? null} />
      <TabNav ward={admission.ward} activeTab={tab} />

      {/* Tab content */}
      <div className="p-4">
        {tab === "vitals" && (
          <VitalsTab
            admissionId={admissionId}
            vitals={admission.vitalRecords}
            isDoctor={canEdit}
            admissionWeight={admission.patient.weight ?? null}
            patientName={admission.patient.name}
          />
        )}
        {tab === "meds" && (
          <MedsTab
            admissionId={admissionId}
            treatmentPlans={admission.treatmentPlans}
            fluidTherapies={admission.fluidTherapies}
            isDoctor={canEdit}
            patientName={admission.patient.name}
            staffName={session.name}
          />
        )}
        {tab === "food" && (
          <FoodTab admissionId={admissionId} dietPlans={admission.dietPlans} isDoctor={canEdit} patientName={admission.patient.name} />
        )}
        {tab === "notes" && (
          <NotesTab admissionId={admissionId} notes={admission.clinicalNotes} isDoctor={canEdit} />
        )}
        {tab === "logs" && (
          <LogsTab admission={admission} />
        )}
        {tab === "labs" && (
          <LabsTab admissionId={admissionId} labResults={admission.labResults} isDoctor={canEdit} />
        )}
        {tab === "bath" && (
          <BathTab admissionId={admissionId} bathLogs={admission.bathLogs} admissionDate={admission.admissionDate} isDoctor={canEdit} patientName={admission.patient.name} />
        )}
        {tab === "isolation" && admission.isolationProtocol && (
          <IsolationTab admissionId={admissionId} isolationProtocol={admission.isolationProtocol} labResults={admission.labResults} isDoctor={canEdit} patientName={admission.patient.name} />
        )}
        {tab === "photos" && (
          <PhotosTab
            patientId={admission.patientId}
            patientName={admission.patient.name}
            media={patientMedia}
            isDoctor={canEdit}
          />
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
