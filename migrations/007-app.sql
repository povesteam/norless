-- What the app keeps about itself: changes, usage, ideas and notifications.
-- Rules live in code, not in the schema: allowed values and ranges are checked by the
-- routes and src/shared (the database spec).

-- The change log: every change, who made it, before and after.
CREATE TABLE changes (
  id TEXT PRIMARY KEY,
  community_id TEXT REFERENCES communities (id),
  at TEXT NOT NULL,
  user_id TEXT REFERENCES users (id),
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  action TEXT NOT NULL,
  row TEXT NOT NULL,
  changed TEXT
) STRICT;
CREATE INDEX changes_community ON changes (community_id, at);
CREATE INDEX changes_row ON changes (table_name, row_id, at);

-- Which features are used, without the person once their account is deleted.
CREATE TABLE usage_events (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  community_id TEXT REFERENCES communities (id),
  user_id TEXT REFERENCES users (id),
  device_type TEXT NOT NULL,
  layout TEXT,
  feature TEXT NOT NULL,
  detail TEXT
) STRICT;
CREATE INDEX usage_events_community ON usage_events (community_id, at);
CREATE INDEX usage_events_feature ON usage_events (feature, at);

-- Ideas and feedback for the community's owners or the app team.
CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  text TEXT NOT NULL,
  page TEXT NOT NULL,
  device_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  deleted_at TEXT,
  created_by TEXT NOT NULL REFERENCES users (id),
  updated_by TEXT REFERENCES users (id),
  sent_to TEXT NOT NULL DEFAULT 'owners'
) STRICT;
CREATE INDEX feedback_community ON feedback (community_id, created_at);

-- Members asking for a feature to be switched on.
CREATE TABLE feature_requests (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  user_id TEXT NOT NULL REFERENCES users (id),
  feature TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (community_id, user_id, feature)
) STRICT;
CREATE INDEX feature_requests_user ON feature_requests (user_id);

-- Notices in the app, also pushed to phones.
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  community_id TEXT NOT NULL REFERENCES communities (id),
  user_id TEXT NOT NULL REFERENCES users (id),
  kind TEXT NOT NULL,
  about TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT,
  push TEXT
) STRICT;
CREATE INDEX notifications_about ON notifications (user_id, kind, about);
CREATE INDEX notifications_user ON notifications (user_id, created_at);

-- Where to push a person's notices.
CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;
