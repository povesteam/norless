# feature-switches Specification

## Purpose
Let a community switch on the new interface a few features at a time, as its owner chooses, starting from Classic, which works like the old Norless, so that nobody meets every new feature on the same Sunday.

## Requirements

### Requirement: Layouts by feature

A view SHALL offer only the layouts whose feature is on (the laptop layouts with Laptop layouts, the tablet and phone controller layouts with Tablet and phone layouts, the instrument layouts with Instrument layouts, the side-by-side editor with Side by side), and the switches SHALL set the default layout per device type: Controller on laptops while the laptop layouts are on, the tablet and phone layouts on those devices while those are on, Classic otherwise. While the app frame is on, Classic SHALL stay among the layouts offered on every device type. When a person's chosen layout isn't offered, the default SHALL be shown, and their choice SHALL be kept for when it is offered again.

#### Scenario: Back to Classic
- **WHEN** the laptop layouts are on and an operator picks Classic on their laptop
- **THEN** their laptop shows Classic from then on

#### Scenario: Choice kept while hidden
- **WHEN** a musician chose the phone controller layout, and an owner switches the tablet and phone layouts off
- **THEN** their phone shows Classic, and shows the phone layout again once those are switched back on

### Requirement: What's new

When more features are on than a person has seen, because an owner switched features on, each person SHALL see a round bubble floating over the community's pages, with how many things are new (the banner filled half a phone's screen). It SHALL start at the window's left side, over the playlist's times rather than the rows' actions. The bubble SHALL be movable: dragged, it SHALL snap to the nearer side of the window, and each device SHALL keep its place. A tap SHALL open a dialog that can be closed, listing each new feature by its name, which links to it in the feature graph, and what it does (per feature; the name is the link). Opening the dialog SHALL count as seen, and the bubble SHALL go. A member SHALL see it once per account; a visitor once per device. Features switched off SHALL show no notice, and a feature seen before SHALL not be announced again when it comes back on. Screen devices SHALL show no notice.

#### Scenario: One feature switched on
- **WHEN** an owner switches the Host view on
- **THEN** members see the bubble with 1, and its dialog says "New in Norless: Host view" with what it does and links to it in the graph

#### Scenario: First visit after moving forward
- **WHEN** an owner switched on the app frame and the laptop layouts, and an operator opens a playlist
- **THEN** the operator sees the bubble with 2, opens the dialog listing both, and after that doesn't see the bubble again on any device

#### Scenario: Projector stays clean
- **WHEN** an owner switches a feature on while a projector screen is open
- **THEN** the projector shows no notice

#### Scenario: Out of the way
- **WHEN** a guitarist drags the bubble to the right side of a phone's screen and lets it go
- **THEN** it snaps to the right edge, and is there on that phone after a reload

### Requirement: Features added later arrive off

A feature added to Norless later SHALL arrive switched off in every community, marked "New, not switched on yet" in the feature graph, until an owner switches it on or off.

#### Scenario: A new feature ships
- **WHEN** a later version adds chord detection
- **THEN** nobody sees chord detection until an owner switches it on, and the graph marks it new

### Requirement: Feature tree

Every member SHALL find a Features page in the community's menu, whatever is switched on, showing every feature as a node in a graph of what each needs: each feature that others need SHALL root a tree drawn left to right, with a line from each feature to the ones that need it, and the features that need nothing and that nothing needs SHALL sit beside the trees. No two lines SHALL cross or overlap, and no line SHALL pass behind a node. Each node SHALL be a round icon, the one the feature has in the app, with its name beside it, in its branch's color (Screens, Live, Stage, Chords, Songs, Statistics, App, Team, explained above the graph): filled and glowing while on, a ring while off, dim with a lock while it needs a feature that's off, with a spark while new, and faint and dashed with an hourglass while planned; the state SHALL also be part of the node's accessible name, and a legend above the graph SHALL say what the lock, the hourglass and the spark mean. The features on their own SHALL have a heading. A line SHALL be lit in its branch's color while the feature it leads to is on. On a laptop the graph SHALL fit the window's width; on a phone it SHALL keep its size and scroll both ways, and zoom, and say so above it. Tapping a node SHALL open what the feature does; owners SHALL switch a feature on or off there. The graph SHALL work alike in light and dark mode.

#### Scenario: A locked feature
- **WHEN** only Classic's set is on and a member opens the Features page
- **THEN** practice rooms show dim with a lock, after the laptop layouts in the App menu's tree

#### Scenario: Owner switches from the tree
- **WHEN** an owner opens the chord colors in the graph and switches them on
- **THEN** the node is filled, and the line from the stage views lights up

#### Scenario: On a laptop
- **WHEN** an owner opens the Features page on a laptop window of 1440 by 900 pixels
- **THEN** every feature shows without scrolling sideways, and no two lines cross

### Requirement: Planned features

The feature graph SHALL show features planned but not built, faint and dashed with an hourglass, marked "Planned" in their accessible name, in their branch, with the line to the feature they'll need. Planned features SHALL not be switchable.

#### Scenario: What's coming
- **WHEN** a member opens the Features page
- **THEN** the chord helper shows as planned

### Requirement: Feature requests

A member SHALL be able to ask the owners for a feature that's off or planned, from its tile, with an optional note of up to 500 characters, and withdraw the request; asking again SHALL change the note. Every member SHALL see on each tile how many members asked for it. Owners SHALL see who asked, with their notes, on the tile and in an "Asked-for features" section on the Ideas page, most asked first, with a link to the tree. Requests SHALL count only members still in the community, and SHALL go with a deleted account. The server SHALL refuse requests from visitors and devices, and for Classic's or unknown features.

#### Scenario: Asking for a planned feature
- **WHEN** a guitarist asks for chords from a piano, with the note "For the new piano"
- **THEN** its tile shows "1 asked" to every member, and the owners read the guitarist's name and note on the Ideas page

#### Scenario: Withdrawn
- **WHEN** the guitarist withdraws the request
- **THEN** the tile no longer counts it

### Requirement: Classic's set

Classic's features SHALL always be on and SHALL NOT be switchable: the Classic interface (its layout, menu and editor, `classic-layout` spec), one playlist driving every language's projector, opened full screen on the projector, the projector look from the display settings, start and end pages; printing, saving and copying a playlist; ideas and feedback to the owners; logging a laptop in from a phone. Every other feature SHALL be off until an owner switches it on, so the imported community SHALL start like the old Norless. Whatever is switched, these SHALL be shown: light and dark mode following the system, logging in and the account menu, the interface language (while it can be chosen), the privacy notice, About with the link to the source code, the connection status, a song's page opened by its link, who is editing which section of a song, the community settings, the members included, for owners, and the pages of screen devices.

#### Scenario: The imported community
- **WHEN** the community is imported and a team member opens a playlist on a laptop
- **THEN** the Classic interface shows, with no layout picker, screen previews, part buttons, entry times or end estimate

#### Scenario: Settings ready before their features
- **WHEN** an owner opens the settings with only Classic's set on
- **THEN** every setting is there, including the service schedule, screens and theme, so they can be prepared before their features are switched on

### Requirement: Switches change only the interface

The feature switches SHALL change only what the interface offers. The server SHALL keep accepting every action the "Who can do what" matrix allows, whatever is switched on. Background work SHALL run whatever is switched on: plays SHALL be recorded with the mode from the service schedule, and screens SHALL follow the live state.

#### Scenario: Plays with Classic's set
- **WHEN** only Classic's set is on and a song is live during a scheduled service
- **THEN** the play is recorded as a service play

#### Scenario: Data from a feature switched off
- **WHEN** an owner switched text slides off and a playlist has a text slide
- **THEN** the text slide stays in the playlist, is shown as an entry, and can still go live

### Requirement: Switches per feature

An owner SHALL be able to switch each feature beyond Classic's set on or off for the whole community ("for releasing features to the team, instead of drowning them with dozens of features from the first day"). A feature SHALL be on when switched on, and off otherwise (switches only, no steps). A switch SHALL cover a feature as the team meets it, with its smaller parts, which have no switch of their own: the Statistics page with the rotation hint, the year in songs, the services grid and the searches with no results; the Chords mode with the song history, notation and reference recordings; the service roles with My schedule, sign-ups, away dates and who leads each song; the app menu with the list of keyboard shortcuts; Who's here with the notice of who changed the slide. A feature SHALL need the feature its only way in sits in (practice rooms need the laptop layouts, which need the app menu), and SHALL be off while that one is off, keeping its own setting for when it's on again. Switching a feature on whose path is off SHALL list the features on its path and switch them on together. Owners SHALL be able to switch every feature on at once, with one confirmation; there SHALL be no button that switches them all off. The server SHALL refuse a change of the switches from anyone who isn't an owner, and SHALL ignore unknown features.

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

#### Scenario: Everything on
- **WHEN** an owner chooses "Switch all on" on the Features page and confirms
- **THEN** every feature is on, and What's new lists them for each member
