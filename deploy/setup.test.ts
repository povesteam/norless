import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

const setup = (state: string, ...args: string[]) =>
  spawnSync("bash", ["deploy/setup.sh", ...args], {
    env: { PATH: process.env.PATH, HOME: tmpdir(), NORLESS_SETUP_STATE: state },
    encoding: "utf8",
  });

test("the setup script remembers the steps done, and asks one again with redo", () => {
  const state = join(mkdtempSync(join(tmpdir(), "setup-")), "state");
  writeFileSync(
    state,
    "done.tools=2026-10-05\ndone.repo=2026-10-05\nip=1.2.3.4\n",
  );

  // Every step listed has its function, in order; the done ones are marked.
  const status = setup(state, "status");
  expect(status.status).toBe(0);
  const lines = status.stdout.trimEnd().split("\n");
  expect(lines).toHaveLength(21);
  expect(lines[0]).toMatch(/^ {2}✓ tools/);
  expect(lines[1]).toMatch(/^ {2}✓ repo/);
  expect(lines[2]).toMatch(/^ {2}· server/);
  expect(lines.at(-1)).toMatch(/· spf/);

  // redo forgets one step, and keeps the rest of the state.
  expect(setup(state, "redo", "repo").status).toBe(0);
  expect(setup(state, "status").stdout).toMatch(/· repo/);
  expect(readFileSync(state, "utf8")).toContain("ip=1.2.3.4");

  expect(setup(state, "redo", "nothing").status).toBe(2);
  expect(setup(state, "now").status).toBe(2);
});

test("the deploy key step passes when the key answers with deploy.sh's usage", () => {
  const state = join(mkdtempSync(join(tmpdir(), "setup-")), "state");
  writeFileSync(state, "repo=owner/norless\nip=1.2.3.4\n");
  // The VM and GitHub stubbed; ssh answers as the forced command does, exit code included.
  const deployKey = (answer: string) =>
    spawnSync(
      "bash",
      [
        "-c",
        `source deploy/setup.sh
        add_key() { :; }; gh() { :; }; ssh-keyscan() { :; }
        ssh() { echo "${answer}" >&2; return 2; }
        step_deploy_key`,
      ],
      {
        env: {
          PATH: process.env.PATH,
          HOME: tmpdir(),
          NORLESS_SETUP_STATE: state,
        },
        encoding: "utf8",
      },
    );

  expect(deployKey("usage: production <tag> [switch|stop]").status).toBe(0);
  expect(deployKey("Permission denied (publickey).").status).toBe(1);
});
