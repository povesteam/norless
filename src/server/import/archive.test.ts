import { Long, serialize, type Document } from "bson";
import { describe, expect, test } from "vitest";
import { parseArchive } from "./archive.js";

const terminator = () => {
  const b = Buffer.alloc(4);
  b.writeInt32LE(-1);
  return b;
};

/** Builds an archive the way mongodump does, with the given blocks interleaved. */
function buildArchive(blocks: { ns: string; docs: Document[] }[]): Buffer {
  const magic = Buffer.alloc(4);
  magic.writeUInt32LE(0x8199e26d);
  const header = (ns: string, EOF: boolean) => {
    const [db, collection] = ns.split(".");
    return serialize({ db, collection, EOF, CRC: Long.fromNumber(0) });
  };
  const namespaces = [...new Set(blocks.map((b) => b.ns))];
  return Buffer.concat([
    magic,
    serialize({
      concurrent_collections: 4,
      version: "0.1",
      server_version: "3.2.8",
      tool_version: "r3.2.8",
    }),
    ...namespaces.map((ns) =>
      serialize({
        db: ns.split(".")[0],
        collection: ns.split(".")[1],
        metadata: "{}",
        size: 0,
      }),
    ),
    terminator(),
    ...blocks.flatMap((b) => [
      header(b.ns, false),
      ...b.docs.map((d) => serialize(d)),
      terminator(),
    ]),
    ...namespaces.flatMap((ns) => [header(ns, true), terminator()]),
  ]);
}

describe("parseArchive", () => {
  test("collects documents per collection across interleaved blocks", () => {
    const archive = buildArchive([
      { ns: "norless.songs", docs: [{ _id: "a", title: "A" }] },
      { ns: "norless-ua.songs", docs: [{ _id: "a", title: "A / А" }] },
      {
        ns: "norless.songs",
        docs: [
          { _id: "b", title: "B" },
          { _id: "c", title: "C" },
        ],
      },
    ]);

    const collections = parseArchive(archive);

    expect(collections.get("norless.songs")?.map((d) => d._id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(collections.get("norless-ua.songs")?.map((d) => d.title)).toEqual([
      "A / А",
    ]);
  });

  test("keeps numbers and dates as JavaScript values", () => {
    const at = new Date("2026-09-27T07:30:00Z");
    const archive = buildArchive([
      { ns: "norless.opens", docs: [{ time: 1790411208042, when: at }] },
    ]);

    expect(parseArchive(archive).get("norless.opens")?.[0]).toEqual({
      time: 1790411208042,
      when: at,
    });
  });

  test("rejects files that aren't mongodump archives", () => {
    expect(() => parseArchive(Buffer.from("PK\u0003\u0004zip"))).toThrow(
      /magic number/,
    );
  });

  test("rejects truncated archives", () => {
    const archive = buildArchive([
      { ns: "norless.songs", docs: [{ _id: "a" }] },
    ]);

    expect(() =>
      parseArchive(archive.subarray(0, archive.length - 30)),
    ).toThrow(/unexpectedly|Bad document size/);
  });
});
