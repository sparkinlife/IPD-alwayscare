export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { TopHeader } from "@/components/layout/top-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { FAB } from "@/components/layout/fab";
import { NotificationProvider } from "@/components/layout/notification-provider";
import { CriticalBanner } from "@/components/layout/critical-banner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "MANAGEMENT") redirect("/management");

  return (
    <NotificationProvider>
      <TopHeader />
      <CriticalBanner />
      <main className="pb-20">{children}</main>
      <FAB />
      <BottomNav />
    </NotificationProvider>
  );
}
