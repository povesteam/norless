import { migrate, openDatabase } from "../db/db.js";
import { parseArgs } from "node:util";
import { readArchive } from "./archive.js";
import { transform } from "./transform.js";
import { write } from "./write.js";
import { convertSongs } from "../songs/songs.js";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { oplog: { type: "string" } },
});
const [archive] = positionals;
if (!archive) {
  console.error(
    "Usage: npm run import -- <backup.mongodump.archive.gzip> [--oplog <oplog.mongodump.archive.gzip>]",
  );
  process.exit(1);
}
// The oplog's history: songs' earlier texts, every slide, exact times.
const oplog = values.oplog
  ? readArchive(values.oplog).get("local.oplog.rs")
  : undefined;

const db = openDatabase();
migrate(db);
const { rows, report } = transform(readArchive(archive), {
  now: new Date(),
  oplog,
});
const kept = write(db, rows);
// The chords to the track.
const converted = convertSongs(db);
db.close();

console.log(`Songs with their chords taken to the track: ${converted}`);
console.log("Imported rows:");
for (const [name, count] of Object.entries(report.counts))
  console.log(`  ${name.padEnd(20)} ${count}`);
console.log("Notes (skipped, merged or needing review):");
for (const [name, count] of Object.entries(report.notes)) {
  const samples = report.samples[name]?.length
    ? `  e.g. ${report.samples[name]?.join(", ")}`
    : "";
  console.log(`  ${name.padEnd(32)} ${String(count).padStart(6)}${samples}`);
}
if (Object.keys(kept).length > 0) {
  console.log("Changed in the app since the last import, left as they are:");
  for (const [table, count] of Object.entries(kept))
    console.log(`  ${table.padEnd(20)} ${count}`);
}
