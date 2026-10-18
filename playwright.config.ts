import { defineConfig, devices } from "@playwright/test";

// Two ways to run:
// - Default: tests a local production server (`next start`) on port 3100,
//   which Playwright starts and stops. Run `npm run build` first.
// - E2E_BASE_URL set (for example https://japanese-reviewer.vercel.app):
//   tests that site as it is and starts no local server.
const externalBaseURL = process.env.E2E_BASE_URL?.trim().replace(/\/+$/, "") || undefined;
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = externalBaseURL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // On CI: annotations in the GitHub summary, plus an HTML report for the uploaded artifact
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: externalBaseURL
    ? undefined
    : {
        command: `npx next start --hostname 127.0.0.1 --port ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
