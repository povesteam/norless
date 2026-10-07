## MODIFIED Requirements

### Requirement: Installable app

The app SHALL be installable as a PWA on phones, tablets and laptops (Windows, macOS, Linux, Android, iOS), and installing SHALL be the recommended way to use it. Installed, it SHALL run in its own window with no browser UI, have its own icon in the dock, taskbar or home screen, and open the playlist the home opens (playlists spec). The app SHALL offer an install button where the browser supports one. Where it doesn't, as in Safari on iOS, it SHALL show short instructions for that platform (e.g. "Share, then Add to Home Screen"). When the app runs in a browser tab, it SHALL work the same, and SHALL suggest installing once, in a message that can be dismissed, on any page but the login page, which keeps to logging in, and the start page's presentation, where Install is the main button. Screens opened from the installed app SHALL open in their own windows, except a local projector on a phone, which fills the page (`live-control`). After the first visit of someone logged in, or of a screen or a device projecting by itself (a paired screen, a projector window, local projection, the stage monitor, the offline page), the app shell SHALL load from cache when the network is unavailable, and SHALL show that it is offline. A visitor who isn't logged in, such as a phone following along, SHALL NOT download the app's offline cache, so a roomful of phones doesn't load the whole app over the church's wifi. Opening the app SHALL never flash white in a dark room: its splash screen SHALL be dark, and until its styles load the page SHALL have the system's light or dark background.

#### Scenario: Install on a tablet
- **WHEN** a musician installs the app on a tablet and opens it from the home screen
- **THEN** it opens on the next service's playlist, with no browser UI

#### Scenario: Install on the operator laptop
- **WHEN** the operator opens Norless in Chrome on the church laptop and clicks "Install"
- **THEN** Norless gets its own window and dock icon, and opens there from then on

#### Scenario: iPhone
- **WHEN** a singer opens Norless in Safari on an iPhone
- **THEN** the app shows how to add it to the home screen

#### Scenario: Using it in a tab
- **WHEN** a member dismisses the install suggestion
- **THEN** the app keeps working in the tab, and doesn't ask again on that device

#### Scenario: Logging in
- **WHEN** someone opens the login page in a browser tab
- **THEN** it shows no install suggestion, which waits for the next page

#### Scenario: Reload during a network drop
- **WHEN** the operator reloads the app while the network is down
- **THEN** the app frame loads and shows that it is offline and reconnecting

#### Scenario: A phone following along
- **WHEN** a visitor's phone opens the follow-along page
- **THEN** it loads that page without installing the offline cache

#### Scenario: Opening in a dark room
- **WHEN** a singer whose phone is in dark mode opens the installed app
- **THEN** the splash screen and the page while it loads are dark
