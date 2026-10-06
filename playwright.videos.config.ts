import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

// `npm run videos`: the team's training videos, filmed on a copy of
// a real import, so they stay out of the repo: VIDEO_DB is the database to copy,
// VIDEO_FILMER the email of an owner in it who films, and the videos go to VIDEO_OUT.
const port = 3400;
export const copy = join(tmpdir(), "norless-videos.db");
export const out = process.env.VIDEO_OUT ?? join(homedir(), "norless-videos");

export default defineConfig({
  testDir: "e2e/videos",
  workers: 1,
  reporter: "list",
  timeout: 300_000,
  use: { baseURL: `http://127.0.0.1:${port}`, actionTimeout: 15_000 },
  webServer: {
    // A consistent copy, even while a dev server has the database open.
    command: `rm -f "${copy}"* && sqlite3 "\${VIDEO_DB:?VIDEO_DB: the database to film}" ".backup '${copy}'" && npm run build && npm start`,
    url: `http://127.0.0.1:${port}/api/health`,
    env: {
      PORT: String(port),
      DATABASE_PATH: copy,
      DEV_LOGIN: "1",
      APP_ORIGIN: `http://127.0.0.1:${port}`,
    },
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
