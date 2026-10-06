-- Recordings of rehearsals and services, cut into songs.
-- Rules live in code, not in the schema: allowed values and ranges are checked by the
-- routes and src/shared (the database spec).

-- A recording, kept as pieces while it runs.
CREATE TABLE recordings (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  room_id TEXT NOT NULL REFERENCES rooms (id),
  owner_id TEXT NOT NULL REFERENCES users (id),
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
CREATE INDEX recordings_community ON recordings (community_id, started_at);

-- A recording cut by song.
CREATE TABLE recording_parts (
  id TEXT PRIMARY KEY,
  recording_id TEXT NOT NULL REFERENCES recordings (id),
  position INTEGER NOT NULL,
  entry_id TEXT,
  song_id TEXT,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL,
  file TEXT NOT NULL
) STRICT;

-- When each song or slide went live during a recording.
CREATE TABLE recording_marks (
  recording_id TEXT NOT NULL REFERENCES recordings (id),
  at_ms INTEGER NOT NULL,
  entry_id TEXT,
  song_id TEXT,
  slide INTEGER NOT NULL DEFAULT 0
) STRICT;
CREATE INDEX recording_marks_recording ON recording_marks (recording_id, at_ms);

-- Who asked to listen, and the answer.
CREATE TABLE recording_access (
  recording_id TEXT NOT NULL REFERENCES recordings (id),
  user_id TEXT NOT NULL REFERENCES users (id),
  status TEXT NOT NULL,
  asked_at TEXT NOT NULL,
  answered_at TEXT,
  PRIMARY KEY (recording_id, user_id)
) STRICT;
