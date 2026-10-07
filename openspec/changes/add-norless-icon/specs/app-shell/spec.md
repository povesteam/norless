## ADDED Requirements

### Requirement: App icon

The app SHALL have its own icon: a letter N drawn as two parallel strands, on a blue tile when installed and on nothing in the browser tab and the installed app's splash screen, with no text and no religious symbol. Every size SHALL come from one SVG. The icon SHALL read at 16 px in a browser tab, keep the whole mark inside the circle Android crops it to, be opaque on iOS, and give Android's themed icons the strands alone.

#### Scenario: A browser tab
- **WHEN** the operator opens Norless in a browser tab
- **THEN** the tab shows the N with its two strands apart

#### Scenario: A round home screen icon
- **WHEN** a musician installs Norless on an Android phone whose launcher crops icons to circles
- **THEN** the whole N shows inside the circle

#### Scenario: Themed icons
- **WHEN** a singer's Android phone tints home screen icons to match the wallpaper
- **THEN** Norless's icon shows its N in the phone's tint

#### Scenario: Opening the installed app
- **WHEN** a musician opens the installed app on an Android phone
- **THEN** the dark splash screen shows the N without its tile
