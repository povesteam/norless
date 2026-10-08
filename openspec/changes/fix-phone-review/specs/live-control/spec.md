## MODIFIED Requirements

### Requirement: Phone and tablet controls

On a tablet, a controller SHALL see the playlist on the left and, in a column on the right, the live panel with large next, previous and blank buttons, which stays in view while the column scrolls, and under it the selected entry's parts as large cards that go live when tapped (the panel at the bottom hid the whole playlist); the panel's Pages, message to the stage and This device sit under the parts, so the parts start on the first screen. On a phone, a controller SHALL see three views, Order, Song and Screens, with a swipe between them, and a bar with previous, next and blank that stays at the bottom of every view. On a phone, the bar SHALL be compact by default: the live entry's title and Previous, Blank and Next; a button, a tap on the bar's title or dragging the title up SHALL expand it to the parts, the other controls, Pages and the message to the stage, and the same, or dragging it down, SHALL collapse it again; the phone SHALL remember which. In the compact bar, someone else's change SHALL show in place of the title for a few seconds. In the phone, tablet and Operator layouts, a tap on an entry SHALL select it and show its parts without sending it live (on a phone, the Song view comes into view), and a Go live button above the parts SHALL send it live. On a phone, the Song view SHALL show a song's parts in one language at a time, with a choice of the community's languages above them, starting in the interface language when the community has it, and the phone SHALL remember the choice.

#### Scenario: One-handed control
- **WHEN** a guitarist opens the app on a phone clipped to a stand
- **THEN** next and previous are reachable as large buttons without scrolling

#### Scenario: The playlist beside the controls
- **WHEN** an operator opens today's playlist in the Tablet layout on a tablet
- **THEN** the playlist's entries and the live panel show side by side, without scrolling

#### Scenario: The slides on the first screen
- **WHEN** an operator opens today's playlist in the Tablet layout on a tablet of 1024 by 768 pixels and a song is live
- **THEN** the live song's first parts show without scrolling, beside the playlist

#### Scenario: Tablet on the music stand
- **WHEN** an operator taps the bridge card on a tablet
- **THEN** the bridge goes live

#### Scenario: The playlist stays visible
- **WHEN** an operator opens today's playlist in the Phone layout on a phone
- **THEN** the live bar shows only the title and Previous, Blank and Next, and the playlist fills the rest of the screen
- **AND** after they expand the bar and reload the page, it is still expanded

#### Scenario: Checking the next song on a phone
- **WHEN** an operator taps the next song in the Order view on a phone
- **THEN** the Song view shows its parts, the screens don't change, and Go live sends it

#### Scenario: Opening the bar by its title
- **WHEN** an operator taps "Poartă-ți lumina prin întuneric" in the compact bar on a phone
- **THEN** the bar expands to the parts and the other controls, and dragging the title down folds it again

#### Scenario: One language in the Song view
- **WHEN** an operator with a Romanian interface opens the Song view on a phone, in a community with Romanian and Ukrainian
- **THEN** the parts show in Romanian only, and choosing Ukrainian shows them in Ukrainian
