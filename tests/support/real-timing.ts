import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface TimedResult<T> {
  result: T;
  durationMs: number;
  label: string;
}

export async function timed<T>(label: string, fn: () => Promise<T>): Promise<TimedResult<T>> {
  const start = performance.now();
  const result = await fn();
  const durationMs = Math.round(performance.now() - start);
  return { result, durationMs, label };
}

export interface PerfEntry {
  scenario: string;
  action: string;
  durationMs: number;
  result: "pass" | "fail" | "warn";
  detail: string;
}

export function createPerfCollector() {
  const entries: PerfEntry[] = [];

  return {
    record(scenario: string, action: string, durationMs: number, result: PerfEntry["result"], detail: string) {
      entries.push({ scenario, action, durationMs, result, detail });
      const icon = result === "pass" ? "  ✓" : result === "warn" ? "  ⚠" : "  ✗";
      console.log(`${icon} [${durationMs}ms] ${scenario} > ${action}: ${detail}`);
    },

    recordTimed<T>(scenario: string, timedResult: TimedResult<T>, result: PerfEntry["result"], detail: string) {
      this.record(scenario, timedResult.label, timedResult.durationMs, result, detail);
    },

    getEntries() {
      return [...entries];
    },

    getSummary() {
      const total = entries.length;
      const passed = entries.filter((e) => e.result === "pass").length;
      const warned = entries.filter((e) => e.result === "warn").length;
      const failed = entries.filter((e) => e.result === "fail").length;
      const slowest = [...entries].sort((a, b) => b.durationMs - a.durationMs).slice(0, 5);
      return { total, passed, warned, failed, slowest };
    },

    async writeReport(outputDir: string, runId: string) {
      await mkdir(outputDir, { recursive: true });
      const reportPath = path.join(outputDir, `perf-${runId}.md`);

      const summary = this.getSummary();
      const lines: string[] = [
        `# Performance Report: ${runId}`,
        "",
        `- Total operations: ${summary.total}`,
        `- Passed: ${summary.passed}`,
        `- Warnings (>500ms): ${summary.warned}`,
        `- Failed: ${summary.failed}`,
        "",
        "## All Operations",
        "",
        "| Scenario | Action | Duration | Result | Detail |",
        "|----------|--------|----------|--------|--------|",
      ];

      for (const e of entries) {
        const flag = e.durationMs > 1000 ? " **SLOW**" : e.durationMs > 500 ? " ⚠" : "";
        lines.push(
          `| ${e.scenario} | ${e.action} | ${e.durationMs}ms${flag} | ${e.result} | ${e.detail} |`,
        );
      }

      lines.push("", "## Slowest Operations", "");
      for (const e of summary.slowest) {
        lines.push(`1. **${e.durationMs}ms** — ${e.scenario} > ${e.action}: ${e.detail}`);
      }

      lines.push("");
      await writeFile(reportPath, lines.join("\n"));
      return reportPath;
    },
  };
}
