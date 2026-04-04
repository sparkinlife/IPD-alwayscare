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

  const [profilePhoto, availableCages] = await Promise.all([
    loadPlan.profilePhoto
      ? getPatientProfilePhoto(admission.patientId)
      : Promise.resolve(null),
    loadPlan.availableCages
      ? getAvailableCages(admissionId)
      : Promise.resolve([]),
  ]);

  const vitals = loadPlan.vitals
    ? await getPatientVitalsData(admissionId)
    : [];
  const medsData = loadPlan.meds
    ? await getPatientMedsData(admissionId, today)
    : { treatmentPlans: [], fluidTherapies: [] };
  const dietPlans = loadPlan.food
    ? await getPatientFoodData(admissionId, sevenDaysAgo)
    : [];
  const notes = loadPlan.notes
    ? await getPatientNotesData(admissionId)
    : [];
  const labResults = loadPlan.labs
    ? await getPatientLabsData(admissionId)
    : [];
  const bathLogs = loadPlan.bath
    ? await getPatientBathData(admissionId)
    : [];
  const isolationData = loadPlan.isolation
    ? await getPatientIsolationData(admissionId)
    : { isolationProtocol: null, labResults: [] };
  const logEntries = loadPlan.logs
    ? await getPatientLogsData(admissionId, today, sevenDaysAgo)
    : [];
  const patientMedia = loadPlan.photos
    ? await getPatientPhotosData(admission.patientId)
    : [];

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
            dietPlans={dietPlans}
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
