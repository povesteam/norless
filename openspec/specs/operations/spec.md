# operations Specification

## Purpose
How Norless runs on its server beside the app itself: the services that keep the app and its data safe from the files people and the internet send. Deploys, backups and alerts are in the `add-deployment` change until it's archived.

## Requirements

### Requirement: Files read apart from the data

Files that come from people or from the internet (recordings, pictures, and the PDFs of slides from files) SHALL be read and converted only by the converter service, which SHALL have no access to the database, the stored files or the internet, SHALL keep nothing after a job, and SHALL run within its own memory and CPU limits, so the app keeps a CPU and its memory during a service. The app's image SHALL hold none of the converting tools.

While the converter is unreachable, its jobs SHALL wait and be tried again, and the app team SHALL get an alert after 5 minutes, and another when it's back. The converter's health SHALL NOT be part of the app's health check. A deploy SHALL start the converter with the new version and wait for its health before starting the app's candidate, and SHALL stop with the old converter back if it isn't healthy.

#### Scenario: A booby-trapped file
- **WHEN** a member uploads a file crafted to exploit a converting tool
- **THEN** the damage stays inside the converter, which can't reach the database, other files or the internet

#### Scenario: Converter down after a rehearsal
- **WHEN** a rehearsal's recording ends while the converter is down
- **THEN** the recording is kept whole, its cut into songs happens once the converter is back, and the app team was alerted after 5 minutes

#### Scenario: A converter that doesn't start
- **WHEN** a deploy's new converter doesn't pass its health check
- **THEN** the old converter and the old app go on serving, and the deploy fails

### Requirement: A small app image

The app's image SHALL hold only what running Norless needs: Node on Alpine, the server's dependencies and the built app, with a shell for the backup pull (`deploy/pull-backup.sh` runs `sh`, `find`, `sort`, `comm` and `tar` inside it). npm, corepack and yarn SHALL NOT be in it, nor native modules' sources or builds for other platforms. The converter's image SHALL be on Alpine too, with ffmpeg, poppler and fonts only: no office suite, since presentations are added as PDFs exported from them.

#### Scenario: Smaller and still whole
- **WHEN** the app's image is built
- **THEN** it passes its health check, runs a backup with `node dist/server/cli/backup.js`, serves a backup pull and a pull of slides through `pull-backup.sh`, and has no `npm` command
