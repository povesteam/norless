import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  globalTeardown: "./e2e/teardown.ts",
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  // The service worker would hide requests from page.route; the PWA test allows it.
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    locale: "en-US",
    // Moments show in the viewer's time zone: the seeded communities' own, whatever the machine's.
    timezoneId: "Europe/Bucharest",
    serviceWorkers: "block",
    // A test that fails on CI is traced on its retry, and CI keeps the traces.
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      // The manual's screenshots and the training videos run on their own (`npm run
      // screenshots`, `npm run videos`), and the live
      // and Classic tests in the projects below.
      testIgnore: ["screenshots/**", "videos/**", "live/**", "classic/**"],
      use: { ...devices["Desktop Chrome"] },
    },
    // Unu-Unu's one room: its live tests run one at a time, across their files.
    {
      name: "live",
      testMatch: "live/*.spec.ts",
      workers: 1,
      use: { ...devices["Desktop Chrome"] },
    },
    // Clasic's room too, in file order: the first test expects nothing live yet.
    {
      name: "classic",
      testMatch: "classic/*.spec.ts",
      workers: 1,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    // The converter's container, as in production: its own on 3901,
    // fresh each run and removed after it (e2e/teardown.ts), beside run-dev.sh's on 3900.
    {
      command: "npm run converter",
      env: { CONVERTER_PORT: "3901" },
      url: "http://127.0.0.1:3901/health",
      reuseExistingServer: false,
      timeout: 300_000,
    },
    {
      command: "npm run build && npx tsx e2e/seed.ts && npm start",
      url: `http://127.0.0.1:${port}/api/health`,
      env: {
        PORT: String(port),
        DATABASE_PATH: join(tmpdir(), "norless-e2e.db"),
        DEV_LOGIN: "1",
        // Login links point here.
        APP_ORIGIN: `http://127.0.0.1:${port}`,
        // Reads the ideas sent to the app team.
        APP_TEAM_EMAILS: "app-team@example.com",
        // As behind Caddy: a test can come from an address of its own (X-Forwarded-For),
        // away from limits per address that the whole run shares.
        TRUST_PROXY: "1",
        CONVERTER_URL: "http://127.0.0.1:3901",
      },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
