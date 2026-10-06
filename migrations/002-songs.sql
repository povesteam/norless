-- Songs, their texts and history, and what's said and measured about them.
-- Rules live in code, not in the schema: allowed values and ranges are checked by the
-- routes and src/shared (the database spec).

-- A song: its music and settings, shared by its languages.
CREATE TABLE songs (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  key_signature TEXT NOT NULL DEFAULT '',
  time_signature TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  legacy_id TEXT,
  imported_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id),
  bpm INTEGER,
  excluded_reason TEXT,
  excluded_at TEXT,
  excluded_by TEXT REFERENCES users (id),
  authors TEXT NOT NULL DEFAULT '',
  copyright TEXT NOT NULL DEFAULT '',
  source_url TEXT,
  reference_links TEXT NOT NULL DEFAULT '[]',
  music TEXT
) STRICT;

-- A song's title and lyrics in one language.
CREATE TABLE song_versions (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  song_id TEXT NOT NULL REFERENCES songs (id),
  language TEXT NOT NULL,
  title TEXT NOT NULL,
  lyrics TEXT NOT NULL,
  imported_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id),
  UNIQUE (song_id, language)
) STRICT;
CREATE INDEX song_versions_song ON song_versions (song_id);

-- A song as it was after each save, for History.
CREATE TABLE song_revisions (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  song_id TEXT NOT NULL REFERENCES songs (id),
  key_signature TEXT NOT NULL,
  time_signature TEXT NOT NULL,
  tags TEXT NOT NULL,
  versions TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT REFERENCES users (id),
  bpm INTEGER,
  authors TEXT NOT NULL DEFAULT '',
  copyright TEXT NOT NULL DEFAULT '',
  source_url TEXT,
  reference_links TEXT,
  music TEXT
) STRICT;
CREATE INDEX song_revisions_song ON song_revisions (song_id, created_at);

-- The search index over titles and lyrics, kept up to date by the server's code
-- (indexSongs in src/server/songs/search.ts), which every write of a song's text calls.
CREATE VIRTUAL TABLE songs_fts USING fts5 ( version_id UNINDEXED, title, lyrics, tokenize = 'unicode61 remove_diacritics 2' );

-- Likes and dislikes, with a reason for a dislike.
CREATE TABLE song_opinions (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  song_id TEXT NOT NULL REFERENCES songs (id),
  user_id TEXT NOT NULL REFERENCES users (id),
  opinion TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (song_id, user_id)
) STRICT;
CREATE INDEX song_opinions_user ON song_opinions (user_id, opinion);

-- Tempos measured while a song is played.
CREATE TABLE tempo_checks (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  song_id TEXT NOT NULL REFERENCES songs (id),
  bpm INTEGER NOT NULL,
  measured_at TEXT NOT NULL,
  created_by TEXT REFERENCES users (id)
) STRICT;
CREATE INDEX tempo_checks_song ON tempo_checks (song_id, measured_at);

-- Searches that found nothing, for the editors.
CREATE TABLE search_misses (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  query TEXT NOT NULL,
  folded TEXT NOT NULL,
  at TEXT NOT NULL
) STRICT;
CREATE INDEX search_misses_community ON search_misses (community_id, at);
