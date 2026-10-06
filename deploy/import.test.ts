import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

const script = (path: string, body: string) => {
  writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(path, 0o755);
};

/**
 * import.sh in a repository of its own, with an ssh that plays the VM (logging each
 * command, and keeping each database pushed to it), a run-reimport.sh and a rehearse.sh
 * that pass or fail as asked, and a sleep that doesn't wait.
 */
function fakeMac() {
  const dir = mkdtempSync(join(tmpdir(), "norless-import-"));
  mkdirSync(join(dir, "deploy"));
  mkdirSync(join(dir, "bin"));
  copyFileSync("deploy/import.sh", join(dir, "deploy/import.sh"));
  script(
    join(dir, "run-reimport.sh"),
    `[ "$1" = --keep ] && printf ' imported' >> "$DATABASE_PATH"`,
  );
  script(join(dir, "deploy/rehearse.sh"), `exit "\${REHEARSE:-0}"`);
  script(join(dir, "bin/sleep"), "");
  script(
    join(dir, "bin/ssh"),
    `cmd="\${@: -1}"
echo "$cmd" >> "${dir}/calls"
case "$cmd" in
  *PRODUCTION_TAG*) echo "$TAG" ;;
  *backup.js*) printf 'SQLite format 3 production' ;;
  *"cat > /data/import.db"*) cat >> "${dir}/pushed"; echo >> "${dir}/pushed" ;;
  *Health*) echo "\${HEALTH:-healthy}" ;;
esac`,
  );
  const git = (...args: string[]) =>
    spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
  git("init", "-q");
  git(
    "-c",
    "user.name=t",
    "-c",
    "user.email=t@example.com",
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "x",
  );
  const head = git("rev-parse", "--short=7", "HEAD").stdout.trim();
  const run = (env: Record<string, string> = {}) => {
    const result = spawnSync("bash", [join(dir, "deploy/import.sh")], {
      env: {
        PATH: `${join(dir, "bin")}:${process.env.PATH}`,
        HOME: dir,
        IMPORT_DIR: join(dir, "imports"),
        TAG: `sha-${head}`,
        ...env,
      },
      encoding: "utf8",
    });
    const read = (file: string) => {
      try {
        return readFileSync(join(dir, file), "utf8");
      } catch {
        return "";
      }
    };
    return { ...result, calls: read("calls"), pushed: read("pushed") };
  };
  return { run };
}

test("the import runs only on the commit production runs, and stops nothing otherwise", () => {
  const { run } = fakeMac();
  const result = run({ TAG: "sha-1234567" });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    "Production runs sha-1234567: check out that commit first",
  );
  expect(result.calls).not.toContain("stop");
});

test("production gets the imported copy of its own database, and starts again", () => {
  const { run } = fakeMac();
  const result = run();
  expect(result.status, result.stderr).toBe(0);
  expect(result.pushed).toBe("SQLite format 3 production imported\n");
  const calls = result.calls.split("\n");
  const at = (text: string) => calls.findIndex((call) => call.includes(text));
  expect(at("compose stop norless")).toBeGreaterThan(-1);
  expect(at("compose stop norless")).toBeLessThan(at("backup.js"));
  expect(at("cat > /data/import.db")).toBeLessThan(at("compose start norless"));
});

test("a failed rehearsal leaves production's database alone and starts it again", () => {
  const { run } = fakeMac();
  const result = run({ REHEARSE: "1" });
  expect(result.status).toBe(1);
  expect(result.pushed).toBe("");
  expect(result.calls).toContain("compose start norless");
  expect(result.stderr).toContain(
    "Production runs again on its own database, untouched.",
  );
});

test("production unhealthy on the imported data goes back to the copy from before", () => {
  const { run } = fakeMac();
  const result = run({ HEALTH: "unhealthy" });
  expect(result.status).toBe(1);
  expect(result.pushed).toBe(
    "SQLite format 3 production imported\nSQLite format 3 production\n",
  );
  expect(result.calls.trimEnd().split("\n").at(-1)).toContain(
    "compose start norless",
  );
});
