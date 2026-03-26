export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ArchivePatientList } from "./archive-patient-list";

export default async function ArchivePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const isAdmin = session.role === "ADMIN";

  const archivedPatients = await db.patient.findMany({
    where: { deletedAt: { not: null } },
    include: {
      admissions: {
        include: {
          admittedBy: { select: { name: true } },
        },
        orderBy: { admissionDate: "desc" },
      },
    },
    orderBy: { deletedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
      <h1 className="text-lg font-semibold text-foreground">Archived Patients</h1>

      {archivedPatients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">No archived patients</p>
        </div>
      ) : (
        <ArchivePatientList patients={archivedPatients} isAdmin={isAdmin} />
      )}
    </div>
  );
}
