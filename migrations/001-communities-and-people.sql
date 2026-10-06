-- Communities, the people in them, and how they log in.
-- Rules live in code, not in the schema: allowed values and ranges are checked by the
-- routes and src/shared (the database spec).

-- A person, across communities; device_of marks a laptop's or guest's account.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  email TEXT UNIQUE,
  status TEXT NOT NULL,
  legacy_ids TEXT NOT NULL DEFAULT '[]',
  legacy_created_at TEXT,
  last_login_at TEXT,
  imported_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  preferences TEXT NOT NULL DEFAULT '{}',
  device_of TEXT REFERENCES users (id),
  device_kind TEXT,
  avatar TEXT REFERENCES images (id),
  avatar_source TEXT,
  google_picture TEXT,
  google_picture_at TEXT
) STRICT;
CREATE INDEX users_device_of ON users (device_of) WHERE device_of IS NOT NULL;

-- Pictures stored in the database: avatars.
CREATE TABLE images (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  data BLOB NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT REFERENCES users (id)
) STRICT;

-- The tenant: a church, with its languages, time zone, theme and settings.
CREATE TABLE communities (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  languages TEXT NOT NULL,
  time_zone TEXT NOT NULL,
  legacy_id TEXT,
  imported_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id),
  theme TEXT NOT NULL DEFAULT '{}',
  privacy TEXT NOT NULL DEFAULT '{}',
  bible_versions TEXT NOT NULL DEFAULT '{}',
  note_names TEXT NOT NULL DEFAULT 'letters',
  tempo_percent REAL NOT NULL DEFAULT 4,
  tempo_seconds INTEGER NOT NULL DEFAULT 8,
  youtube_channel TEXT,
  switches TEXT NOT NULL DEFAULT '{}',
  calendar_url TEXT,
  welcome TEXT
) STRICT;

-- A person in a community, with their roles.
CREATE TABLE members (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  user_id TEXT NOT NULL REFERENCES users (id),
  roles TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL,
  was_admin INTEGER NOT NULL DEFAULT 0,
  was_creator INTEGER NOT NULL DEFAULT 0,
  imported_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id),
  UNIQUE (community_id, user_id)
) STRICT;
CREATE INDEX members_user ON members (user_id);

-- Login sessions, by the hash of their cookie.
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
) STRICT;
CREATE INDEX sessions_user ON sessions (user_id);

-- Email login links and invitations, by the hash of their token.
CREATE TABLE login_links (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  next TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
) STRICT;
CREATE INDEX login_links_email ON login_links (email, created_at);

-- Links a community shows in its menu and on its screens.
CREATE TABLE pages (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  position REAL NOT NULL,
  imported_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id),
  show_qr INTEGER NOT NULL DEFAULT 0
) STRICT;
