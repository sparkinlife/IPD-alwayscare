import { updateTag } from "next/cache";
import {
  dashboardQueueTag,
  dashboardSetupTag,
  dashboardSummaryTag,
} from "@/lib/clinical-cache";

type DashboardTagKey = "summary" | "queue" | "setup";

const dashboardTagFactories: Record<DashboardTagKey, () => string> = {
  summary: dashboardSummaryTag,
  queue: dashboardQueueTag,
  setup: dashboardSetupTag,
};

export function invalidateDashboardTags(...tags: DashboardTagKey[]) {
  for (const tag of new Set(tags)) {
    updateTag(dashboardTagFactories[tag]());
  }
}
