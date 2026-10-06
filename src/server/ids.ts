import { createHash, randomBytes } from "node:crypto";

// Records' ids: 12 letters and digits (about 71 bits), so URLs stay short, e.g.
// /unu-unu/playlists/4fTq9ZkLr2Wx. Like the old app's ids, shorter.
const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const LENGTH = 12;
// 248 = 4 × 62: higher bytes would make the first characters more likely.
const FAIR = 248;

/** The id's characters from bytes, skipping the unfair ones; null if too few. */
function idOf(bytes: Uint8Array): string | null {
  let id = "";
  for (const byte of bytes) {
    if (byte >= FAIR) continue;
    id += ALPHABET[byte % ALPHABET.length];
    if (id.length === LENGTH) return id;
  }
  return null;
}

/** A new record's id. */
export function newId(): string {
  for (;;) {
    const id = idOf(randomBytes(LENGTH * 2));
    if (id) return id;
  }
}

/** The same id every time for the same parts, e.g. for an imported record. */
export function idFrom(...parts: string[]): string {
  for (let round = 0; ; round++) {
    const id = idOf(
      createHash("sha256")
        .update([round, ...parts].join(":"))
        .digest(),
    );
    if (id) return id;
  }
}
