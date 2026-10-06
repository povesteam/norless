-- Projectors, stage screens and the devices showing them.
-- Rules live in code, not in the schema: allowed values and ranges are checked by the
-- routes and src/shared (the database spec).

-- A screen of a room: projector, stage monitor, broadcast and the like.
CREATE TABLE screens (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  room_id TEXT NOT NULL REFERENCES rooms (id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  languages TEXT NOT NULL,
  layout TEXT,
  settings TEXT NOT NULL DEFAULT '{}',
  secret TEXT NOT NULL UNIQUE,
  position REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id)
) STRICT;
CREATE INDEX screens_community ON screens (community_id);

-- Devices paired to a screen.
CREATE TABLE screen_devices (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  screen_id TEXT NOT NULL REFERENCES screens (id),
  token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id)
) STRICT;
CREATE INDEX screen_devices_screen ON screen_devices (screen_id);
CREATE UNIQUE INDEX screen_devices_token ON screen_devices (token) WHERE deleted_at IS NULL;

-- When a screen connected and left, for its status.
CREATE TABLE screen_connections (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  screen_id TEXT NOT NULL REFERENCES screens (id),
  connected_at TEXT NOT NULL,
  disconnected_at TEXT
) STRICT;
CREATE INDEX screen_connections_screen ON screen_connections (screen_id, connected_at);

-- Short codes typed to pair a screen or log a device in.
CREATE TABLE short_codes (
  code TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (kind, target_id)
) STRICT;
