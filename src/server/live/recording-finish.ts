import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ConverterAway, cutRecording } from "../converter.js";
import type { Db } from "../db/db.js";
import { newId } from "../ids.js";

export const extensionOf = (mime: string) =>
  mime.includes("mp4") || mime.includes("aac")
    ? "m4a"
    : mime.includes("ogg")
      ? "ogg"
      : "webm";

/** The stretches of a recording, one per entry that was live, from its marks. */
export function stretches(
  marks: { at_ms: number; entry_id: string | null; song_id: string | null }[],
  durationMs: number,
) {
  const out: {
    entryId: string | null;
    songId: string | null;
    start: number;
    end: number;
  }[] = [];
  for (const mark of marks) {
    const last = out.at(-1);
    if (last && last.entryId === mark.entry_id) continue;
    if (last) last.end = mark.at_ms;
    out.push({
      entryId: mark.entry_id,
      songId: mark.song_id,
      start: last ? mark.at_ms : 0,
      end: durationMs,
    });
  }
  if (out.length === 0)
    out.push({ entryId: null, songId: null, start: 0, end: durationMs });
  // A stretch too short to hear (a click past an entry) joins the one before.
  return out.filter((s, i) => i === 0 || s.end - s.start >= 1000);
}

/** Recordings being cut now, so a retry doesn't start a second cut. */
const cutting = new Set<string>();

/** Finishes a recording: marked processing, then cut into a file per entry. */
export async function finish(
  db: Db,
  dir: string,
  id: string,
  now = new Date(),
) {
  const r = db
    .prepare(
      "SELECT last_piece_at, stopped_at, status FROM recordings WHERE id = ?",
    )
    .get(id) as
    | {
        last_piece_at: string | null;
        stopped_at: string | null;
        status: string;
      }
    | undefined;
  if (!r || r.status !== "recording") return;
  db.prepare(
    "UPDATE recordings SET status = 'processing', stopped_at = ?, updated_at = ? WHERE id = ?",
  ).run(
    r.stopped_at ?? r.last_piece_at ?? now.toISOString(),
    now.toISOString(),
    id,
  );
  await cut(db, dir, id);
}

/**
 * Cuts a processing recording into a file per entry, with an index, in m4a (AAC), by
 * the converter. While the converter is away it stays processing, and recordings.ts
 * tries again every 5 minutes; a file the converter can't read stays one file.
 */
export async function cut(db: Db, dir: string, id: string) {
  if (cutting.has(id)) return;
  cutting.add(id);
  try {
    await cutNow(db, dir, id);
  } finally {
    cutting.delete(id);
  }
}

async function cutNow(db: Db, dir: string, id: string) {
  const r = db
    .prepare(
      "SELECT started_at, stopped_at, mime, status FROM recordings WHERE id = ?",
    )
    .get(id) as
    | {
        started_at: string;
        stopped_at: string;
        mime: string;
        status: string;
      }
    | undefined;
  if (!r || r.status !== "processing") return;
  const folder = join(dir, id);
  const ext = extensionOf(r.mime);
  const raw = join(folder, `upload.${ext}`);
  const duration = Math.max(
    0,
    Date.parse(r.stopped_at) - Date.parse(r.started_at),
  );
  const marks = db
    .prepare(
      "SELECT at_ms, entry_id, song_id FROM recording_marks WHERE recording_id = ? ORDER BY at_ms, rowid",
    )
    .all(id) as {
    at_ms: number;
    entry_id: string | null;
    song_id: string | null;
  }[];
  const parts = existsSync(raw) ? stretches(marks, duration) : [];
  let pieces: Buffer[] | null = null;
  if (parts.length > 0)
    try {
      pieces = await cutRecording(
        raw,
        ext,
        parts.map((p, i) => ({
          start: p.start,
          end: i < parts.length - 1 ? p.end : null,
        })),
      );
    } catch (error) {
      if (!(error instanceof ConverterAway)) throw error;
      db.prepare("UPDATE recordings SET updated_at = ? WHERE id = ?").run(
        new Date().toISOString(),
        id,
      );
      return;
    }
  const cut = pieces?.length === parts.length && parts.length > 0;
  const files = parts.map((_, i) => `${String(i + 1).padStart(2, "0")}.m4a`);
  if (cut)
    pieces?.forEach((piece, i) =>
      writeFileSync(join(folder, files[i] ?? ""), piece),
    );
  const insert = db.prepare(
    "INSERT INTO recording_parts (id, recording_id, position, entry_id, song_id, start_ms, end_ms, file) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  db.transaction(() => {
    if (cut)
      parts.forEach((p, i) =>
        insert.run(
          newId(),
          id,
          i + 1,
          p.entryId,
          p.songId,
          p.start,
          p.end,
          files[i] ?? "",
        ),
      );
    else if (existsSync(raw)) {
      // ponytail: a file the converter can't read plays whole, from the start.
      const first = parts[0];
      insert.run(
        newId(),
        id,
        1,
        first?.entryId ?? null,
        first?.songId ?? null,
        0,
        duration,
        `upload.${ext}`,
      );
    }
    db.prepare(
      "UPDATE recordings SET status = ?, updated_at = ? WHERE id = ?",
    ).run(existsSync(raw) ? "ready" : "failed", new Date().toISOString(), id);
  })();
  if (cut) rmSync(raw, { force: true });
}
