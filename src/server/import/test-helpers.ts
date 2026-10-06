import type { Document } from "bson";
import { expect } from "vitest";
import type { Collections } from "./archive.js";
import type { Row } from "./mapping.js";
import { transform } from "./transform.js";

export const now = new Date("2026-10-01T12:00:00Z");

/** Synthetic old data: `{ "norless.songs": [...], "norless-ua.songs": [...] }`. */
export function archive(data: Record<string, Document[]> = {}): Collections {
  return new Map(
    Object.entries({
      "norless.congregations": [
        {
          _id: "unuunu",
          title: "Unu-Unu",
          creator: "u1",
          rights: { u2: { right: "admin" }, u3: { right: "view" } },
        },
      ],
      ...data,
    }),
  );
}
export const run = (data?: Record<string, Document[]>) =>
  transform(archive(data), { now });
export const one = <T>(list: T[]) => {
  expect(list).toHaveLength(1);
  return list[0] as T;
};
export const versionsOf = (rows: Row[], songId: unknown) =>
  Object.fromEntries(
    rows
      .filter((v) => v.song_id === songId)
      .map((v) => [v.language, { title: v.title, text: v.lyrics }]),
  );
