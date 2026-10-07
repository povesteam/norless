import { expect, test } from "vitest";
import { manualOf } from "./manual";

test("the manual is the source repository's GitHub Pages site", () => {
  expect(manualOf("https://github.com/owner/norless")).toBe(
    "https://owner.github.io/norless/",
  );
  expect(manualOf("https://github.com/owner/norless/tree/abc123")).toBe(
    "https://owner.github.io/norless/",
  );
  expect(manualOf(null)).toBeNull();
  expect(manualOf("https://example.org/norless")).toBeNull();
});
