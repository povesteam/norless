## Purpose

Keep the app running and its data safe: checked backups that leave the server, deploys that roll back on failure and stay out of services, and alerts when something needs a person.

## ADDED Requirements

### Requirement: Checked backups

The server SHALL back up its database while running, with SQLite's online backup API, and SHALL check each copy with `PRAGMA integrity_check` before keeping it. It SHALL keep a latest copy, renewed every hour, and a dated copy every night, kept for 14 days. A copy that fails the check SHALL NOT replace a good one.

#### Scenario: Hourly copy
- **WHEN** an hour has passed since the last backup
- **THEN** the latest copy is replaced by a new, checked one

#### Scenario: Old nightly copies
- **WHEN** a nightly copy is older than 14 days
- **THEN** it is deleted

### Requirement: Backups leave the server

The latest backup SHALL leave the server over SSH, pulled by the maintainer's Mac with a key that can only fetch it: that key's one command sends the latest checked copy and records the time of the pull. The app SHALL NOT offer the backup over HTTP.

#### Scenario: the maintainer's Mac pulls the backup
- **WHEN** the Mac's hourly job connects with its key
- **THEN** it gets the latest checked copy, and the server notes the time

#### Scenario: The key does nothing else
- **WHEN** someone with the Mac's key tries to run another command
- **THEN** they still only get the backup

### Requirement: Health check

`/api/health` SHALL answer ok only when the database answers, so a deploy and the uptime check notice a broken app.

#### Scenario: Database gone
- **WHEN** the database can't be read
- **THEN** the health check fails

### Requirement: Safe deploys

A deploy SHALL start only when a maintainer starts it, choosing what to deploy, after trying it on a copy of the newest pulled backup on the Mac: it SHALL start there, migrate the copy, load its home page and leave a database that passes the integrity check. The VM SHALL run production only, so it fits a 4 GB server. Every deploy SHALL back up the database first and start the new image beside the running one, which keeps serving; only once the new one passes its health check and a maintainer confirms SHALL traffic switch to it, and a new image that fails its check SHALL be stopped while the old one goes on serving. The deploy key SHALL only be able to run the deploy.

#### Scenario: A broken release
- **WHEN** a new image doesn't pass the health check within a minute
- **THEN** the old one never stopped serving, the new one is stopped, and the deploy fails

#### Scenario: A merge on Sunday morning
- **WHEN** a pull request is merged during a service
- **THEN** nothing is deployed until a maintainer starts a deploy

### Requirement: Alerts

The server SHALL email the Norless app team (`APP_TEAM_EMAILS`) when no good hourly backup was made for 3 hours, when no backup has been pulled for 48 hours, when its disk is over 80% full, and when more than 20 server errors happen within 10 minutes. An external uptime check SHALL email them when the health check fails for 2 minutes.

#### Scenario: Sleeping Mac
- **WHEN** The maintainer's Mac hasn't pulled a backup for 48 hours
- **THEN** the app team gets an email
