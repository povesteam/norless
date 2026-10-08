-- Where a person is logged in (auth spec, Sessions): each session's browser, as its
-- User-Agent said, and when it was last used, so My account can list them.
ALTER TABLE sessions ADD COLUMN user_agent TEXT;
ALTER TABLE sessions ADD COLUMN seen_at TEXT;
