# service-schedule Specification

## Purpose
Know when the community's services and rehearsals happen, so the live mode, and therefore play statistics, are right without asking the operator each time.

## Requirements

### Requirement: Recurring events

An owner SHALL be able to define recurring weekly events, each with a name, weekday, start time, end time, type (service or rehearsal), and an optional first and last date. Past periods with different times SHALL be definable as separate recurring events with their own dates. Times SHALL be in the community's time zone.

#### Scenario: Sunday service
- **WHEN** the owner adds "Serviciu duminică" on Sunday from 10:00 to 12:30, type service
- **THEN** every Sunday from 10:00 to 12:30 is a service

#### Scenario: Service times changed in 2020
- **WHEN** the owner adds Sunday 9:30–12:00 until 31 December 2019 and Sunday 10:00–12:30 from 1 January 2020
- **THEN** a play on a Sunday at 9:45 in 2018 falls in a service, and one at 9:45 in 2024 doesn't

### Requirement: One-off events

An owner SHALL be able to add one-off events with a name, date, start time, end time and type. A one-off event SHALL take precedence over a recurring event at the same time. An owner SHALL be able to cancel a single occurrence of a recurring event.

#### Scenario: Christmas evening
- **WHEN** the owner adds "Seară de Crăciun" on 24 December from 18:00 to 20:00, type service
- **THEN** songs played that evening are service plays

#### Scenario: Service cancelled for a conference
- **WHEN** the owner cancels one Sunday's service and adds a conference that weekend as a service
- **THEN** that Sunday follows the conference times only

### Requirement: Mode from the schedule

When an entry goes live, the room's mode SHALL be set from the event in progress, counting from its start time to 30 minutes after its end time. When no event is in progress, the mode SHALL be rehearsal, without asking. The mode SHALL NOT be changed by hand; an unplanned service gets a one-off event.

#### Scenario: Rehearsal right before the service
- **WHEN** the band plays a song at 9:40 before a 10:00 service
- **THEN** the mode is rehearsal

#### Scenario: Service runs late
- **WHEN** a service scheduled until 12:30 sings a last song at 12:50
- **THEN** the mode is service

#### Scenario: Unscheduled evening
- **WHEN** a song goes live on a Wednesday evening with no event scheduled
- **THEN** the mode is rehearsal, and nobody is asked

### Requirement: The next service's playlist

When a scheduled service ends (counting the 30 minutes after its end time), the system SHALL create an empty, untitled playlist for the community's next scheduled service, which that service's date names (playlists spec), unless a playlist was already created since the service ended. Rehearsals SHALL NOT get one: a rehearsal practices the songs of the next service, so it uses the next service's playlist, which the home and a new practice room open.

#### Scenario: Sunday afternoon
- **WHEN** Sunday's service ends at 12:00, and the next one is the following Sunday
- **THEN** at 12:30 a playlist "11 octombrie" exists, empty, and the home opens it

#### Scenario: Someone was quicker
- **WHEN** an operator created next Sunday's playlist at 12:10
- **THEN** no second playlist is made

#### Scenario: Thursday's rehearsal
- **WHEN** the band opens Norless at Thursday's rehearsal
- **THEN** it opens next Sunday's playlist, and a practice room started then takes it too

### Requirement: Classifying imported plays

Imported plays SHALL start as "unclassified", and SHALL be left out of statistics until they are classified. After defining the schedule, including past periods, an owner SHALL run the classification. Each unclassified play SHALL then get the type of the event it falls in (from its start to 30 minutes after its end), or rehearsal when it falls in no event. No play SHALL be deleted. The owner SHALL be able to run the classification again after correcting the schedule. Only imported plays SHALL be reclassified.

#### Scenario: Old opens after setting the schedule
- **WHEN** the owner sets the Sunday service periods and runs the classification
- **THEN** imported plays from Sunday services become service plays
- **AND** imported plays from Thursday evening rehearsals become rehearsal plays, still stored but not counted as played

#### Scenario: Schedule corrected
- **WHEN** the owner notices the 2016 service started at 9:00, fixes that period and runs the classification again
- **THEN** the imported plays from 2016 are classified again with the corrected times
