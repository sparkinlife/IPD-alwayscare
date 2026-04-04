export interface LogsAdmission {
  id: string;
  treatmentPlans: Array<{
    drugName: string;
    dose: string;
    route: string;
    administrations: Array<{
      scheduledTime: string;
      wasAdministered: boolean;
      wasSkipped: boolean;
      skipReason: string | null;
      actualTime: Date | null;
      createdAt: Date;
      administeredBy: { name: string } | null;
    }>;
  }>;
  vitalRecords: Array<{
    recordedAt: Date;
    temperature: number | null;
    heartRate: number | null;
    respRate: number | null;
    painScore: number | null;
    weight: number | null;
    recordedBy: { name: string };
  }>;
  dietPlans: Array<{
    feedingSchedules: Array<{
      scheduledTime: string;
      foodType: string;
      feedingLogs: Array<{
        status: string;
        createdAt: Date;
        loggedBy: { name: string } | null;
      }>;
    }>;
  }>;
  bathLogs: Array<{
    bathedAt: Date;
    bathedBy: { name: string } | null;
    notes: string | null;
  }>;
  clinicalNotes: Array<{
    recordedAt: Date;
    category: string;
    content: string;
    recordedBy: { name: string; role: string } | null;
  }>;
  isolationProtocol: {
    disinfectionLogs: Array<{
      performedAt: Date;
      performedBy: { name: string } | null;
    }>;
  } | null;
  fluidTherapies: Array<{
    fluidType: string;
    rate: string;
    startTime: Date;
    endTime: Date | null;
    createdBy: { name: string } | null;
    rateChanges: Array<{
      oldRate: string;
      newRate: string;
      changedAt: Date;
      changedBy: { name: string } | null;
      reason: string | null;
    }>;
  }>;
}
