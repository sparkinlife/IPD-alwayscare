import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type RealArtifactKind =
  | "patient"
  | "admission"
  | "staff"
  | "cage"
  | "media"
  | "drive-file"
  | "push-subscription"
  | "treatment-plan"
  | "vital-record"
  | "clinical-note"
  | "lab-result"
  | "bath-log"
  | "diet-plan"
  | "fluid-therapy"
  | "disinfection-log"
  | "url";

export type RealPhaseStatus = "passed" | "failed" | "skipped";

export interface RealArtifactRecord {
  kind: RealArtifactKind;
  label: string;
  id: string;
  details?: Record<string, string | number | boolean | null>;
}

export interface RealPhaseRecord {
  name: string;
  status: RealPhaseStatus;
  notes: string[];
  durationMs?: number;
}

function formatDatePart(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatTimePart(date: Date): string {
  return date.toISOString().slice(11, 19).replaceAll(":", "");
}

export function createRealRunContext({
  rootDir,
  now = new Date(),
}: {
  rootDir: string;
  now?: Date;
}) {
  const startedAt = now.toISOString();
  const runId = `TEST-RUN-${formatDatePart(now)}-${formatTimePart(now)}`;
  const artifacts: RealArtifactRecord[] = [];
  const phases: RealPhaseRecord[] = [];

  return {
    runId,
    rootDir,
    startedAt,

    artifactPrefix(label: string) {
      return `${runId}-${label}`;
    },

    taggedText(label: string) {
      return `${runId} ${label}`;
    },

    recordArtifact(artifact: RealArtifactRecord) {
      artifacts.push(artifact);
    },

    recordPhase(name: string, status: RealPhaseStatus, notes: string[], durationMs?: number) {
      phases.push({ name, status, notes, durationMs });
    },

    getArtifacts() {
      return [...artifacts];
    },

    getPhases() {
      return [...phases];
    },

    async writeReports() {
      const outputDir = path.join(rootDir, "test-results", "real-system");
      await mkdir(outputDir, { recursive: true });
      const jsonPath = path.join(outputDir, `${runId}.json`);
      const markdownPath = path.join(outputDir, `${runId}.md`);
      const finishedAt = new Date().toISOString();

      const payload = {
        runId,
        startedAt,
        finishedAt,
        artifacts,
        phases,
      };

      await writeFile(jsonPath, JSON.stringify(payload, null, 2));

      const md = [
        "# Real System Validation Report",
        "",
        `- Run ID: \`${runId}\``,
        `- Started: \`${startedAt}\``,
        `- Finished: \`${finishedAt}\``,
        "",
        "## Phases",
        "",
        ...phases.map((p) => {
          const dur = p.durationMs != null ? ` (${p.durationMs}ms)` : "";
          return `- **${p.name}**: ${p.status}${dur} — ${p.notes.join("; ")}`;
        }),
        "",
        "## Artifacts",
        "",
        ...artifacts.map((a) => `- \`${a.kind}\`: ${a.label} (\`${a.id}\`)`),
        "",
        "## Purge Checklist",
        "",
        `1. Delete DB records containing \`${runId}\``,
        `2. Delete Drive files containing \`${runId}\``,
        "3. Remove push subscriptions listed above",
        `4. Verify: \`SELECT count(*) FROM "Patient" WHERE name LIKE '%${runId}%'\` returns 0`,
        "",
      ];

      await writeFile(markdownPath, md.join("\n"));

      return { jsonPath, markdownPath };
    },
  };
}

export type RealRunContext = ReturnType<typeof createRealRunContext>;
