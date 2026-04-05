import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/actions/auth";
import { getSession } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AutoPushEnroll } from "@/components/management/auto-push-enroll";
import { LiveDashboardRefresh } from "@/components/management/live-dashboard-refresh";

async function ManagementLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }
  if (session.role !== "MANAGEMENT") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-clinic-bg">
      <AutoPushEnroll />
      <LiveDashboardRefresh />
      <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/management" className="text-sm font-semibold text-clinic-teal sm:text-base">
            Always Care IPD · Management
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-foreground sm:inline">{session.name}</span>
            <Badge className="bg-indigo-600 text-white" variant="default">
              MANAGEMENT
            </Badge>
            <form action={logout}>
              <Button type="submit" size="sm" variant="outline" className="h-8 px-3 text-xs">
                Log out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}

export default function ManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <ManagementLayoutContent>{children}</ManagementLayoutContent>
    </Suspense>
  );
}
