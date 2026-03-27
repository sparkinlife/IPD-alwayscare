"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { registerPatient } from "@/actions/admissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RegistrationFormProps {
  isDoctor?: boolean;
}

export function RegistrationForm({ isDoctor = false }: RegistrationFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(registerPatient, null);
  const [isStray, setIsStray] = useState(true);
  const [species, setSpecies] = useState("DOG");
  const [sex, setSex] = useState("UNKNOWN");

  useEffect(() => {
    if (!state) return;
    if ("success" in state && state.success) {
      toast.success("Patient registered");
      if (isDoctor && "admissionId" in state && state.admissionId) {
        router.push(`/patients/${state.admissionId}/setup`);
      } else {
        router.push("/");
      }
    }
    if ("error" in state && state.error) {
      toast.error(state.error);
    }
  }, [state, router, isDoctor]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Patient Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-5">
          {/* Hidden fields for controlled select/switch values */}
          <input type="hidden" name="species" value={species} />
          <input type="hidden" name="sex" value={sex} />
          <input type="hidden" name="isStray" value={String(isStray)} />

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">
              Patient Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="e.g., Bruno"
              className="h-12"
            />
          </div>

          {/* Species + Sex */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Species</Label>
              <Select value={species} onValueChange={(v) => setSpecies(v ?? "DOG")}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DOG">Dog</SelectItem>
                  <SelectItem value="CAT">Cat</SelectItem>
                  <SelectItem value="BIRD">Bird</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Sex</Label>
              <Select value={sex} onValueChange={(v) => setSex(v ?? "UNKNOWN")}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                  <SelectItem value="UNKNOWN">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Breed */}
          <div className="space-y-1.5">
            <Label htmlFor="breed">Breed</Label>
            <Input
              id="breed"
              name="breed"
              placeholder="e.g., Indian Pariah, Labrador Mix"
              className="h-12"
            />
          </div>

          {/* Age + Weight */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                name="age"
                placeholder="e.g., ~3 years, 4 months"
                className="h-12"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                name="weight"
                type="number"
                step="0.1"
                min="0"
                placeholder="kg"
                className="h-12"
              />
            </div>
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label htmlFor="color">Color / Markings</Label>
            <Input
              id="color"
              name="color"
              placeholder="e.g., Brown with white patch"
              className="h-12"
            />
          </div>

          {/* Photo URL */}
          <div className="space-y-1.5">
            <Label htmlFor="photoUrl">Photo URL</Label>
            <Input
              id="photoUrl"
              name="photoUrl"
              type="url"
              placeholder="https://..."
              className="h-12"
            />
          </div>

          {/* Is Stray toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium text-sm">Is this a stray animal?</p>
              <p className="text-xs text-muted-foreground">
                Toggle on for rescued/stray patients
              </p>
            </div>
            <Switch
              checked={isStray}
              onCheckedChange={setIsStray}
            />
          </div>

          {/* Stray-specific fields */}
          {isStray && (
            <div className="space-y-4 rounded-lg bg-muted/50 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="rescueLocation">Rescue Location</Label>
                <Input
                  id="rescueLocation"
                  name="rescueLocation"
                  placeholder="e.g., Near Andheri Station, Mumbai"
                  className="h-12"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rescuerInfo">Rescuer Info</Label>
                <Input
                  id="rescuerInfo"
                  name="rescuerInfo"
                  placeholder="e.g., Priya Sharma, 9876543210"
                  className="h-12"
                />
              </div>
            </div>
          )}

          {/* Doctor note */}
          {isDoctor && (
            <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-3 text-center">
              Clinical setup (diagnosis, ward, cage, medications) will be
              available after registration.
            </p>
          )}

          {/* Submit */}
          <Button
            type="submit"
            className="w-full h-12 text-base"
            disabled={isPending}
          >
            {isPending ? "Registering…" : "Register Patient"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
