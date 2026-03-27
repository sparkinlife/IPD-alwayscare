export const dynamic = "force-dynamic";

import { TopHeader } from "@/components/layout/top-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { FAB } from "@/components/layout/fab";
import { NotificationProvider } from "@/components/layout/notification-provider";
import { CriticalBanner } from "@/components/layout/critical-banner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
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
