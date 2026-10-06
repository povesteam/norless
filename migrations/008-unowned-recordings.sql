-- A recording whose maker deleted their account belongs to nobody: it stays for the
-- team without anything linking it to them (rehearsal-recordings spec). SQLite can't
-- drop NOT NULL, so the table is rebuilt.
CREATE TABLE recordings_new (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  room_id TEXT NOT NULL REFERENCES rooms (id),
  owner_id TEXT REFERENCES users (id),
  mode TEXT NOT NULL,
  mime TEXT NOT NULL,
  status TEXT NOT NULL,
  pieces INTEGER NOT NULL DEFAULT 0,
  bytes INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  last_piece_at TEXT,
  stopped_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id)
) STRICT;
INSERT INTO recordings_new SELECT * FROM recordings;
DROP TABLE recordings;
ALTER TABLE recordings_new RENAME TO recordings;
CREATE INDEX recordings_community ON recordings (community_id, started_at);
