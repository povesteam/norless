import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

// `npm run screenshots`: the manual's screenshots, from demo data.
const port = 3300;

export default defineConfig({
  testDir: "e2e/screenshots",
  workers: 1,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${port}`, actionTimeout: 10_000 },
  globalTeardown: "./e2e/teardown.ts",
  webServer: [
    // Its own converter, for the slides' pages.
    {
      command: "npm run converter",
      env: { CONVERTER_PORT: "3902" },
      url: "http://127.0.0.1:3902/health",
      reuseExistingServer: false,
      timeout: 300_000,
    },
    {
      command: "npm run build && npx tsx e2e/screenshots/seed.ts && npm start",
      url: `http://127.0.0.1:${port}/api/health`,
      env: {
        PORT: String(port),
        DATABASE_PATH: join(tmpdir(), "norless-screenshots.db"),
        DEV_LOGIN: "1",
        APP_ORIGIN: `http://127.0.0.1:${port}`,
        CONVERTER_URL: "http://127.0.0.1:3902",
      },
      reuseExistingServer: false,
    },
  ],
});
