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
 * quick.sh in a repository of its own, with an ssh that plays the VM, and a docker, gh
 * and npm that log each call; deploy.sh's start fails when asked.
 */
function fakeMac() {
  const dir = mkdtempSync(join(tmpdir(), "norless-quick-"));
  mkdirSync(join(dir, "deploy"));
  mkdirSync(join(dir, "bin"));
  copyFileSync("deploy/quick.sh", join(dir, "deploy/quick.sh"));
  const log = (name: string) =>
    script(join(dir, "bin", name), `echo "${name} $*" >> "${dir}/calls"`);
  // docker login reads the token, as the real one does: gh's pipe never breaks.
  script(
    join(dir, "bin/docker"),
    `echo "docker $*" >> "${dir}/calls"; [ "$1" = login ] && cat > /dev/null; true`,
  );
  log("npm");
  script(join(dir, "bin/node"), "echo v24.0.0");
  script(join(dir, "bin/gh"), `echo "gh $*" >> "${dir}/calls"; echo pavel`);
  script(
    join(dir, "bin/ssh"),
    `cmd="\${@: -1}"
echo "ssh $cmd" >> "${dir}/calls"
case "$cmd" in
  *IMAGE=*) echo ghcr.io/pavel/norless ;;
  *"uname -m"*) echo aarch64 ;;
  *"deploy.sh production"*start*) exit "\${START:-0}" ;;
esac`,
  );
  const git = (...args: string[]) =>
    spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
  git("init", "-q");
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src/app.ts"), "1");
  git("add", ".");
  git(
    "-c",
    "user.name=t",
    "-c",
    "user.email=t@example.com",
    "commit",
    "-q",
    "-m",
    "x",
  );
  const head = git("rev-parse", "--short=7", "HEAD").stdout.trim();
  const run = (env: Record<string, string> = {}) => {
    const result = spawnSync("bash", [join(dir, "deploy/quick.sh")], {
      env: {
        PATH: `${join(dir, "bin")}:${process.env.PATH}`,
        HOME: dir,
        ...env,
      },
      encoding: "utf8",
    });
    let calls = "";
    try {
      calls = readFileSync(join(dir, "calls"), "utf8");
    } catch {
      // Nothing was called.
    }
    return { ...result, calls };
  };
  return { dir, head, run };
}

test("the commit checked out is checked, built for the VM, pushed, started and switched to", () => {
  const { head, run } = fakeMac();
  const result = run();
  expect(result.status, result.stderr).toBe(0);
  const calls = result.calls.split("\n");
  const at = (text: string) => calls.findIndex((call) => call.includes(text));
  expect(at("npm run check")).toBe(0);
  expect(result.calls).toContain(
    `docker build --platform linux/arm64 --build-arg SOURCE_URL=https://github.com/pavel/norless`,
  );
  expect(at(`docker push ghcr.io/pavel/norless:sha-${head}`)).toBeGreaterThan(
    -1,
  );
  expect(
    at(`docker push ghcr.io/pavel/norless-converter:sha-${head}`),
  ).toBeLessThan(at(`production sha-${head} start`));
  expect(at(`production sha-${head} start`)).toBeLessThan(
    at(`production sha-${head} switch`),
  );
  expect(result.calls).toContain("runuser -u deploy -- ./deploy.sh");
});

test("uncommitted code stops it before anything is built", () => {
  const { dir, run } = fakeMac();
  writeFileSync(join(dir, "src/app.ts"), "2");
  const result = run();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("aren't committed");
  expect(result.calls).toBe("");
});

test("a new version that doesn't start isn't switched to", () => {
  const { head, run } = fakeMac();
  const result = run({ START: "1" });
  expect(result.status).toBe(1);
  expect(result.calls).toContain(`production sha-${head} start`);
  expect(result.calls).not.toContain("switch");
});
