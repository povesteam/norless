import type { Db } from "../db/db.js";

export type RecordingPart = {
  id: string;
  songId: string | null;
  /** What was live: a song's titles, else the entry's kind (prayer, Bible…). */
  kind: string | null;
  titles: Record<string, string> | null;
  startMs: number;
  endMs: number;
  /** Where each part of the song went live, from the start of this file. */
  marks: { atMs: number; slide: number }[];
  /** The file's format, for its name when downloaded: m4a, or as recorded when uncut. */
  ext: string;
};

export type Recording = {
  id: string;
  /** Who it belongs to, by name, and the device that recorded when it isn't them. */
  by: string | null;
  device: string | null;
  mode: "service" | "rehearsal";
  status: "recording" | "processing" | "ready" | "failed";
  startedAt: string;
  durationMs: number | null;
  parts: RecordingPart[];
  /** The viewer's access: theirs, granted, asked, refused or none. */
  access: "own" | "granted" | "asked" | "refused" | null;
  /** For its owner: who asked, and their answers. */
  requests?: { userId: string; name: string; status: string }[];
};

/** The member a recording from this user belongs to: a device's own member. */
export const ownerOf = (db: Db, userId: string) =>
  (db
    .prepare("SELECT device_of FROM users WHERE id = ?")
    .pluck()
    .get(userId) as string | null) ?? userId;

/** A recording as one viewer sees it. */
export function recordingFor(
  db: Db,
  row: {
    id: string;
    owner_id: string;
    created_by: string | null;
    mode: "service" | "rehearsal";
    status: Recording["status"];
    started_at: string;
    stopped_at: string | null;
    last_piece_at: string | null;
  },
  viewer: string,
): Recording {
  const name = (id: string | null) =>
    id
      ? ((db
          .prepare("SELECT nullif(display_name, '') FROM users WHERE id = ?")
          .pluck()
          .get(id) as string | null) ?? null)
      : null;
  const own = row.owner_id === viewer;
  const access = own
    ? "own"
    : ((db
        .prepare(
          "SELECT status FROM recording_access WHERE recording_id = ? AND user_id = ?",
        )
        .pluck()
        .get(row.id, viewer) as Recording["access"] | undefined) ?? null);
  const marks = db
    .prepare(
      "SELECT at_ms, entry_id, slide FROM recording_marks WHERE recording_id = ? ORDER BY at_ms, rowid",
    )
    .all(row.id) as { at_ms: number; entry_id: string | null; slide: number }[];
  const parts = (
    db
      .prepare(
        `SELECT p.id, p.entry_id, p.song_id, p.start_ms, p.end_ms, p.file, e.kind, e.text
         FROM recording_parts p LEFT JOIN entries e ON e.id = p.entry_id
         WHERE p.recording_id = ? ORDER BY p.position`,
      )
      .all(row.id) as {
      id: string;
      entry_id: string | null;
      song_id: string | null;
      start_ms: number;
      end_ms: number;
      file: string;
      kind: string | null;
      text: string | null;
    }[]
  ).map((p): RecordingPart => ({
    id: p.id,
    songId: p.song_id,
    kind: p.kind,
    titles: p.song_id
      ? Object.fromEntries(
          (
            db
              .prepare(
                "SELECT language, title FROM song_versions WHERE song_id = ? AND deleted_at IS NULL",
              )
              .all(p.song_id) as { language: string; title: string }[]
          ).map((v) => [v.language, v.title]),
        )
      : p.text
        ? { "": p.text.split("\n")[0] ?? "" }
        : null,
    startMs: p.start_ms,
    endMs: p.end_ms,
    marks: marks
      .filter(
        (m) =>
          m.entry_id === p.entry_id &&
          m.at_ms >= p.start_ms &&
          m.at_ms < p.end_ms,
      )
      .map((m) => ({ atMs: m.at_ms - p.start_ms, slide: m.slide })),
    ext: p.file.split(".").pop() ?? "m4a",
  }));
  const end = row.stopped_at ?? row.last_piece_at;
  return {
    id: row.id,
    by: name(row.owner_id),
    device:
      row.created_by && row.created_by !== row.owner_id
        ? name(row.created_by)
        : null,
    mode: row.mode,
    status: row.status,
    startedAt: row.started_at,
    durationMs: end ? Date.parse(end) - Date.parse(row.started_at) : null,
    parts,
    access,
    ...(own
      ? {
          requests: db
            .prepare(
              `SELECT a.user_id AS userId, coalesce(nullif(u.display_name, ''), '?') AS name, a.status
               FROM recording_access a JOIN users u ON u.id = a.user_id
               WHERE a.recording_id = ? ORDER BY a.asked_at`,
            )
            .all(row.id) as NonNullable<Recording["requests"]>,
        }
      : {}),
  };
}

/** One of a song's recorded files, with the recording it's from. */
export type SongRecording = {
  recording: Omit<Recording, "parts">;
  part: RecordingPart;
};
