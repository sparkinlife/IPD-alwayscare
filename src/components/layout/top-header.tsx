import Link from "next/link";
import { getSession } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Home, Calendar, AlertTriangle, Archive, User, Settings } from "lucide-react";

export async function TopHeader() {
  const session = await getSession();

  const isAdminOrDoctor = session?.role === "ADMIN" || session?.role === "DOCTOR";

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-white px-4 shadow-sm">
      <Link href="/" className="text-base font-semibold text-clinic-teal">
        Always Care IPD
      </Link>

      {/* Desktop nav links */}
      <nav className="hidden items-center gap-1 md:flex">
        <Link href="/" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900">
          <Home className="size-4" />
          Home
        </Link>
        <Link href="/schedule" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900">
          <Calendar className="size-4" />
          Schedule
        </Link>
        <Link href="/isolation" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900">
          <AlertTriangle className="size-4" />
          Isolation
        </Link>
        <Link href="/archive" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900">
          <Archive className="size-4" />
          Archive
        </Link>
        {isAdminOrDoctor && (
          <Link href="/admin" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900">
            <Settings className="size-4" />
            Admin
          </Link>
        )}
        <Link href="/profile" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900">
          <User className="size-4" />
          Profile
        </Link>
      </nav>

      {session && (
        <div className="flex items-center gap-2">
          <span className="hidden text-sm font-medium text-foreground sm:block">
            {session.name}
          </span>
          <Badge className="bg-clinic-teal text-white" variant="default">
            {session.role}
          </Badge>
        </div>
      )}
    </header>
  );
}
