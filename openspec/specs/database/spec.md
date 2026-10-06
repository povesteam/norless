# database Specification

## Purpose
Where the data's rules live, and how migrations change the schema: the schema keeps types, keys and references, the server's code keeps the rules, and a migration can rebuild any table safely.

## Requirements

### Requirement: Rules live in code

The database schema SHALL hold the data's types, NOT NULL, primary keys, UNIQUE constraints and foreign keys, and no CHECK constraints: allowed values, ranges, patterns and rules across fields SHALL be enforced by the server's code. The schema SHALL have no triggers either: the full-text search index SHALL be kept up to date by the server's code that writes song texts, so a song can be edited with plain sqlite3.

#### Scenario: A new entry kind
- **WHEN** a change adds a new kind of playlist entry
- **THEN** the server's code accepts the new kind, and no table has to be rebuilt for it

#### Scenario: A wrong value from a client
- **WHEN** a client sends a screen of a type that doesn't exist
- **THEN** the server refuses it with an error, before anything is written

### Requirement: Migrations

The server SHALL apply new migrations in order when it starts, each once and in its own transaction. A migration SHALL be able to rebuild any table, including tables other tables refer to. A migration that fails, or that leaves a reference to a missing record, SHALL leave the database as it was, and foreign keys SHALL be enforced again afterwards.

#### Scenario: Rebuilding the songs table
- **WHEN** a migration recreates the songs table, which song versions refer to, and copies its rows
- **THEN** the migration succeeds and every song version still belongs to its song

#### Scenario: A broken migration
- **WHEN** a migration deletes records that others still refer to
- **THEN** the migration is undone and the server reports which migration broke the references

### Requirement: Times in UTC

Every moment Norless stores or sends (when something was created, changed, played, recorded or sent, a service's start) SHALL be in UTC, as an ISO 8601 string ending in `Z`, and SHALL be shown in local time only on the screen. Only two things SHALL be local, with the community's time zone: a schedule's time of day ("10:00 every Sunday"), so a change of the clocks doesn't move a service, and a calendar date (the Sunday a slot or a playlist is for).

#### Scenario: Created in the evening in Cluj
- **WHEN** a member creates a playlist at 21:30 in Cluj on a summer evening
- **THEN** it is stored and sent as created at 18:30 UTC (`…T18:30:00.000Z`), and shown as 21:30

#### Scenario: After the clocks change
- **WHEN** the clocks go back in October
- **THEN** the Sunday service still starts at 10:00 local time
