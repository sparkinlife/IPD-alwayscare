import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium, type Browser, type Page } from "playwright";

export interface LocalAppHandle {
  baseUrl: string;
  process: ChildProcess | null;
}

export async function waitForServer(baseUrl: string, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.ok || response.status === 307 || response.status === 302) return;
    } catch {
      // keep polling
    }
    await sleep(2000);
  }
  throw new Error(`Server at ${baseUrl} did not become ready within ${timeoutMs}ms`);
}

export async function startLocalApp(): Promise<LocalAppHandle> {
  const baseUrl = "http://127.0.0.1:3000";

  // Check if server is already running
  try {
    const res = await fetch(`${baseUrl}/login`);
    if (res.ok || res.status === 307 || res.status === 302) {
      return { baseUrl, process: null };
    }
  } catch {
    // Not running, start it
  }

  const child = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", "3000"], {
    stdio: "pipe",
    cwd: process.cwd(),
    env: { ...process.env },
    detached: false,
  });

  child.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    if (text.includes("Error") || text.includes("error")) {
      console.error("[dev-server]", text.trim());
    }
  });

  await waitForServer(baseUrl);
  return { baseUrl, process: child };
}

export async function stopLocalApp(handle: LocalAppHandle) {
  if (handle.process) {
    handle.process.kill("SIGTERM");
    await sleep(1000);
  }
}

export interface BrowserHandle {
  browser: Browser;
  page: Page;
}

export async function openBrowser(baseUrl: string, permissions: string[] = []): Promise<BrowserHandle> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: baseUrl,
    permissions,
  });
  const page = await context.newPage();
  return { browser, page };
}

export async function closeBrowser(handle: BrowserHandle) {
  await handle.browser.close();
}

export async function loginAs(page: Page, phone: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Phone Number").fill(phone);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  // Wait for navigation after login
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
}

export async function fetchJsonAs<T>(page: Page, url: string, init?: RequestInit): Promise<T> {
  return page.evaluate(
    async ([resource, requestInit]) => {
      const response = await fetch(resource, requestInit as RequestInit | undefined);
      return response.json();
    },
    [url, init] as const,
  );
}
