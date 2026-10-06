# song-statistics Specification

## Purpose
Show how often and when songs were sung in services, so the team plans with the songs the church knows, notices the ones it forgot, and sees each song's history.

## Requirements

### Requirement: Most sung songs

Members SHALL be able to open a Statistics page from the community's menu listing the 25 songs sung in the most services in a period, each with how many services and when it was last sung, most first. The period SHALL be the last 12 months by default, or all time, or a year from the first year with plays to the current one; within a year, a season SHALL narrow it to winter (January, February and December), spring (March to May), summer (June to August) or autumn (September to November). Only service plays SHALL count. Deleted songs SHALL be left out.

#### Scenario: Christmas songs
- **WHEN** a member picks 2025 and winter
- **THEN** the list counts only services in January, February and December 2025, and the Christmas songs come first

#### Scenario: Rehearsals don't count
- **WHEN** a song was played in 4 rehearsals and 1 service in the last 12 months
- **THEN** it is listed with 1 service

### Requirement: Songs not sung lately

The Statistics page SHALL list up to 50 songs sung in at least 3 services in all but in none during the last 6 months, most sung first, each with how many services and when it was last sung. Excluded and deleted songs SHALL be left out.

#### Scenario: A forgotten favorite
- **WHEN** a song was sung in 20 services, the last one 8 months ago
- **THEN** it is listed among the songs not sung lately, with 20 services and "8 months ago"

### Requirement: A song's history

A song's page SHALL show members how many services it was sung in, the first and the last, and how many per year, newest year first. A song never sung in a service SHALL say so. Visitors SHALL NOT see it.

#### Scenario: History on the page
- **WHEN** a member opens a song sung in 3 services in 2025 and 2 in 2026
- **THEN** its page says it was sung in 5 services, with its first and last, and 2026: 2, 2025: 3

### Requirement: The year in songs

When a whole year is picked on the Statistics page, it SHALL show above the year's most sung songs how many services the year had (days with service plays), how many different songs were sung in them, and how many songs were sung in a service for the first time ever that year, listing up to 50 of these by their first date. Deleted songs SHALL count but not be listed.

#### Scenario: A year's new songs
- **WHEN** a member picks 2025, and "Har minunat" was first sung in a service on 9 March 2025
- **THEN** the recap counts 2025's services and songs, and lists "Har minunat" among the songs first sung that year, on 9 March

### Requirement: The last services as a grid

The Statistics page SHALL show the last 12 services (the latest days with service plays) as a table: a column per day, oldest to newest, a row per song sung in them, most sung in them first, and a mark in each cell where the song was sung that day.

#### Scenario: The pattern of a song
- **WHEN** a song was sung every other Sunday in the last 12 services
- **THEN** its row has a mark in every other column

### Requirement: Played a lot lately

The last services SHALL be the 4 latest days with service plays in the community, or as many as there are. A song played in at least 2 of them SHALL show "Played in N of the last M services" in the search box's results, and the Statistics page SHALL list these songs, most first, leaving out excluded and deleted songs (a song is rarely played twice in a month).

#### Scenario: Before adding it again
- **WHEN** a planner searches for a song played in 3 of the last 4 services
- **THEN** its result says "Played in 3 of the last 4 services"

#### Scenario: Once a month is fine
- **WHEN** a song was played in 1 of the last 4 services
- **THEN** its result shows no such hint, and it isn't in the list

### Requirement: Searches that found nothing

When the search box closes on a search of 3 characters or more that found no song and no Bible passage, the server SHALL keep its text and time, without who searched. Editors and owners SHALL see, on the Statistics page, the searches of the last 90 days that still find no song, the same search typed with other case, diacritics or spaces counted together, most often first, each with how many times and when last, and a New song link that opens the song editor with that title.

#### Scenario: A song people look for
- **WHEN** three members search for "Oceane" over a month and find nothing
- **THEN** an editor sees "Oceane, 3 times" under "Looked for, not found", and New song opens the editor titled "Oceane"

#### Scenario: Added since
- **WHEN** an editor adds the song "Oceane"
- **THEN** it leaves the list

#### Scenario: Typing isn't searching
- **WHEN** someone types "Oceane" letter by letter and picks a song
- **THEN** nothing is kept
