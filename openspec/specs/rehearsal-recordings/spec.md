# rehearsal-recordings Specification

## Purpose
Record rehearsals and services, tie the audio to what was live, and let the band listen back with the recorder's permission.

## Requirements

### Requirement: Record from a device

Members with the owner or team role, and guest musicians, SHALL be able to start and stop a recording from a device's microphone or a chosen audio input, in rehearsal or service mode, while its feature (`recordings`) is switched on. The input SHALL be asked for the first time on a device and remembered there; a small arrow beside Record SHALL open the choice again. The audio SHALL be uploaded to the server in short pieces while recording, so that losing the device loses at most the last few seconds; a recording that gets nothing for two minutes SHALL be finished as if stopped. The server SHALL keep it as a file for each entry that was live, cut at the moments the entries went live, in m4a (AAC), which plays on Mac, iPhone, Windows and Android.

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

### Requirement: Recording is visible on stage

While a recording is running in a room, every musicians, vocalists and stage monitor screen of that room SHALL show that recording is on, and, to members, who is recording.

#### Scenario: Singers know they're recorded
- **WHEN** the operator starts recording
- **THEN** the vocalists' phones and the stage monitor show a recording mark with the operator's name

### Requirement: Marked with what was live

Each recording SHALL list the songs and parts that were live while it ran, with their time in the recording, taken from the live log. Choosing a song or part SHALL play the recording from that point. A downloaded file SHALL be named by the recording's date and the song's title, e.g. "2026-10-02 Har minunat.m4a".

#### Scenario: Listen to the bridge again
- **WHEN** a musician opens Thursday's recording and taps the bridge of the third song
- **THEN** playback starts where the bridge went live

#### Scenario: Download a song
- **WHEN** a musician downloads "Har minunat" from the rehearsal of 2 October 2026
- **THEN** the file is called "2026-10-02 Har minunat.m4a"

### Requirement: Who can listen

A recording SHALL belong to the member who made it, who can always play it; one made from a laptop or a guest's phone belongs to the member who logged that device in. Other members with the owner or team role SHALL see that it exists, with who made it, when, its length and its songs, and SHALL be able to ask for access. The member who made it SHALL see the requests in the app, and SHALL be able to grant or refuse each, and to withdraw access later. Only members with access SHALL be able to play or download it.

#### Scenario: Ask for access
- **WHEN** the drummer asks for access to the guitarist's recording
- **THEN** the guitarist sees the request and can grant it
- **AND** after granting, the drummer can play the recording

#### Scenario: No access yet
- **WHEN** a member without access opens the recording
- **THEN** they see its songs and length, and a button to ask for access, but no playback

### Requirement: Keep and delete

Recordings SHALL be kept until they are deleted. The member who made a recording and the community's owners SHALL be able to delete it, which SHALL remove its audio from the server.

#### Scenario: Owner frees space
- **WHEN** an owner deletes a recording from last year
- **THEN** its audio is removed from the server, and it disappears from the list

### Requirement: Recordings on a song's page

A song's page SHALL show members with the owner or team role the song's last 5 recorded files, newest first, with the recording's date, who made it and its length, and a link to all recordings. Those with access SHALL be able to play and download them there; the others SHALL be able to ask for access there.

#### Scenario: How did we play it last time
- **WHEN** the guitarist opens "Har minunat" on Saturday
- **THEN** its page shows the file from Thursday's rehearsal, which the guitarist recorded, ready to play
