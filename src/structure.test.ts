import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

// Folders stay small: past 40 entries, one is nested by area. The
// interface's strings are a list, not code to find one's way in.
const MAX = 40;
const exempt = new Set(["src/client/locales"]);

const folders = (dir: string): string[] => [
  dir,
  ...readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => folders(join(dir, entry.name))),
];

it("no folder of code holds more than 40 entries", () => {
  const crowded = ["src", "e2e"]
    .flatMap(folders)
    .filter((dir) => !exempt.has(dir))
    .map((dir) => `${dir}: ${readdirSync(dir).length}`)
    .filter((line) => Number(line.split(": ")[1]) > MAX);
  expect(crowded).toEqual([]);
});

// macOS's bash 3.2, in a UTF-8 locale, reads "$work…" as a variable named "work" plus
// the first byte of "…", unbound: a name next to a non-ASCII character takes braces.
it("no shell script puts a variable's name right before a non-ASCII character", () => {
  const scripts = execFileSync("git", ["ls-files", "*.sh"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
  const touching = scripts.flatMap((file) =>
    readFileSync(file, "utf8")
      .split("\n")
      .map((line, i) => `${file}:${i + 1}: ${line.trim()}`)
      .filter((line) => /\$[A-Za-z_]\w*\P{ASCII}/u.test(line)),
  );
  expect(touching).toEqual([]);
});
