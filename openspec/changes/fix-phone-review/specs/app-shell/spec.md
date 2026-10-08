## MODIFIED Requirements

### Requirement: Community bar

While the app frame is on, a community's pages SHALL start with one bar: the community's logo and name, which open its home, then, on a playlist, its title and actions (⋯); Playlists; menus that group its other pages: Stage (the musicians and vocalists views, the stage monitor, the Host view), Team (the team schedule, My schedule) and More (statistics, recordings, the feature tree, a new song, ideas and feedback, changes, settings); then the interface language and the account. Each menu SHALL list only the pages this person may open with the community's features; a menu with one page SHALL show as that page's link, and an empty one SHALL not show. On a laptop the bar SHALL take one line. On a phone, the bar SHALL hold, from the left, a burger menu with who's online, the same groups, the language, About, Privacy and Install, or on a page below the top a way back in its place (Back on a phone); the community's name, or on a playlist its name, which opens its actions, Rename first, with the community's name on a line of its own above the bar, small, muted and centered; and at the right end the account as a round photo or initials, with the name in a tooltip, which opens My account, or Log in for a visitor, as in Classic's bar. While the app frame is off, the Classic bar SHALL stay (`classic-layout` spec).

#### Scenario: A team member, every feature on
- **WHEN** a team member opens a playlist on a laptop 1440 pixels wide, with every feature on
- **THEN** the community's pages fit in one bar, with Musicians under Stage, My schedule under Team and Statistics under More

#### Scenario: A visitor
- **WHEN** a visitor opens a playlist, with the app frame and the stage views on
- **THEN** the bar shows Playlists and Stage with the musicians, vocalists and stage monitor, and no Team or More

#### Scenario: A phone
- **WHEN** a team member opens the Playlists page on a phone
- **THEN** the bar shows the menu button at the left, the community's name, and their photo at the right end, which opens My account

#### Scenario: The playlist's title on a phone
- **WHEN** a team member opens the playlist of 4 October on a phone, with the app frame on
- **THEN** the community's name shows centered above the bar, which holds the menu button, "October 4" and their photo, and tapping the title opens the playlist's actions

### Requirement: Source code link

Every page, except screens, SHALL link to the source code and the license (AGPL-3.0-or-later), through About. If the running version differs from the public repository, the link SHALL lead to the running version's source. About, Privacy and Install SHALL be in the app's menus or on My account, never in a footer, so the app doesn't look like a website: on a laptop at the bottom of My account, or for visitors in a small ⋯ menu beside Log in; on a phone in a community's menu, and at the bottom of My account.

#### Scenario: A user asks for the source
- **WHEN** a member opens "About"
- **THEN** it shows the license and a link to the source code of the running version

#### Scenario: About on a phone
- **WHEN** a singer opens a playlist on a phone
- **THEN** About and Privacy are in the menu, and not at the bottom of the page

#### Scenario: About on a laptop
- **WHEN** a member opens a playlist on a laptop
- **THEN** the page has no footer, and About and Privacy are at the bottom of My account, which their photo opens

#### Scenario: A visitor on a laptop
- **WHEN** a visitor opens a playlist on a laptop
- **THEN** About and Privacy are in the ⋯ menu beside Log in

### Requirement: Who's online by the photo

Who's online SHALL never include the person looking. On a phone, the others online SHALL stack small under the person's photo in the community's bar, instead of a row above the search box, and SHALL be listed at the top of the community's menu (☰), each with their devices and the stage views they have open; the photo SHALL open My account. On a laptop the row above the search box SHALL stay, without the person looking.

#### Scenario: Two in the team online
- **WHEN** Ioana opens a playlist on her phone while Maria has it open on hers
- **THEN** Maria's photo sits small under Ioana's in the bar, and Ioana's own photo is in no row of who's online

#### Scenario: Who's online on a phone
- **WHEN** Ioana opens the menu on her phone while Maria has the vocalists view open
- **THEN** the menu starts with Maria, her phone and Vocals

## ADDED Requirements

### Requirement: Back on a phone

On a phone, where an iPhone has no back button, a page opened from another page SHALL show a back button (←) at the left of the bar, in the place of the community's menu (☰): a song, its editor and its chords, a new song, a recording, and a settings section. It SHALL go back to the page it came from, or, opened from a link, to its parent: the song from its editor and chords, the settings' list from a section, the recordings from a recording, and the community's home from a song. The pages outside a community (My account, About, Privacy, the app team's pages) SHALL keep their way back to the community this device opened last at the top while they scroll. The bar SHALL stay at the top while a page scrolls, in Classic's bar and the community bar alike.

#### Scenario: Back from a song on an iPhone
- **WHEN** a singer taps a song in the playlist's search on an iPhone, scrolls down its page, and taps ←
- **THEN** the playlist shows again

#### Scenario: A song opened from a link
- **WHEN** a member opens a song's link from a message on a phone and taps ←
- **THEN** the community's home opens

#### Scenario: Back from My account
- **WHEN** a member scrolls to the bottom of My account on a phone
- **THEN** "Back to Unu-Unu" is still at the top of the screen
