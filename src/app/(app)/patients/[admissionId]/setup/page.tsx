export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ClinicalSetupForm } from "@/components/forms/clinical-setup-form";

export default async function ClinicalSetupPage({
  params,
}: {
  params: Promise<{ admissionId: string }>;
}) {
  const { admissionId } = await params;

  const session = await getSession();
  if (!session || session.role !== "DOCTOR") redirect("/");

  const admission = await db.admission.findUnique({
    where: { id: admissionId },
    include: { patient: true },
  });
  if (!admission || admission.status !== "REGISTERED") redirect("/");

  const [cages, doctors, occupiedCages] = await Promise.all([
    db.cageConfig.findMany({
      where: { isActive: true },
      orderBy: { cageNumber: "asc" },
    }),
    db.staff.findMany({
      where: { role: "DOCTOR", isActive: true },
      select: { id: true, name: true },
    }),
    db.admission.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      select: { cageNumber: true },
    }),
  ]);

  const occupiedSet = new Set(
    occupiedCages.map((a) => a.cageNumber).filter(Boolean) as string[]
  );
  const availableCages = cages.filter((c) => !occupiedSet.has(c.cageNumber));

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-1">Clinical Setup</h2>
      <p className="text-sm text-gray-500 mb-4">
        Complete admission for {admission.patient.name} (
        {admission.patient.breed || admission.patient.species})
      </p>
      <ClinicalSetupForm
        admissionId={admissionId}
        availableCages={availableCages.map((c) => ({
          ward: c.ward,
          cageNumber: c.cageNumber,
        }))}
        activeDoctors={doctors}
      />
    </div>
  );
}
