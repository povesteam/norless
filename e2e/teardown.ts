import { execSync } from "node:child_process";

/**
 * Playwright stops `docker run`, not its container: the e2e run's converter (3901) and
 * the screenshots' (3902) go here.
 */
export default function teardown() {
  for (const port of [3901, 3902])
    try {
      execSync(`docker rm -f norless-converter-${port}`, { stdio: "ignore" });
    } catch {
      // Not running.
    }
}
