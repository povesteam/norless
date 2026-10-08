import type { Db } from "../db/db.js";

/** Letters and digits only, without case or diacritics: "Dați-mi" reads "datimi". */
export const reduced = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase();

/** The longest query the typo count takes: one bit per letter in 32-bit numbers. */
const LONGEST = 31;

/**
 * The fewest typos (a letter missing, extra or changed) with which `pattern` appears
 * anywhere in `text`: Myers' bit-parallel edit distance, one step per letter of text.
 */
export function typos(pattern: string, text: string): number {
  const letters = Array.from(pattern).slice(0, LONGEST);
  const m = letters.length;
  if (m === 0) return 0;
  const masks = new Map<string, number>();
  letters.forEach((c, i) => masks.set(c, (masks.get(c) ?? 0) | (1 << i)));
  const last = 1 << (m - 1);
  let plus = -1;
  let minus = 0;
  let score = m;
  let best = m;
  for (const c of text) {
    const eq = masks.get(c) ?? 0;
    const xv = eq | minus;
    const xh = (((eq & plus) + plus) ^ plus) | eq;
    let ph = minus | ~(xh | plus);
    let mh = plus & xh;
    if (ph & last) score++;
    else if (mh & last) score--;
    // The pattern may start anywhere in the text, so the top row stays at 0.
    ph <<= 1;
    mh <<= 1;
    plus = mh | ~(xv | ph);
    minus = ph & xv;
    if (score < best) best = score;
    if (best === 0) break;
  }
  return best;
}

/** The typos a query may have: one per five letters. */
export const typoBudget = (query: string) => Math.floor(query.length / 5);

type Reduced = { songId: string; title: string; lyrics: string };

/** Each database's versions reduced, by version id; `forget` drops changed ones. */
const cache = new WeakMap<Db, Map<string, Reduced>>();

/** Drops the reduced texts of these songs' versions, or all, after their text changed. */
export function forget(db: Db, songIds?: string[]) {
  const versions = cache.get(db);
  if (!versions) return;
  if (!songIds) return versions.clear();
  const changed = new Set(songIds);
  for (const [id, version] of versions)
    if (changed.has(version.songId)) versions.delete(id);
}

/**
 * Songs the index didn't find for `query`, by its words joined and its typos: titles
 * containing it, then titles within the typo budget, then lyrics likewise, fewer typos
 * first. Nothing for a query of fewer than 5 letters: the index finds words by their
 * start, and a few letters inside words match nearly anything.
 */
export function fuzzySongs(
  db: Db,
  communityId: string,
  query: string,
  /** Already found, so left out. */
  found: Set<string>,
  limit: number,
  /** Lyrics as the index has them: without chords, names or repeats. */
  lyricsOf: (text: string) => string,
): string[] {
  const q = reduced(query).slice(0, LONGEST);
  if (q.length < 5 || limit <= 0) return [];
  const budget = typoBudget(q);
  let versions = cache.get(db);
  if (!versions) cache.set(db, (versions = new Map()));
  const live = db
    .prepare(
      `SELECT v.id, v.song_id AS songId FROM song_versions v
       JOIN songs s ON s.id = v.song_id AND s.deleted_at IS NULL AND s.excluded_at IS NULL
       WHERE s.community_id = ? AND v.deleted_at IS NULL`,
    )
    .all(communityId) as { id: string; songId: string }[];
  const text = db.prepare(
    "SELECT title, lyrics FROM song_versions WHERE id = ?",
  );
  // Within the budget: 0 for containing it.
  const off = (haystack: string) =>
    budget === 0 ? (haystack.includes(q) ? 0 : Infinity) : typos(q, haystack);
  const best = new Map<string, number>();
  for (const { id, songId } of live) {
    if (found.has(songId)) continue;
    let version = versions.get(id);
    if (!version) {
      const row = text.get(id) as { title: string; lyrics: string };
      version = {
        songId,
        title: reduced(row.title),
        lyrics: reduced(lyricsOf(row.lyrics)),
      };
      versions.set(id, version);
    }
    const inTitle = off(version.title);
    // Titles first, then lyrics: a lyric match counts past any title's typos.
    const score =
      inTitle <= budget ? inTitle : LONGEST + 1 + off(version.lyrics);
    if (score > LONGEST + 1 + budget) continue;
    if (score < (best.get(songId) ?? Infinity)) best.set(songId, score);
  }
  return [...best]
    .sort((a, b) => a[1] - b[1])
    .slice(0, limit)
    .map(([id]) => id);
}
