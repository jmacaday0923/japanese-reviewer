import { defineConfig, devices } from "@playwright/test";

// Browser tests run against the production build: run `npm run build` once,
// then `npm run test:e2e`. Playwright starts `next start` on its own port
// (3100 by default, so it never collides with `npm run dev` on 3000) and
// stops it when the run ends. Set E2E_PORT to use another port.
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next start --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    // Locally, reuse a server you already started on that port; CI always starts fresh
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
