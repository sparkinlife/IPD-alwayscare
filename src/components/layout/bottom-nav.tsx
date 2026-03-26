"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, AlertTriangle, Archive, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "Home", icon: Home },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/isolation", label: "Isolation", icon: AlertTriangle },
  { href: "/archive", label: "Archive", icon: Archive },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-border bg-white pb-safe">
      <div className="flex h-full items-center justify-around">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition-colors",
                isActive ? "text-clinic-teal" : "text-gray-400"
              )}
            >
              <Icon
                className={cn("size-5", isActive ? "text-clinic-teal" : "text-gray-400")}
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
