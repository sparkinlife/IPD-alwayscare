"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createStaff,
  toggleStaffActive,
  resetStaffPassword,
  addCage,
  toggleCageActive,
} from "@/actions/staff";

type StaffRole = "DOCTOR" | "PARAVET" | "ATTENDANT" | "ADMIN";
type Ward = "GENERAL" | "ISOLATION" | "ICU";

interface StaffMember {
  id: string;
  name: string;
  phone: string;
  role: StaffRole;
  isActive: boolean;
}

interface CageConfig {
  id: string;
  ward: Ward;
  cageNumber: string;
  isActive: boolean;
}

interface AdminClientProps {
  staffList: StaffMember[];
  cageList: CageConfig[];
}

const roleColors: Record<StaffRole, string> = {
  ADMIN: "bg-purple-100 text-purple-800",
  DOCTOR: "bg-blue-100 text-blue-800",
  PARAVET: "bg-teal-100 text-teal-800",
  ATTENDANT: "bg-gray-100 text-gray-800",
};

const wardLabels: Record<Ward, string> = {
  GENERAL: "General",
  ISOLATION: "Isolation",
  ICU: "ICU",
};

const wardColors: Record<Ward, string> = {
  GENERAL: "bg-green-100 text-green-800",
  ISOLATION: "bg-red-100 text-red-800",
  ICU: "bg-orange-100 text-orange-800",
};

// ── Add Staff Dialog ──────────────────────────────────────────────────────────

function AddStaffDialog() {
  const [open, setOpen] = React.useState(false);
  const [role, setRole] = React.useState<StaffRole>("ATTENDANT");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("role", role);
    const result = await createStaff(null, formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
    } else {
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Add Staff</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Staff Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="staff-name">Name</Label>
            <Input id="staff-name" name="name" placeholder="Full name" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="staff-phone">Phone</Label>
            <Input id="staff-phone" name="phone" placeholder="Phone number" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="staff-password">Password</Label>
            <Input
              id="staff-password"
              name="password"
              type="password"
              placeholder="Password"
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as StaffRole)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DOCTOR">Doctor</SelectItem>
                <SelectItem value="PARAVET">Paravet</SelectItem>
                <SelectItem value="ATTENDANT">Attendant</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Creating…" : "Create Staff"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Reset Password Dialog ─────────────────────────────────────────────────────

function ResetPasswordDialog({ staffId, staffName }: { staffId: string; staffName: string }) {
  const [open, setOpen] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await resetStaffPassword(staffId, password);
    setPending(false);
    if (result?.error) {
      setError(result.error);
    } else {
      setOpen(false);
      setPassword("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Reset Password</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password — {staffName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor={`new-pw-${staffId}`}>New Password</Label>
            <Input
              id={`new-pw-${staffId}`}
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Saving…" : "Save Password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Staff Row ─────────────────────────────────────────────────────────────────

function StaffRow({ staff }: { staff: StaffMember }) {
  const [pending, setPending] = React.useState(false);

  async function handleToggle() {
    setPending(true);
    await toggleStaffActive(staff.id);
    setPending(false);
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{staff.name}</p>
        <p className="text-xs text-muted-foreground">{staff.phone}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge className={roleColors[staff.role]} variant="outline">
          {staff.role}
        </Badge>
        <Badge
          className={staff.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
          variant="outline"
        >
          {staff.isActive ? "Active" : "Inactive"}
        </Badge>
        <Switch
          checked={staff.isActive}
          onCheckedChange={handleToggle}
          disabled={pending}
          aria-label={`Toggle ${staff.name} active`}
        />
        <ResetPasswordDialog staffId={staff.id} staffName={staff.name} />
      </div>
    </div>
  );
}

// ── Add Cage Form ─────────────────────────────────────────────────────────────

function AddCageForm() {
  const [ward, setWard] = React.useState<Ward>("GENERAL");
  const [cageNumber, setCageNumber] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);
    const formData = new FormData();
    formData.set("ward", ward);
    formData.set("cageNumber", cageNumber);
    const result = await addCage(null, formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setCageNumber("");
      setTimeout(() => setSuccess(false), 2000);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label>Ward</Label>
        <Select value={ward} onValueChange={(v) => setWard(v as Ward)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="GENERAL">General</SelectItem>
            <SelectItem value="ISOLATION">Isolation</SelectItem>
            <SelectItem value="ICU">ICU</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="cage-number">Cage Number</Label>
        <Input
          id="cage-number"
          placeholder="e.g. A1"
          value={cageNumber}
          onChange={(e) => setCageNumber(e.target.value)}
          className="w-28"
          required
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding…" : "Add Cage"}
      </Button>
      {error && <p className="w-full text-xs text-destructive">{error}</p>}
      {success && <p className="w-full text-xs text-green-600">Cage added successfully.</p>}
    </form>
  );
}

// ── Cage Row ──────────────────────────────────────────────────────────────────

function CageRow({ cage }: { cage: CageConfig }) {
  const [pending, setPending] = React.useState(false);

  async function handleToggle() {
    setPending(true);
    await toggleCageActive(cage.id);
    setPending(false);
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white p-3">
      <div className="flex items-center gap-2">
        <Badge className={wardColors[cage.ward]} variant="outline">
          {wardLabels[cage.ward]}
        </Badge>
        <span className="text-sm font-medium text-foreground">Cage {cage.cageNumber}</span>
      </div>
      <div className="flex items-center gap-2">
        <Badge
          className={cage.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
          variant="outline"
        >
          {cage.isActive ? "Active" : "Inactive"}
        </Badge>
        <Switch
          checked={cage.isActive}
          onCheckedChange={handleToggle}
          disabled={pending}
          aria-label={`Toggle cage ${cage.cageNumber}`}
        />
      </div>
    </div>
  );
}

// ── Main Admin Client ─────────────────────────────────────────────────────────

export function AdminClient({ staffList, cageList }: AdminClientProps) {
  const wardGroups: Record<Ward, CageConfig[]> = {
    GENERAL: cageList.filter((c) => c.ward === "GENERAL"),
    ISOLATION: cageList.filter((c) => c.ward === "ISOLATION"),
    ICU: cageList.filter((c) => c.ward === "ICU"),
  };

  return (
    <Tabs defaultValue="staff">
      <TabsList>
        <TabsTrigger value="staff">Staff Management</TabsTrigger>
        <TabsTrigger value="cages">Cage Configuration</TabsTrigger>
      </TabsList>

      {/* ── Staff Tab ── */}
      <TabsContent value="staff">
        <Card className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">
              Staff Members ({staffList.length})
            </h2>
            <AddStaffDialog />
          </div>
          {staffList.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No staff members yet. Add the first one.
            </p>
          ) : (
            <div className="space-y-2">
              {staffList.map((s) => (
                <StaffRow key={s.id} staff={s} />
              ))}
            </div>
          )}
        </Card>
      </TabsContent>

      {/* ── Cage Tab ── */}
      <TabsContent value="cages">
        <Card className="p-4">
          <h2 className="mb-4 text-base font-semibold text-foreground">Cage Configuration</h2>
          <div className="mb-6">
            <AddCageForm />
          </div>
          {cageList.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No cages configured yet.
            </p>
          ) : (
            <div className="space-y-6">
              {(["GENERAL", "ISOLATION", "ICU"] as Ward[]).map((ward) => {
                const cages = wardGroups[ward];
                if (cages.length === 0) return null;
                return (
                  <div key={ward}>
                    <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      {wardLabels[ward]} Ward
                    </h3>
                    <div className="space-y-2">
                      {cages.map((c) => (
                        <CageRow key={c.id} cage={c} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </TabsContent>
    </Tabs>
  );
}
