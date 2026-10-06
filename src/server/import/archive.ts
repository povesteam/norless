import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { deserialize, type Document } from "bson";

const MAGIC = 0x8199e26d;
const TERMINATOR = -1;

/** Old documents keyed by "db.collection", e.g. "norless-ua.songs". */
export type Collections = Map<string, Document[]>;

/** Reads a `mongodump --archive --gzip` file. */
export function readArchive(path: string): Collections {
  return parseArchive(gunzipSync(readFileSync(path)));
}

/**
 * Archive layout: magic number, header document, collection metadata documents,
 * terminator, then blocks of (namespace header, documents, terminator). Blocks of
 * different collections interleave; a header with EOF: true closes a collection.
 */
export function parseArchive(buf: Buffer): Collections {
  if (buf.length < 4 || buf.readUInt32LE(0) !== MAGIC) {
    throw new Error("Not a mongodump archive (bad magic number)");
  }
  let pos = 4;
  const next = (): Document | null => {
    if (pos + 4 > buf.length)
      throw new Error(`Archive ends unexpectedly at byte ${pos}`);
    const size = buf.readInt32LE(pos);
    if (size === TERMINATOR) {
      pos += 4;
      return null;
    }
    if (size < 5 || pos + size > buf.length)
      throw new Error(`Bad document size ${size} at byte ${pos}`);
    const doc = deserialize(buf.subarray(pos, pos + size), {
      promoteLongs: true,
    });
    pos += size;
    return doc;
  };

  const header = next();
  if (header?.version !== "0.1")
    throw new Error(`Unsupported archive version: ${header?.version}`);
  while (next() !== null); // collection metadata (indexes, options): not needed

  const collections: Collections = new Map();
  while (pos < buf.length) {
    const block = next();
    if (block === null || block.EOF) continue;
    const ns = `${block.db}.${block.collection}`;
    const docs = collections.get(ns) ?? [];
    collections.set(ns, docs);
    for (let doc = next(); doc !== null; doc = next()) docs.push(doc);
  }
  return collections;
}
