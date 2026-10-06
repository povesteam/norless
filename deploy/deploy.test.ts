import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

const deploy = (request: string) =>
  spawnSync("bash", ["deploy/deploy.sh"], {
    env: { PATH: process.env.PATH, SSH_ORIGINAL_COMMAND: request },
    encoding: "utf8",
  });

test("the deploy key can ask only for production, a plain tag, and a step", () => {
  for (const request of [
    "",
    "rm -rf /",
    "production",
    "production main; reboot",
    "production $(reboot)",
    "production main extra",
    "production main switch now",
    "production ../../etc",
    "staging main",
  ]) {
    const result = deploy(request);
    expect(result.status, request).toBe(2);
    expect(result.stderr).toContain("usage: production <tag>");
  }
});

/**
 * deploy.sh in a folder of its own, with a docker that logs each call and answers the
 * health check for the containers in `healthy`: "candidate" and "service".
 */
function fakeServer(healthy: ("candidate" | "service" | "converter")[]) {
  const dir = mkdtempSync(join(tmpdir(), "norless-deploy-"));
  copyFileSync("deploy/deploy.sh", join(dir, "deploy.sh"));
  writeFileSync(
    join(dir, ".env"),
    "IMAGE=img\nPRODUCTION_TAG=old\nCONVERTER_PRODUCTION_TAG=old\n",
  );
  const bin = join(dir, "bin");
  mkdirSync(bin);
  writeFileSync(
    join(bin, "docker"),
    `#!/usr/bin/env bash
echo "PRODUCTION_TAG=\${PRODUCTION_TAG:-} $*" >> "${dir}/calls"
case "$*" in
  "compose ps --status"*) echo norless ;;
  "compose ps -q"*) echo service ;;
  "compose run"*) echo "$PRODUCTION_TAG" > "${dir}/candidate" ;;
  "rm -f"*) rm -f "${dir}/candidate" ;;
  "inspect"*) [ -f "${dir}/candidate" ] && echo "img:$(cat "${dir}/candidate")" ;;
  "exec norless-candidate node -e"*)
    [ -f "${dir}/candidate" ] && ${healthy.includes("candidate")} ;;
  "exec service node -e"*) ${healthy.includes("service")} ;;
  "compose exec -T converter node -e"*) ${healthy.includes("converter")} ;;
esac
`,
  );
  writeFileSync(join(bin, "sleep"), "#!/usr/bin/env bash\n");
  chmodSync(join(bin, "docker"), 0o755);
  chmodSync(join(bin, "sleep"), 0o755);
  const run = (request: string) =>
    spawnSync("bash", [join(dir, "deploy.sh")], {
      env: {
        PATH: `${bin}:${process.env.PATH}`,
        SSH_ORIGINAL_COMMAND: request,
      },
      encoding: "utf8",
    });
  const tag = () =>
    /^PRODUCTION_TAG=(.*)/m.exec(readFileSync(join(dir, ".env"), "utf8"))?.[1];
  const converterTag = () =>
    /^CONVERTER_PRODUCTION_TAG=(.*)/m.exec(
      readFileSync(join(dir, ".env"), "utf8"),
    )?.[1];
  const calls = () => readFileSync(join(dir, "calls"), "utf8");
  const candidate = () => existsSync(join(dir, "candidate"));
  return { run, tag, converterTag, calls, candidate };
}

test("a deploy backs up first, then starts the new image beside the running one, which keeps serving", () => {
  const server = fakeServer(["candidate", "service", "converter"]);
  const result = server.run("production sha-1a2b3c4");
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("confirm to switch");
  const calls = server.calls();
  expect(calls.indexOf("backup.js")).toBeLessThan(calls.indexOf("compose run"));
  expect(calls).toContain(
    "PRODUCTION_TAG=sha-1a2b3c4 compose run -d --no-deps --name norless-candidate norless",
  );
  // The running service wasn't touched.
  expect(server.tag()).toBe("old");
  expect(calls).not.toContain("compose up -d norless");
  expect(server.candidate()).toBe(true);
});

test("a broken image is stopped, and never takes the running one's place", () => {
  const server = fakeServer(["service", "converter"]);
  const result = server.run("production sha-broken");
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("goes on as it was");
  expect(server.candidate()).toBe(false);
  expect(server.tag()).toBe("old");
  expect(server.calls()).not.toContain("compose up -d norless");
  // And it can't be switched to.
  expect(server.run("production sha-broken switch").status).toBe(1);
  expect(server.tag()).toBe("old");
  expect(server.calls()).not.toContain("compose up -d norless");
});

test("confirmed, the service restarts on the new tag while the candidate stands in, then the candidate goes", () => {
  const server = fakeServer(["candidate", "service", "converter"]);
  server.run("production sha-1a2b3c4");
  // Another tag than the candidate's isn't switched to.
  expect(server.run("production sha-other switch").status).toBe(1);
  const result = server.run("production sha-1a2b3c4 switch");
  expect(result.status).toBe(0);
  expect(server.tag()).toBe("sha-1a2b3c4");
  const calls = server.calls();
  expect(calls.indexOf("compose up -d norless")).toBeLessThan(
    calls.lastIndexOf("rm -f norless-candidate"),
  );
  expect(server.candidate()).toBe(false);
});

test("a service that isn't healthy on the new tag goes back to the old one", () => {
  const server = fakeServer(["candidate", "converter"]);
  server.run("production sha-1a2b3c4");
  const result = server.run("production sha-1a2b3c4 switch");
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("goes back to old");
  expect(server.tag()).toBe("old");
  expect(server.calls().match(/compose up -d norless/g)).toHaveLength(2);
});

test("not confirmed, the candidate is dropped", () => {
  const server = fakeServer(["candidate", "service", "converter"]);
  server.run("production sha-1a2b3c4");
  expect(server.run("production sha-1a2b3c4 stop").status).toBe(0);
  expect(server.candidate()).toBe(false);
  expect(server.tag()).toBe("old");
});

test("the converter is updated first, and a converter that isn't healthy goes back and stops the deploy", () => {
  const server = fakeServer(["candidate", "service", "converter"]);
  expect(server.run("production sha-1a2b3c4").status).toBe(0);
  const calls = server.calls();
  expect(calls).toContain("PRODUCTION_TAG= compose up -d converter");
  expect(calls.indexOf("compose up -d converter")).toBeLessThan(
    calls.indexOf("compose run"),
  );
  expect(server.converterTag()).toBe("sha-1a2b3c4");

  const broken = fakeServer(["candidate", "service"]);
  const result = broken.run("production sha-broken");
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("the old one is back");
  expect(broken.converterTag()).toBe("old");
  expect(broken.calls().match(/compose up -d converter/g)).toHaveLength(2);
  expect(broken.calls()).not.toContain("compose run");
  expect(broken.tag()).toBe("old");
});
