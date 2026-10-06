import { expect, test } from "vitest";
import en from "./en.json";
import ro from "./ro.json";
import uk from "./uk.json";

type Tree = { [key: string]: string | Tree };

/** Every key path with the {{placeholders}} its text uses. */
function keys(tree: Tree, prefix = ""): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(tree).flatMap(([key, value]) =>
      typeof value === "string"
        ? [
            [
              prefix + key,
              [...value.matchAll(/{{\s*(\w+)\s*}}/g)]
                .map((m) => m[1] ?? "")
                .sort(),
            ],
          ]
        : Object.entries(keys(value, `${prefix}${key}.`)),
    ),
  );
}

test.each([
  ["ro", ro],
  ["uk", uk],
])("%s has every English text, with the same placeholders", (_, locale) => {
  expect(keys(locale)).toEqual(keys(en));
});
