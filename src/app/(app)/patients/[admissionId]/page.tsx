import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getTodayUTCDate } from "@/lib/date-utils";
import {
  getPatientTabLoadPlan,
  normalizePatientTab,
} from "@/lib/patient-page-data";
import {
  getAvailableCages,
  getPatientBathData,
  getPatientFoodData,
  getPatientIsolationData,
  getPatientLabsData,
  getPatientLogsData,
  getPatientMedsData,
  getPatientNotesData,
  getPatientPageShell,
  getPatientPhotosData,
  getPatientProfilePhoto,
  getPatientVitalsData,
} from "@/lib/patient-page-queries";
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
  const tab = normalizePatientTab(searchParams?.tab);

  const session = await getSession();
  if (!session) redirect("/login");
  const isDoctor = session.role === "DOCTOR";

  const today = getTodayUTCDate();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const loadPlan = getPatientTabLoadPlan(tab, isDoctor);
  const admission = await getPatientPageShell(admissionId);

  if (!admission || admission.patient.deletedAt) notFound();

  const [
    profilePhoto,
    availableCages,
    vitals,
    medsData,
    foodData,
    notes,
    labResults,
    bathLogs,
    isolationData,
    logEntries,
    patientMedia,
  ] = await Promise.all([
    loadPlan.profilePhoto
      ? getPatientProfilePhoto(admission.patientId)
      : Promise.resolve(null),
    loadPlan.availableCages
      ? getAvailableCages(admissionId)
      : Promise.resolve([]),
    loadPlan.vitals ? getPatientVitalsData(admissionId) : Promise.resolve([]),
    loadPlan.meds
      ? getPatientMedsData(admissionId, today)
      : Promise.resolve({ treatmentPlans: [], fluidTherapies: [] }),
    loadPlan.food
      ? getPatientFoodData(admissionId, today, sevenDaysAgo)
      : Promise.resolve({ activePlan: null, historyEntries: [] }),
    loadPlan.notes ? getPatientNotesData(admissionId) : Promise.resolve([]),
    loadPlan.labs ? getPatientLabsData(admissionId) : Promise.resolve([]),
    loadPlan.bath ? getPatientBathData(admissionId) : Promise.resolve([]),
    loadPlan.isolation
      ? getPatientIsolationData(admissionId)
      : Promise.resolve({ isolationProtocol: null, labResults: [] }),
    loadPlan.logs
      ? getPatientLogsData(admissionId)
      : Promise.resolve([]),
    loadPlan.photos
      ? getPatientPhotosData(admission.patientId)
      : Promise.resolve([]),
  ]);

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
            vitals={vitals}
            isDoctor={canEdit}
            admissionWeight={admission.patient.weight ?? null}
            patientName={admission.patient.name}
          />
        )}
        {tab === "meds" && (
          <MedsTab
            admissionId={admissionId}
            treatmentPlans={medsData.treatmentPlans}
            fluidTherapies={medsData.fluidTherapies}
            isDoctor={canEdit}
            patientName={admission.patient.name}
            staffName={session.name}
          />
        )}
        {tab === "food" && (
          <FoodTab
            admissionId={admissionId}
            data={foodData}
            isDoctor={canEdit}
            patientName={admission.patient.name}
          />
        )}
        {tab === "notes" && (
          <NotesTab admissionId={admissionId} notes={notes} isDoctor={canEdit} />
        )}
        {tab === "logs" && (
          <LogsTab entries={logEntries} />
        )}
        {tab === "labs" && (
          <LabsTab
            admissionId={admissionId}
            labResults={labResults}
            isDoctor={canEdit}
          />
        )}
        {tab === "bath" && (
          <BathTab
            admissionId={admissionId}
            bathLogs={bathLogs}
            admissionDate={admission.admissionDate}
            isDoctor={canEdit}
            patientName={admission.patient.name}
          />
        )}
        {tab === "isolation" && isolationData.isolationProtocol && (
          <IsolationTab
            admissionId={admissionId}
            isolationProtocol={isolationData.isolationProtocol}
            labResults={isolationData.labResults}
            isDoctor={canEdit}
            patientName={admission.patient.name}
          />
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
