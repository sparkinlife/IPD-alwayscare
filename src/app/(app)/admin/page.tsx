import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminClient } from "./admin-client";

export default async function AdminPage() {
  const session = await getSession();

  if (!session || (session.role !== "ADMIN" && session.role !== "DOCTOR")) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <h2 className="text-base font-semibold text-destructive">Access Denied</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You do not have permission to view this page.
          </p>
        </div>
      </div>
    );
  }

  const [staffList, cageList] = await Promise.all([
    db.staff.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
      },
    }),
    db.cageConfig.findMany({
      orderBy: [{ ward: "asc" }, { cageNumber: "asc" }],
      select: {
        id: true,
        ward: true,
        cageNumber: true,
        isActive: true,
      },
    }),
  ]);

  return (
    <div className="p-4">
      <div className="mx-auto max-w-2xl space-y-4 pt-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Manage staff accounts and cage configuration.
          </p>
        </div>
        <AdminClient staffList={staffList} cageList={cageList} />
      </div>
    </div>
  );
}
