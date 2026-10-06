-- Playlists, rooms, what goes live, and what was played.
-- Rules live in code, not in the schema: allowed values and ranges are checked by the
-- routes and src/shared (the database spec).

-- Where a service or a practice runs: one live state each.
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  name TEXT NOT NULL,
  imported_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id),
  live TEXT,
  temporary INTEGER NOT NULL DEFAULT 0,
  started_by TEXT REFERENCES users (id),
  mode TEXT,
  playlist_id TEXT REFERENCES playlists (id)
) STRICT;

-- A service's or a rehearsal's list.
CREATE TABLE playlists (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  title TEXT,
  legacy_id TEXT,
  imported_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id),
  archived_at TEXT,
  service_event_id TEXT REFERENCES schedule_events (id),
  service_date TEXT,
  ready_at TEXT
) STRICT;

-- A playlist's rows: songs, passages, text slides, dividers and slides from files.
CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  playlist_id TEXT NOT NULL REFERENCES playlists (id),
  position REAL NOT NULL,
  kind TEXT NOT NULL,
  song_id TEXT REFERENCES songs (id),
  bible_book INTEGER,
  bible_chapter INTEGER,
  bible_verse_from INTEGER,
  bible_verse_to INTEGER,
  text TEXT,
  legacy_id TEXT,
  imported_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id),
  planned_minutes INTEGER,
  key_signature TEXT,
  host_words TEXT,
  led_by TEXT REFERENCES users (id),
  slide_seconds INTEGER
) STRICT;
CREATE INDEX entries_playlist ON entries (playlist_id, position);

-- The files a slides entry shows, a file per language.
CREATE TABLE slide_files (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  entry_id TEXT NOT NULL REFERENCES entries (id),
  language TEXT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  originals TEXT NOT NULL,
  pages INTEGER NOT NULL DEFAULT 0,
  total INTEGER,
  state TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id)
) STRICT;
CREATE INDEX slide_files_entry ON slide_files (entry_id);

-- Each entry that went live, for chapters and statistics.
CREATE TABLE live_log (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  playlist_id TEXT NOT NULL REFERENCES playlists (id),
  entry_id TEXT NOT NULL REFERENCES entries (id),
  mode TEXT NOT NULL,
  at TEXT NOT NULL,
  created_by TEXT REFERENCES users (id)
) STRICT;
CREATE INDEX live_log_community ON live_log (community_id, at);
CREATE INDEX live_log_playlist ON live_log (playlist_id, mode, at);

-- Each slide that went live, for statistics and recordings.
CREATE TABLE slide_log (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  room_id TEXT REFERENCES rooms (id),
  playlist_id TEXT REFERENCES playlists (id),
  entry_id TEXT REFERENCES entries (id),
  song_id TEXT REFERENCES songs (id),
  slide INTEGER NOT NULL,
  blank INTEGER NOT NULL,
  mode TEXT NOT NULL,
  at TEXT NOT NULL,
  created_by TEXT REFERENCES users (id),
  imported_at TEXT
) STRICT;
CREATE INDEX slide_log_community ON slide_log (community_id, at);
CREATE INDEX slide_log_song ON slide_log (song_id, at);

-- A song played in a service or rehearsal.
CREATE TABLE plays (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  song_id TEXT NOT NULL REFERENCES songs (id),
  room_id TEXT REFERENCES rooms (id),
  playlist_id TEXT REFERENCES playlists (id),
  mode TEXT NOT NULL,
  played_at TEXT NOT NULL,
  imported INTEGER NOT NULL DEFAULT 0,
  legacy_id TEXT,
  imported_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT REFERENCES users (id),
  ended_at TEXT,
  led_by TEXT REFERENCES users (id)
) STRICT;
CREATE INDEX plays_mode ON plays (community_id, mode, played_at);
CREATE INDEX plays_song ON plays (song_id, played_at);

-- The community's live streams, found on YouTube.
CREATE TABLE streams (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  video_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id),
  UNIQUE (community_id, video_id)
) STRICT;
CREATE INDEX streams_community ON streams (community_id, started_at);
