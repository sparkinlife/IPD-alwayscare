"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Pill,
  Utensils,
  Bath,
  ShieldAlert,
  HeartPulse,
  UserCheck,
  AlertCircle,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useNotifications, type Notification } from "./notification-provider";

// ─── Category icon map ──────────────────────────────────────────────────────

function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const cls = cn("size-4 shrink-0", className);
  switch (category) {
    case "MEDS":
      return <Pill className={cls} />;
    case "FOOD":
      return <Utensils className={cls} />;
    case "BATH":
      return <Bath className={cls} />;
    case "DISINFECTION":
      return <ShieldAlert className={cls} />;
    case "VITALS":
    case "CONDITION":
      return <HeartPulse className={cls} />;
    case "ADMISSION":
      return <UserCheck className={cls} />;
    default:
      return <AlertCircle className={cls} />;
  }
}

// ─── Type → colour mapping ──────────────────────────────────────────────────

function typeStyles(type: Notification["type"]) {
  switch (type) {
    case "urgent":
      return {
        row: "bg-red-50 border-l-4 border-red-500",
        badge: "bg-red-100 text-red-700",
        icon: "text-red-600",
      };
    case "critical":
      return {
        row: "bg-red-50 border-l-4 border-red-400",
        badge: "bg-red-100 text-red-700",
        icon: "text-red-500",
      };
    case "overdue":
      return {
        row: "bg-orange-50 border-l-4 border-orange-400",
        badge: "bg-orange-100 text-orange-700",
        icon: "text-orange-500",
      };
    case "due":
      return {
        row: "bg-amber-50 border-l-4 border-amber-400",
        badge: "bg-amber-100 text-amber-700",
        icon: "text-amber-600",
      };
    case "upcoming":
      return {
        row: "bg-blue-50 border-l-4 border-blue-400",
        badge: "bg-blue-100 text-blue-700",
        icon: "text-blue-500",
      };
    default: // info
      return {
        row: "bg-gray-50 border-l-4 border-gray-300",
        badge: "bg-gray-100 text-gray-600",
        icon: "text-gray-500",
      };
  }
}

// ─── Category → patient detail tab ─────────────────────────────────────────

function categoryToTab(category: string): string {
  switch (category) {
    case "MEDS":
      return "meds";
    case "FOOD":
      return "food";
    case "BATH":
      return "bath";
    case "DISINFECTION":
      return "isolation";
    case "VITALS":
    case "CONDITION":
      return "vitals";
    default:
      return "vitals";
  }
}

// ─── Single notification row ────────────────────────────────────────────────

function NotificationRow({
  notification,
  onNavigate,
}: {
  notification: Notification;
  onNavigate: (admissionId: string, tab: string) => void;
}) {
  const styles = typeStyles(notification.type);
  const tab = categoryToTab(notification.category);

  return (
    <button
      type="button"
      onClick={() => onNavigate(notification.admissionId, tab)}
      className={cn(
        "w-full rounded-md p-3 text-left transition-opacity active:opacity-70",
        styles.row
      )}
    >
      <div className="flex items-start gap-2.5">
        <CategoryIcon category={notification.category} className={styles.icon} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-gray-900 line-clamp-2">
            {notification.title}
          </p>
          {notification.description && (
            <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">
              {notification.description}
            </p>
          )}
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium text-gray-700">
              {notification.patientName}
            </span>
            {notification.timestamp && (
              <span className="text-xs text-gray-400">@ {notification.timestamp}</span>
            )}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                styles.badge
              )}
            >
              {notification.type}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Grouped section header ─────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="px-1 pt-3 pb-1 text-[11px] font-bold uppercase tracking-widest text-gray-400">
      {label}
    </p>
  );
}

// ─── Main bell component ────────────────────────────────────────────────────

export function NotificationBell() {
  const { notifications, count, refresh } = useNotifications();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function handleOpen(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) {
      // Refresh when the sheet opens so data is current
      refresh();
    }
  }

  function handleNavigate(admissionId: string, tab: string) {
    setOpen(false);
    router.push(`/patients/${admissionId}?tab=${tab}`);
  }

  // Group notifications
  const urgent = notifications.filter((n) => n.type === "urgent");
  const critical = notifications.filter((n) => n.type === "critical");
  const overdue = notifications.filter((n) => n.type === "overdue");
  const due = notifications.filter((n) => n.type === "due");
  const upcoming = notifications.filter((n) => n.type === "upcoming");
  const info = notifications.filter((n) => n.type === "info");

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      {/* Bell trigger */}
      <button
        type="button"
        aria-label={`Notifications${count > 0 ? `, ${count} unread` : ""}`}
        onClick={() => handleOpen(true)}
        className="relative flex size-9 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 active:bg-gray-200"
      >
        <Bell className="size-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {/* Sheet panel */}
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-sm p-0">
        <SheetHeader className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-semibold">
              Notifications
              {count > 0 && (
                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
                  {count}
                </span>
              )}
            </SheetTitle>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-3 pb-6">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <Bell className="size-10 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">All clear</p>
              <p className="text-xs text-gray-400">No pending notifications right now</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {urgent.length > 0 && (
                <>
                  <SectionLabel label="Urgent" />
                  {urgent.map((n) => (
                    <NotificationRow key={n.id} notification={n} onNavigate={handleNavigate} />
                  ))}
                </>
              )}
              {critical.length > 0 && (
                <>
                  <SectionLabel label="Critical" />
                  {critical.map((n) => (
                    <NotificationRow key={n.id} notification={n} onNavigate={handleNavigate} />
                  ))}
                </>
              )}
              {overdue.length > 0 && (
                <>
                  <SectionLabel label="Overdue" />
                  {overdue.map((n) => (
                    <NotificationRow key={n.id} notification={n} onNavigate={handleNavigate} />
                  ))}
                </>
              )}
              {due.length > 0 && (
                <>
                  <SectionLabel label="Due Now" />
                  {due.map((n) => (
                    <NotificationRow key={n.id} notification={n} onNavigate={handleNavigate} />
                  ))}
                </>
              )}
              {upcoming.length > 0 && (
                <>
                  <SectionLabel label="Upcoming" />
                  {upcoming.map((n) => (
                    <NotificationRow key={n.id} notification={n} onNavigate={handleNavigate} />
                  ))}
                </>
              )}
              {info.length > 0 && (
                <>
                  <SectionLabel label="Info" />
                  {info.map((n) => (
                    <NotificationRow key={n.id} notification={n} onNavigate={handleNavigate} />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
