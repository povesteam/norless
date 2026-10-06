import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

/**
 * pull-backup.sh with a docker that runs the container's script here, on a folder of
 * its own in place of /data.
 */
function fakeServer() {
  const dir = mkdtempSync(join(tmpdir(), "norless-pull-backup-"));
  copyFileSync("deploy/pull-backup.sh", join(dir, "pull-backup.sh"));
  mkdirSync(join(dir, "data", "slides", "a"), { recursive: true });
  writeFileSync(join(dir, "data", "slides", "a", "1.png"), "page");
  writeFileSync(join(dir, "data", "slides", "a", "upload.pdf"), "half");
  const bin = join(dir, "bin");
  mkdirSync(bin);
  // docker compose exec -T -e FOLDER=<folder> norless sh -c <script>
  writeFileSync(
    join(bin, "docker"),
    `#!/usr/bin/env bash
script="\${@: -1}"
FOLDER=\${5#FOLDER=} sh -c "\${script//\\/data/${dir}/data}"
`,
  );
  chmodSync(join(bin, "docker"), 0o755);
  return (folder: string, have: string) =>
    spawnSync("bash", [join(dir, "pull-backup.sh")], {
      env: { PATH: `${bin}:${process.env.PATH}`, SSH_ORIGINAL_COMMAND: folder },
      input: have,
    });
}

test("a folder's pull sends the finished files the Mac doesn't have, and nothing once it has them", () => {
  const pull = fakeServer();
  const first = pull("slides", "");
  expect(first.status).toBe(0);
  const list = spawnSync("tar", ["-t"], {
    input: first.stdout,
    encoding: "utf8",
  });
  expect(list.stdout.trim().split("\n")).toEqual(["./a/1.png"]);

  const again = pull("slides", "./a/1.png\n");
  expect(again.status).toBe(0);
  expect(again.stdout.length).toBe(0);
  expect(again.stderr.toString()).toBe("");
});
