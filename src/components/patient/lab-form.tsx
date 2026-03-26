"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addLabResult } from "@/actions/labs";

interface LabFormProps {
  admissionId: string;
}

const LAB_TEST_TYPES = [
  { value: "CBC", label: "CBC — Complete Blood Count" },
  { value: "BLOOD_CHEMISTRY", label: "Blood Chemistry" },
  { value: "PCR", label: "PCR" },
  { value: "URINALYSIS", label: "Urinalysis" },
  { value: "FECAL_EXAM", label: "Fecal Exam" },
  { value: "XRAY", label: "X-Ray" },
  { value: "ULTRASOUND", label: "Ultrasound" },
  { value: "SEROLOGY", label: "Serology" },
  { value: "SKIN_SCRAPING", label: "Skin Scraping" },
  { value: "OTHER", label: "Other" },
] as const;

export function LabForm({ admissionId }: LabFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testType, setTestType] = useState("");
  const [isAbnormal, setIsAbnormal] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    if (testType) formData.set("testType", testType);
    formData.set("isAbnormal", isAbnormal ? "true" : "false");

    const result = await addLabResult(admissionId, formData);
    setLoading(false);

    if (result?.error) {
      toast.error(result.error);
    } else if (result?.success) {
      toast.success("Lab result added");
      setOpen(false);
      setTestType("");
      setIsAbnormal(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button className="w-full gap-2" />
        }
      >
        <FlaskConical className="w-4 h-4" />
        Add Lab Result
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto pb-safe">
        <SheetHeader>
          <SheetTitle>Add Lab Result</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="px-4 pb-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Test Type</Label>
            <Select value={testType} onValueChange={(v) => setTestType(v ?? "")}>
              <SelectTrigger className="w-full h-12">
                <SelectValue placeholder="Select test type" />
              </SelectTrigger>
              <SelectContent>
                {LAB_TEST_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="testName">Test Name</Label>
            <Input
              id="testName"
              name="testName"
              type="text"
              placeholder="e.g., CBC with differential"
              className="h-12"
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="result">Result</Label>
            <Textarea
              id="result"
              name="result"
              placeholder="Enter result values..."
              rows={4}
              required
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Abnormal Result</p>
              <p className="text-xs text-muted-foreground">Flag this result as abnormal</p>
            </div>
            <Switch
              checked={isAbnormal}
              onCheckedChange={setIsAbnormal}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Interpretation or additional notes..."
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reportUrl">Report URL (optional)</Label>
            <Input
              id="reportUrl"
              name="reportUrl"
              type="url"
              placeholder="Google Drive link — upload integration coming soon"
              className="h-12"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Saving..." : "Save Result"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
