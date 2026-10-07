# follow-along Specification

## Purpose
Let anyone in the room follow the live songs on their own phone, in their language, without an account.

## Requirements

### Requirement: Follow-along page

Each room SHALL have a follow-along page that anyone can open without logging in. It SHALL show the live song in the vocalists Whole song layout: every part in order, scrolling by itself to keep the live part in view. It SHALL offer no controls, and following SHALL NOT record plays or appear in presence. Below the last part, it SHALL show the next song's title. It SHALL show while its feature (`followAlong`) is switched on. While the screens are blank or show a page, the follow-along page SHALL show only the song's title or nothing. A live Bible reference SHALL show the reference, and a live text slide SHALL be shown.

#### Scenario: Visitor follows the refrain
- **WHEN** a visitor opens the follow-along page during a song and the refrain goes live
- **THEN** the page scrolls to the refrain and marks it live

#### Scenario: No controls
- **WHEN** a visitor taps a part on the follow-along page
- **THEN** nothing goes live

### Requirement: Language and text size on the phone

The follow-along page SHALL open in the browser's language when the community has it, otherwise in the community's first language, with a switch for each of the community's languages and for both. With both, each line SHALL be followed by the same line in the other language, in a softer color. It SHALL offer larger and smaller text, and be dark by default with a switch to light. These choices SHALL be remembered on the phone.

#### Scenario: Ukrainian phone
- **WHEN** a visitor whose phone is set to Ukrainian opens the page
- **THEN** the songs are shown in Ukrainian, and the switch offers Romanian and both

### Requirement: Short link and QR code

Each room's follow-along page SHALL be reached at `norless.com/<community>` itself: for visitors, the community's address SHALL open follow-along while something is live, and otherwise the playlist the home opens (playlists spec). Owners SHALL be able to switch on, per start page, a QR code with the short link that Norless shows in a corner of the projected page. The QR code SHALL NOT be shown while songs are live.

#### Scenario: Before the service
- **WHEN** the start page with the QR code switched on is projected
- **THEN** the projector shows the page with a small QR code and the short link in a corner

### Requirement: Many phones at once

The follow-along page SHALL keep working with at least 500 phones following one room, and SHALL catch up with the live state within two seconds after a phone wakes up or reconnects.

#### Scenario: Phone wakes up
- **WHEN** a visitor's phone was locked for ten minutes and is unlocked
- **THEN** the page shows the current part within two seconds

### Requirement: Names only to members

The live state SHALL name who changed the slide only to members of the community. Pages open to visitors (follow-along, projector, stage monitor, musicians and vocalists views) SHALL get it without names.

#### Scenario: Visitor's projector page
- **WHEN** a visitor opens the projector page and a team member sends a part live
- **THEN** the page receives the part, and no member's name

### Requirement: Slides on phones

While a slides page is live, the follow-along page SHALL show it as a picture sized for a phone, in the phone's chosen language's file when there is one, which the phone's zoom enlarges.

#### Scenario: Reading the announcements
- **WHEN** a visitor follows along and the announcements' page 2 goes live
- **THEN** their phone shows page 2 across its width, and pinching zooms into it
