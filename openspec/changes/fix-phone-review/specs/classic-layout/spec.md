## MODIFIED Requirements

### Requirement: Classic menu

Classic's bar SHALL hold, from the left, a menu button; on a playlist, its name (its title, then its date muted; or the date alone: playlists spec), its actions (⋯) and the community's name, smaller and muted, on the same line, elsewhere the community's name alone; on a phone with a playlist open, the community's name SHALL take a line of its own above the bar, small, muted and centered, and the playlist's name SHALL open its actions, Rename first, with no ⋯ button; and at the right end the account: the person's round photo or initials, with their name in a tooltip, which opens My account, or Log in for a visitor. On a phone, a page below the top SHALL show a way back in the menu button's place (`app-shell` spec, Back on a phone). The menu button SHALL open a panel from the left with: the community's name; for the team, a New playlist button, and the 10 newest playlists, each with its creator and the open one marked, with a filter box that finds any older one by its title or its date in any of Norless's languages; for editors, Create new song; who is online, for members, under an "Online" heading; the interface language, while it can be chosen; for owners, Ideas and feedback once (their Ideas page) and a link to the settings, where the members are too; and links to the privacy notice and About. Choosing a playlist SHALL open it and close the panel. Escape, a close button at the panel's top or a click beside it SHALL close the panel (no visible way to close it with the mouse). The team SHALL give the open playlist a title by clicking its name in the bar, which turns into a text field with the date as its placeholder (Enter or leaving saves, Escape cancels, an empty field leaves the date alone), or with Rename in its actions, and archive it there, and restore it while archived; the menu's "Show archived" lists the archived ones. A long title SHALL be cut with an ellipsis, the community's name first, so the account stays in the bar.

#### Scenario: New playlist for Sunday
- **WHEN** an operator presses New playlist, and the next service is on 11 October 2026
- **THEN** an untitled playlist is created and opened, its name in the bar "11 octombrie" for a Romanian interface, not being edited

#### Scenario: An old playlist
- **WHEN** an operator types "Crăciun", or "decembrie", in the menu's filter box
- **THEN** the playlists whose title has "Crăciun", or whose date is in December, are listed, however old

#### Scenario: Create a new song
- **WHEN** an editor chooses Create new song
- **THEN** the editor opens on a new song with the title field focused, and "Save and add to playlist" creates it and adds it to the current playlist; closing creates nothing

#### Scenario: The account at the right
- **WHEN** Ana, logged in with a photo, opens Classic on a phone
- **THEN** the menu button is at the left of the bar and her photo at the right end, and tapping the photo opens My account

#### Scenario: Renaming in the bar
- **WHEN** an operator clicks "October 4" in the bar, types "Botez" and presses Enter
- **THEN** the playlist shows as "Botez" with "October 4" muted after it, for everyone; had they pressed Escape, it would have stayed untitled

#### Scenario: The title on a phone
- **WHEN** a team member opens the playlist of 4 October in Classic on a phone
- **THEN** "Unu-Unu" shows small and centered above the bar, which holds ☰, "October 4" and their photo

#### Scenario: Renaming on a phone
- **WHEN** an operator on a phone taps "Botez" in the bar and chooses Rename
- **THEN** the title turns into a text field

