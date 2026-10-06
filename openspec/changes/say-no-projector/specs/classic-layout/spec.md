## MODIFIED Requirements

### Requirement: Projecting from Classic

For the team on a laptop, Classic SHALL offer a button for each projector screen of the room, named as the screen ("Projector RO"), or for each language, when no projector screen is set up ("Projector RO" too), which opens it full screen on the projector: on the display that isn't the laptop's, or the one chosen before on this laptop, where the browser lets pages choose (it asks once). Elsewhere, or until it's allowed, it SHALL open in a window that the operator moves to the projector. Where the browser can tell the laptop has no other display, the button SHALL instead say that no projector is attached, with "Open anyway", which opens that window; a projector's window already open SHALL come forward without asking. Pressing Project again SHALL bring that window forward instead of opening a second one, also after the controller's page reloads; and the live keys (Page Up and Down, arrows, Esc, Enter) pressed while the projector's window has the focus SHALL act as on the controller. Each projector SHALL show its language with its display settings (background, title, progress, key, next line, refrains in italics, the final mark). On touch devices, each projector's button SHALL show a preview of that projector in the page and hide it again.

#### Scenario: RO and UA projectors from one playlist
- **WHEN** an operator opens the Romanian and the Ukrainian projector with their Project buttons, and sends a song live
- **THEN** the Romanian window shows the Romanian slide and the Ukrainian window the Ukrainian one, without a second operator

#### Scenario: Preview on a tablet
- **WHEN** a team member taps "Projector RO" on a tablet
- **THEN** the projector's current slide is shown in the page, and a second tap hides it

#### Scenario: No projector attached
- **WHEN** an operator presses "Projector RO" on a laptop without a second display
- **THEN** Norless says no projector is attached instead of covering the laptop with a black window, and "Open anyway" opens the projector in a window
