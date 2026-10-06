## MODIFIED Requirements

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
