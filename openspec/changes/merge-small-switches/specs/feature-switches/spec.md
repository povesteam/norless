## MODIFIED Requirements

### Requirement: Switches per feature

An owner SHALL be able to switch each feature beyond Classic's set on or off for the whole community ("for releasing features to the team, instead of drowning them with dozens of features from the first day"). A feature SHALL be on when switched on, and off otherwise (switches only, no steps). A switch SHALL cover a feature as the team meets it, with its smaller parts, which have no switch of their own: the Statistics page with the rotation hint, the year in songs, the services grid and the searches with no results; the Chords mode with the song history, notation and reference recordings; the service roles with My schedule, sign-ups, away dates and who leads each song; the app menu with the list of keyboard shortcuts; Who's here with the notice of who changed the slide. A feature SHALL need the feature its only way in sits in (practice rooms need the laptop layouts, which need the app menu), and SHALL be off while that one is off, keeping its own setting for when it's on again. Switching a feature on whose path is off SHALL list the features on its path and switch them on together. There SHALL be no button that resets the switches. The server SHALL refuse a change of the switches from anyone who isn't an owner, and SHALL ignore unknown features.

#### Scenario: One feature on its own
- **WHEN** only the app frame and the laptop layouts are on and an owner switches practice rooms on
- **THEN** the team sees practice rooms from the live bar, and nothing else switched off

#### Scenario: A path switched on at once
- **WHEN** only Classic's set is on and an owner switches practice rooms on
- **THEN** the switch says it also switches on the app menu and the laptop layouts, and all three come on

#### Scenario: Taken away again
- **WHEN** an owner switches the chord colors off
- **THEN** no member sees chord colors, while the stage views stay

#### Scenario: Parts come with their feature
- **WHEN** an owner switches the statistics on
- **THEN** members see the Statistics page with the year in songs and the services grid, and the graph has no switch for either
