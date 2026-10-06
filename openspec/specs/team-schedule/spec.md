# team-schedule Specification

## Purpose
Let the team plan who does what in each service and rehearsal, and let each member answer for their own place, see what's theirs and be told in time.

## Requirements

### Requirement: Service roles

A community SHALL have service roles, who does what in a service, apart from the permission roles: a starter list in the community's first language (worship lead, vocals, guitar, keys, bass, drums, host, preacher, sound, slides, kids' teacher) that owners rename, add to, remove and order. A role MAY be for an instrument of the musician profile: the members who play it SHALL count as marked for the role. A role MAY lead the songs: the starter worship lead does, and owners mark others. The team SHALL mark other members for a role. The server SHALL refuse changes to the roles from anyone but owners, and markings from anyone but the team.

#### Scenario: The starter list
- **WHEN** an owner of a Romanian community opens the roles for the first time
- **THEN** they read Lider de laudă, Voce, Chitară, Clape, Bas, Tobe, Prezentator, Predicator, Sunet, Slide-uri and Învățător la copii, and Lider de laudă leads the songs

#### Scenario: A guitarist is marked by their profile
- **WHEN** a member's musician profile says they play guitar
- **THEN** they're marked for the guitar role without the team doing anything

### Requirement: Slots per date, from a template

Each service and rehearsal of the schedule SHALL have slots, a role each, for the next 8 weeks. Each weekly event SHALL have a template, the slots each of its dates starts with (so many of each role), which the team sets. A date SHALL show its template's slots until the team changes it: then it SHALL keep its own slots, which the team fills, empties, adds to and removes (removing from the slot's row menu, ⋯, after a confirmation), and later changes to the template SHALL not reach it. The team member who first changes a date SHALL be its builder. A one-off event SHALL start without slots.

#### Scenario: A Sunday from its template
- **WHEN** the team sets Sunday's template to two vocalists and a guitarist
- **THEN** every coming Sunday shows two open vocal slots and an open guitar slot

#### Scenario: One Sunday changed
- **WHEN** the team adds a bass slot to next Sunday only
- **THEN** next Sunday has it, and the others keep the template's

### Requirement: Assigned, accepted or declined

The team SHALL put a member in a slot, which asks them: the slot SHALL wait for their answer until they accept or decline. A decline MAY say why; it SHALL open the slot again, tell the date's builder who declined and why, and tell the people marked for the role that it's open. A team member who puts themselves in a slot SHALL have accepted it. The server SHALL refuse an answer from anyone but the person in the slot.

#### Scenario: Declining with a reason
- **WHEN** Eva, asked to sing on Sunday, declines saying she's away
- **THEN** the slot is open again, Ion who built Sunday reads that Eva can't and why, and the other vocalists are told the slot is open

### Requirement: Sign-ups

A member SHALL be able to take an open slot: at once when marked for its role, else as an offer the team confirms or turns down. The date's builder SHALL be told of each sign-up and offer, and the person of the team's answer.

#### Scenario: A guitarist takes an open slot
- **WHEN** a member marked for guitar takes Sunday's open guitar slot
- **THEN** the slot is theirs, accepted, and the date's builder is told

#### Scenario: An offer
- **WHEN** a member not marked for keys offers to play keys on Sunday
- **THEN** the slot shows the offer, and they're in only once a team member confirms

### Requirement: Away dates and two roles

Members SHALL mark the days they're away; the team SHALL see "away" beside them when filling a slot of those days, and MAY still ask them. A member in two slots of one date SHALL be allowed, shown with a note.

#### Scenario: Asking someone who's away
- **WHEN** the team puts Eva in a slot on a day she marked away
- **THEN** the slot shows that she's away, and she's asked anyway

### Requirement: Who sees the schedule

Every member SHALL see the whole team schedule; visitors SHALL see nothing of it, and the server SHALL refuse it to them.

#### Scenario: A visitor
- **WHEN** someone who isn't a member asks for the team schedule
- **THEN** the server refuses it

### Requirement: One's own schedule

A member SHALL see their own: a My schedule page (their slots with Accept and Decline, open slots for their roles within a week, their away days, what they were told), a line at the top of the community's pages with their next slot within a week and how much is new, and on the musicians and vocalists views a badge with their roles that day. There SHALL be no calendar feed.

#### Scenario: The line at the top
- **WHEN** a member is asked to sing on Sunday
- **THEN** every page of the community shows "You're on Voce: Serviciu, Sunday at 10:00" with Accept, until Sunday

### Requirement: Told in the app and by push

A member SHALL be told in the app and, on the devices where they turned notifications on, by push (web-push): when they're put in a slot or taken out of one, 3 hours before each of their slots, when a slot of a role they're marked for is open within a week (once per role and date, and again after a decline), and when the team confirms or turns down their offer; a date's builder SHALL be told of its declines, sign-ups and offers. Each SHALL go once. Without push (an iPhone without Norless installed, notifications refused, or a server without its keys), they SHALL be told in the app, and My schedule SHALL explain how to install Norless to get them. Norless SHALL keep how each notification went by push (sent to how many devices, failed or stopped on how many, or why to none), show it under the notification in My schedule, and log each failed push on the server, so a phone that wasn't told can be looked into.

#### Scenario: A reminder
- **WHEN** it's 3 hours before the Sunday service a member accepted a slot in
- **THEN** they're told once, in the app and on their phone

#### Scenario: An iPhone
- **WHEN** a member opens My schedule in Safari on an iPhone, without Norless installed
- **THEN** it explains how to add Norless to the home screen to get notifications

#### Scenario: Why a phone wasn't told
- **WHEN** a member assigned to a slot has no device that allowed notifications
- **THEN** My schedule shows the notification with "Only here: none of your devices allowed notifications"

### Requirement: Team features arrive off

The team schedule's features SHALL arrive off until an owner switches them on: the service roles, which bring the team schedule, My schedule, sign-ups, away dates and who leads each song; and notifications by push.

#### Scenario: Switching the team features on
- **WHEN** an owner switches on the service roles
- **THEN** the team schedule shows, and members see their own schedule, can sign up for open places and mark the dates they're away

### Requirement: Who leads each song

A playlist SHALL know the service it plans: the next service's playlist that Norless makes, its service; a playlist made by hand, the next service that no playlist plans yet. Each song of a playlist SHALL be led by the person in that service's slot of a role that leads the songs, assigned or accepted, unless the team chose another person of that service's leading or vocal slots for that song, from the entry's actions ("Led by…"). Members SHALL see who leads each song on its playlist row, and who leads the live song on the musicians and vocalists views; visitors and screens SHALL see no names. A play SHALL keep who led the song, for statistics. It SHALL come with the service roles.

#### Scenario: The lead leads
- **WHEN** Ana is in Sunday's worship lead slot, and the team builds Sunday's playlist
- **THEN** each of its songs shows "Led by Ana"

#### Scenario: A vocalist takes a song
- **WHEN** the team chooses Vlad, in a vocal slot on Sunday, for one song
- **THEN** that song shows "Led by Vlad" on its row and on the musicians view while it's live, and its play keeps Vlad

### Requirement: The church's calendar

An owner SHALL be able to set the community's calendar by its iCal address (https:// or webcal://, such as Google Calendar's secret address) in Settings › Schedule, and SHALL see how many events it read and when, or that it couldn't be read. Only owners SHALL ever see the address. Members SHALL see the calendar's events of the next 8 weeks, at most 30, by day, with their times on the 24-hour clock or "All day", their titles and places, on My schedule and on the team schedule (only a list, members only); repeating events SHALL be expanded, with their moved dates moved and their cancelled ones left out. Norless SHALL read the address again at most once an hour; when it can't, members SHALL be told, and SHALL see what it read before. The calendar SHALL NOT change the schedule, the live mode or the slots. It SHALL be the feature `churchCalendar`, off until switched on.

#### Scenario: Youth night
- **WHEN** the church's Google Calendar has a youth night every Friday, moved one week to 20:00 and cancelled the next
- **THEN** members read Friday 19:00, then Friday 20:00, and nothing the week it's cancelled

#### Scenario: The secret address
- **WHEN** an owner sets the calendar's secret address
- **THEN** members see its events but never the address

### Requirement: Playlist ready, and songs changed after

The team SHALL be able to tell the people in a playlist's service slots, assigned or accepted, that the playlist is ready, from the playlist's actions, again when they like. Each SHALL be told in the app and by push, with the playlist's title and how many songs it has, and a tap SHALL open the playlist. After that, until the service, each change to one of the playlist's songs (its text, chords or key, a key for the service, or a song added) SHALL be told once to the people in slots of roles for an instrument or that lead the songs. Nobody SHALL be told of changes before the team said the playlist is ready. It SHALL be the feature `playlistNews`, off until switched on.

#### Scenario: Ready on Friday
- **WHEN** on Friday the team tells Sunday's people the playlist is ready
- **THEN** each of them reads "11 octombrie 2026 is ready: 6 songs" on My schedule and on their phone

#### Scenario: A key changed on Saturday
- **WHEN** on Saturday the team sets another key for one of its songs
- **THEN** Sunday's guitarist and singers are told once that the song changed, and the sound man isn't
