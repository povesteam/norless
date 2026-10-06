import type { Db } from "../db/db.js";
import type { Rows } from "./mapping.js";
import { indexSongs } from "../songs/search.js";

/**
 * Upserts all rows in one transaction. A row changed in the app since its last
 * import (updated_at no longer equals imported_at) is left alone and counted.
 * Returns the number of such protected rows per table.
 */
export function write(db: Db, rows: Rows): Record<string, number> {
  const kept: Record<string, number> = {};
  db.transaction(() => {
    for (const [table, list] of Object.entries(rows)) {
      const first = list[0];
      if (!first) continue;
      const columns = Object.keys(first);
      const updates = columns
        .filter((c) => c !== "id" && c !== "created_at")
        .map((c) => `${c} = excluded.${c}`);
      const values = `(${columns.join(", ")}) VALUES (${columns.map((c) => `@${c}`).join(", ")})`;
      // Logs (song revisions, slides) are never changed in the app: kept once.
      const upsert = db.prepare(
        columns.includes("updated_at")
          ? `INSERT INTO ${table} ${values}
             ON CONFLICT (id) DO UPDATE SET ${updates.join(", ")}
             WHERE ${table}.updated_at = ${table}.imported_at`
          : `INSERT OR IGNORE INTO ${table} ${values}`,
      );
      for (const row of list) {
        if (upsert.run(row).changes === 0 && columns.includes("updated_at"))
          kept[table] = (kept[table] ?? 0) + 1;
      }
    }
    // Songs an earlier import made that this one doesn't (a UA song now joined
    // to its RO song, a song deleted in the old app) are deleted, unless
    // changed in the app since.
    const at = new Date().toISOString();
    for (const table of ["songs", "song_versions"] as const) {
      const ids = new Set(rows[table].map((row) => row.id));
      const remove = db.prepare(
        `UPDATE ${table} SET deleted_at = @at, updated_at = @at, imported_at = @at WHERE id = @id`,
      );
      const imported = db
        .prepare(
          `SELECT id FROM ${table} WHERE imported_at IS NOT NULL AND updated_at = imported_at AND deleted_at IS NULL`,
        )
        .pluck()
        .all() as string[];
      for (const id of imported) if (!ids.has(id)) remove.run({ at, id });
    }
  })();
  indexSongs(db);
  return kept;
}
