"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface Tab {
  key: string;
  label: string;
}

const BASE_TABS: Tab[] = [
  { key: "vitals", label: "Vitals" },
  { key: "meds", label: "Meds" },
  { key: "food", label: "Food" },
  { key: "notes", label: "Notes" },
  { key: "logs", label: "Logs" },
  { key: "labs", label: "Labs" },
  { key: "bath", label: "Bath" },
  { key: "photos", label: "Photos" },
];

const ISOLATION_TAB: Tab = { key: "isolation", label: "Isolation" };

interface TabNavProps {
  ward: string | null;
  activeTab: string;
}

export function TabNav({ ward, activeTab }: TabNavProps) {
  const pathname = usePathname();
  const [pressedTab, setPressedTab] = useState<string | null>(null);
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  const tabs =
    ward === "ISOLATION" ? [...BASE_TABS, ISOLATION_TAB] : BASE_TABS;

  function setPendingWithTimeout(tabKey: string) {
    setPendingTab(tabKey);
    setTimeout(() => {
      setPendingTab((current) => (current === tabKey ? null : current));
    }, 8000);
  }

  function handleNavigateIntent(tabKey: string) {
    if (tabKey === activeTab || tabKey === pendingTab) {
      return false;
    }
    setPendingWithTimeout(tabKey);
    return true;
  }

  function clearPressedTab(tabKey: string) {
    setTimeout(() => {
      setPressedTab((current) => (current === tabKey ? null : current));
    }, 120);
  }

  return (
    <div className="bg-white border-b border-gray-200 overflow-x-auto">
      <div className="flex min-w-max">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const isPending = pendingTab === tab.key && tab.key !== activeTab;
          const isPressed = pressedTab === tab.key;
          return (
            <Link
              key={tab.key}
              href={`${pathname}?tab=${tab.key}`}
              aria-busy={isPending || undefined}
              aria-current={isActive ? "page" : undefined}
              data-pending={isPending ? "true" : "false"}
              data-pressed={isPressed ? "true" : "false"}
              onPointerDown={() => setPressedTab(tab.key)}
              onPointerUp={() => clearPressedTab(tab.key)}
              onPointerCancel={() => clearPressedTab(tab.key)}
              onPointerLeave={() => clearPressedTab(tab.key)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  setPressedTab(tab.key);
                }
              }}
              onKeyUp={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  clearPressedTab(tab.key);
                }
              }}
              onClick={(event) => {
                const shouldNavigate = handleNavigateIntent(tab.key);
                if (!shouldNavigate) {
                  event.preventDefault();
                }
              }}
              className={cn(
                "patient-tab-link relative inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                isActive
                  ? "border-clinic-teal text-clinic-teal"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
                isPending && "text-gray-500"
              )}
            >
              <span>{tab.label}</span>
              <span
                className="patient-tab-pending-indicator"
                data-pending={isPending ? "true" : "false"}
                aria-hidden="true"
              />
              {isPending && <span className="sr-only">Loading {tab.label}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
