-- The calendar, service roles and who serves when.
-- Rules live in code, not in the schema: allowed values and ranges are checked by the
-- routes and src/shared (the database spec).

-- Weekly services, single events and cancellations.
CREATE TABLE schedule_events (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  kind TEXT NOT NULL,
  weekday INTEGER,
  start_time TEXT,
  end_time TEXT,
  first_date TEXT,
  last_date TEXT,
  date TEXT,
  cancels_event_id TEXT REFERENCES schedule_events (id),
  imported_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id)
) STRICT;

-- A date of an event whose slots were built.
CREATE TABLE schedule_dates (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  event_id TEXT NOT NULL REFERENCES schedule_events (id),
  date TEXT NOT NULL,
  built_by TEXT REFERENCES users (id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (event_id, date)
) STRICT;

-- Roles in a service (vocals, keys, sound), edited by owners.
CREATE TABLE service_roles (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  name TEXT NOT NULL,
  instrument TEXT,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id),
  leads INTEGER NOT NULL DEFAULT 0
) STRICT;
CREATE INDEX service_roles_community ON service_roles (community_id);

-- Who can take a role.
CREATE TABLE role_people (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  role_id TEXT NOT NULL REFERENCES service_roles (id),
  user_id TEXT NOT NULL REFERENCES users (id),
  created_at TEXT NOT NULL,
  created_by TEXT REFERENCES users (id),
  UNIQUE (role_id, user_id)
) STRICT;

-- How many of each role an event needs.
CREATE TABLE slot_templates (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  event_id TEXT NOT NULL REFERENCES schedule_events (id),
  role_id TEXT NOT NULL REFERENCES service_roles (id),
  count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id),
  UNIQUE (event_id, role_id)
) STRICT;

-- A role on a date, asked of a person who accepts or declines.
CREATE TABLE slots (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  event_id TEXT NOT NULL REFERENCES schedule_events (id),
  date TEXT NOT NULL,
  role_id TEXT NOT NULL REFERENCES service_roles (id),
  user_id TEXT REFERENCES users (id),
  status TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id)
) STRICT;
CREATE INDEX slots_date ON slots (community_id, date);
CREATE INDEX slots_user ON slots (user_id);

-- Days a person can't serve.
CREATE TABLE away_dates (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  user_id TEXT NOT NULL REFERENCES users (id),
  first_date TEXT NOT NULL,
  last_date TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX away_dates_user ON away_dates (community_id, user_id);
