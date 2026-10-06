import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

test("the Mac pulls the database once a day, and new recordings and slides every hour", () => {
  const dir = mkdtempSync(join(tmpdir(), "norless-pull-"));
  const bin = join(dir, "bin");
  mkdirSync(bin);
  mkdirSync(join(dir, "server"));
  writeFileSync(join(dir, "server", "new.webm"), "sound");
  // An ssh that logs what it's asked: the database without a command, a recording, and
  // no new slides (nothing at all).
  writeFileSync(
    join(bin, "ssh"),
    `#!/usr/bin/env bash
echo "\${@: -1}" >> "${dir}/calls"
case "\${@: -1}" in
  recordings) cat > /dev/null; tar -c -C "${dir}/server" -f - new.webm ;;
  slides) cat > /dev/null ;;
  *) printf "SQLite format 3" ;;
esac
`,
  );
  chmodSync(join(bin, "ssh"), 0o755);
  const copies = join(dir, "copies");
  const run = () =>
    spawnSync("bash", ["deploy/mac-pull.sh", copies], {
      env: { PATH: `${bin}:${process.env.PATH}`, HOME: dir },
      encoding: "utf8",
    });

  const first = run();
  expect(first.stdout).toContain("pulled");
  expect(first.stderr).not.toContain("empty archive");
  expect(run().stdout).not.toContain("pulled");

  const calls = readFileSync(join(dir, "calls"), "utf8").trim().split("\n");
  expect(calls.filter((c) => c === "deploy@norless.com")).toHaveLength(1);
  expect(calls.filter((c) => c === "recordings")).toHaveLength(2);
  expect(readdirSync(join(copies, "norless-backup"))).toEqual([
    `${new Date().toLocaleDateString("sv")}-norless.db`,
  ]);
  expect(existsSync(join(copies, "norless-recordings", "new.webm"))).toBe(true);
  expect(readdirSync(join(copies, "norless-slides"))).toEqual([]);
});
