"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PermanentDeleteButton } from "./permanent-delete-button";
import { formatDateTimeIST, formatIST } from "@/lib/date-utils";

interface Admission {
  id: string;
  admissionDate: Date;
  diagnosis: string | null;
  ward: string | null;
  status: string;
  admittedBy: { name: string };
}

interface Patient {
  id: string;
  name: string;
  breed: string | null;
  species: string;
  age: string | null;
  deletedAt: Date | null;
  admissions: Admission[];
}

interface ArchivePatientListProps {
  patients: Patient[];
  isAdmin: boolean;
}

function conditionBadgeClass(status: string) {
  switch (status) {
    case "ACTIVE": return "bg-green-100 text-green-700";
    case "DISCHARGED": return "bg-blue-100 text-blue-700";
    case "DECEASED": return "bg-gray-100 text-gray-600";
    default: return "bg-muted text-muted-foreground";
  }
}

export function ArchivePatientList({ patients, isAdmin }: ArchivePatientListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {patients.map((patient) => {
        const isExpanded = expandedIds.has(patient.id);
        const latestAdmission = patient.admissions[0];

        return (
          <Card key={patient.id}>
            <CardHeader className="border-b pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <CardTitle className="truncate">{patient.name}</CardTitle>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {patient.species.charAt(0) + patient.species.slice(1).toLowerCase()}
                    {patient.breed ? ` · ${patient.breed}` : ""}
                    {patient.age ? ` · ${patient.age}` : ""}
                  </p>
                  {latestAdmission?.diagnosis && (
                    <p className="mt-1 text-sm text-foreground">
                      {latestAdmission.diagnosis}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    {patient.admissions.length} admission{patient.admissions.length !== 1 ? "s" : ""}
                  </Badge>
                  {patient.deletedAt && (
                    <span className="text-xs text-muted-foreground">
                      Archived {formatDateTimeIST(patient.deletedAt)}
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-3">
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => toggleExpand(patient.id)}
                  className="flex items-center gap-1 text-sm font-medium text-clinic-teal hover:underline"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      Hide history
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Show admission history
                    </>
                  )}
                </button>
                {isAdmin && (
                  <PermanentDeleteButton patientId={patient.id} patientName={patient.name} />
                )}
              </div>

              {isExpanded && (
                <div className="mt-3 space-y-2 border-t pt-3">
                  {patient.admissions.map((admission) => (
                    <div
                      key={admission.id}
                      className="rounded-lg bg-muted/40 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground">
                          {formatIST(admission.admissionDate, "dd/MM/yyyy")}
                        </span>
                        <Badge
                          variant="outline"
                          className={conditionBadgeClass(admission.status)}
                        >
                          {admission.status.charAt(0) + admission.status.slice(1).toLowerCase()}
                        </Badge>
                      </div>
                      {admission.diagnosis && (
                        <p className="mt-0.5 text-muted-foreground">{admission.diagnosis}</p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        {admission.ward && <span>Ward: {admission.ward.charAt(0) + admission.ward.slice(1).toLowerCase()}</span>}
                        <span>By: {admission.admittedBy.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
