## MODIFIED Requirements

### Requirement: Record from a device

Members with the owner or team role, and guest musicians, SHALL be able to start and stop a recording from a device's microphone or a chosen audio input, in rehearsal or service mode, while its feature (`recordings`) is switched on. The first time on a device, before anything else, Record SHALL say that everyone in the room is recorded and to tell them first, and record only once that's acknowledged; the device SHALL remember it. The input SHALL be asked for the first time on a device and remembered there; a small arrow beside Record SHALL open the choice again. The audio SHALL be uploaded to the server in short pieces while recording, so that losing the device loses at most the last few seconds; a recording that gets nothing for two minutes SHALL be finished as if stopped. The server SHALL keep it as a file for each entry that was live, cut at the moments the entries went live, in m4a (AAC), which plays on Mac, iPhone, Windows and Android.

#### Scenario: Thursday rehearsal
- **WHEN** a musician starts recording on the laptop at the start of the rehearsal and stops it two hours later
- **THEN** the server has the whole two-hour recording

#### Scenario: Battery dies
- **WHEN** the recording phone switches off after 40 minutes
- **THEN** the server keeps the first 40 minutes, less a few seconds at most

#### Scenario: A file per song
- **WHEN** a rehearsal recording ran through three songs with a prayer between the second and the third
- **THEN** it has a file for each song and one for the prayer, each starting when that entry went live

#### Scenario: Opens on a Mac
- **WHEN** a musician downloads a song's file and opens it in Finder
- **THEN** it plays in QuickTime

#### Scenario: The first recording on a laptop
- **WHEN** an operator presses Record for the first time on the church laptop
- **THEN** Norless says everyone in the room is recorded, to tell them first, and records only after Continue; the next time, Record starts at once
