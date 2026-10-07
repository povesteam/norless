# app-shell Specification

## Purpose
Provide the frame every feature lives in: installable, readable in light and dark rooms, usable on laptops and phones, in the member's language, and open about its source code.

## Requirements

### Requirement: Installable app

The app SHALL be installable as a PWA on phones, tablets and laptops (Windows, macOS, Linux, Android, iOS), and installing SHALL be the recommended way to use it. Installed, it SHALL run in its own window with no browser UI, have its own icon in the dock, taskbar or home screen, and open the playlist the home opens (playlists spec). The app SHALL offer an install button where the browser supports one. Where it doesn't, as in Safari on iOS, it SHALL show short instructions for that platform (e.g. "Share, then Add to Home Screen"). When the app runs in a browser tab, it SHALL work the same, and SHALL suggest installing once, in a message that can be dismissed. Screens opened from the installed app SHALL open in their own windows, except a local projector on a phone, which fills the page (`live-control`). After the first visit of someone logged in, or of a screen or a device projecting by itself (a paired screen, a projector window, local projection, the stage monitor, the offline page), the app shell SHALL load from cache when the network is unavailable, and SHALL show that it is offline. A visitor who isn't logged in, such as a phone following along, SHALL NOT download the app's offline cache, so a roomful of phones doesn't load the whole app over the church's wifi. Opening the app SHALL never flash white in a dark room: its splash screen SHALL be dark, and until its styles load the page SHALL have the system's light or dark background.

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

#### Scenario: Reload during a network drop
- **WHEN** the operator reloads the app while the network is down
- **THEN** the app frame loads and shows that it is offline and reconnecting

#### Scenario: A phone following along
- **WHEN** a visitor's phone opens the follow-along page
- **THEN** it loads that page without installing the offline cache

#### Scenario: Opening in a dark room
- **WHEN** a singer whose phone is in dark mode opens the installed app
- **THEN** the splash screen and the page while it loads are dark

### Requirement: Feels like an app

The app SHALL behave like an installed native app, not a website on a phone:
- navigation without page reloads, with short transitions, and the system back gesture or button going back one step: from a song's slides on a phone to the playlist, and closing a menu, dialog or the full-screen search before leaving the page; in the installed app, back on the first page it opened SHALL say "Press back again to close" and close only on a second back within 2 seconds
- a layout that fits the screen and its safe areas (notches, home indicator), with no zooming into inputs, no pull-to-refresh and no rubber-band scrolling of the whole page
- touch targets of at least 44 × 44 points, long-press menus instead of right-click on touch screens, and swiping between columns on phones
- interface text that can't be selected by accident; lyrics and editors stay selectable
- instant feedback: a change appears at once, before the server confirms it, and is rolled back with a message if it fails
- the installed app opening in under 1 second from cache on a phone from the last few years
- a steady layout: marking something (live, selected, focused) doesn't move or resize it or its neighbors, and focus rings aren't cut off by a scrolling column
- no browser tooltips (HTML `title`): what a tooltip would say is shown as text where it's needed, or in a styled tooltip

#### Scenario: Swipe between playlist and slides
- **WHEN** a musician swipes left on the playlist on a phone
- **THEN** the slides of the selected entry slide in, and the back gesture returns to the playlist

#### Scenario: Back from a song on an Android phone
- **WHEN** a singer taps a song in the playlist on an Android phone and presses back
- **THEN** the playlist shows again, and the app stays open

#### Scenario: Back closes the menu
- **WHEN** a member opens the menu on a phone and presses back
- **THEN** the menu closes and the page stays

#### Scenario: Closing the installed app
- **WHEN** someone presses back on the playlist the installed app opened on
- **THEN** it says "Press back again to close", and a second back within 2 seconds closes the app

#### Scenario: Instant reorder
- **WHEN** the operator drops an entry in a new position
- **THEN** it stays there at once, without waiting for the server
- **AND** if the server rejects the change, the entry moves back with a message

#### Scenario: Going live doesn't move the row
- **WHEN** an operator sends the third song live
- **THEN** its row gets the live frame, and its icon and title stay where they were

#### Scenario: No accidental zoom
- **WHEN** a member taps the search box on an iPhone
- **THEN** the page doesn't zoom in

### Requirement: Light and dark mode

The interface SHALL follow the system's light or dark setting and update when it changes. Musicians and vocalists layouts SHALL be dark by default, and a member SHALL be able to choose light, dark or the system's setting per device type. Room screens (projector, stage monitor, broadcast overlay) SHALL use their own display settings instead. A light page SHALL be able to contain a dark area, such as a preview of a stage screen, and the other way round.

#### Scenario: Dark room
- **WHEN** the operator's laptop is set to dark mode
- **THEN** the app is shown in dark colors

#### Scenario: Musician's phone in daylight mode
- **WHEN** a guitarist whose phone is set to light mode opens the musicians view
- **THEN** it is dark, until the guitarist switches it to light for phones

### Requirement: Community theme

Each community SHALL have a theme in its settings: a primary color, a background tint, a font and a logo, so the app matches its other materials. A community's pages SHALL show the community's logo and name, without the Norless name, which stays on the pages outside a community, such as logging in, My account and About. The theme SHALL apply in light and dark mode. The settings SHALL refuse colors whose text contrast falls below WCAG AA. Unu-Unu's default theme SHALL follow its site: terracotta `#ac5334`, the warm tint `#f9f5f2`, and the Switzer font.

What is live (the live entry, the live slide) SHALL be framed in the live color: the primary color's opposite hue on the color wheel, as the old app's pink stood out from its blue, so it never reads as the selection, which uses the primary color. The live color SHALL be vivid and of one lightness whatever the primary color's strength, so a dark or greyish primary color doesn't make it dull, and a frame of it SHALL stand out on light and dark pages. Each theme scope SHALL get the live color of its own primary color.

#### Scenario: Unu-Unu look
- **WHEN** a member opens Unu-Unu's pages
- **THEN** buttons and highlights use the terracotta color and the Switzer font, with the Unu-Unu logo

#### Scenario: Live and selected at once
- **WHEN** an operator at Unu-Unu selects the song that is live
- **THEN** it has the terracotta selection background inside a teal-blue live frame

#### Scenario: A navy primary color
- **WHEN** a community's primary color is navy `#2d5a8a` and a song is live
- **THEN** its frame is a bright orange, not brown

#### Scenario: Unreadable color
- **WHEN** an owner picks a very light primary color that makes button text unreadable
- **THEN** the settings explain the contrast problem and don't save it

### Requirement: Layouts

Each view that people use in different ways (controlling live, musicians, vocalists) SHALL offer one or more named layouts per device type: phone, tablet and laptop. A member's choice SHALL be remembered per member and device type, and a visitor's per device. The device type SHALL come from the screen: a phone when its shorter side is under 600 pixels, else a tablet when its main input is touch and a laptop when it's a mouse; and a member SHALL be able to change it for that device. A new layout SHALL be addable without changing the others. On a phone, views SHALL show one column at a time, with a swipe between them and a burger menu for playlists, members, settings and account. On tablets and laptops, live views (a playlist's page in every layout, the Host view) SHALL use the window's whole width, and pages to read (settings, statistics, a song, the account) SHALL stay at most 1280 pixels wide.

#### Scenario: Phone
- **WHEN** a member opens the app on a phone
- **THEN** it shows the playlist in one column, with the burger menu reachable at the top

#### Scenario: Different layouts on two devices
- **WHEN** an operator chooses Running order on laptops and the tablet layout on tablets
- **THEN** the church laptop opens Running order for them, and their tablet opens the tablet layout

#### Scenario: iPad mistaken for a laptop
- **WHEN** an iPad with a keyboard is detected as a laptop and its member sets it to tablet
- **THEN** that iPad uses the member's tablet layouts from then on

#### Scenario: A wide laptop window
- **WHEN** the operator opens the playlist on a laptop window 1600 pixels wide
- **THEN** the controller's columns reach the window's edges, and the settings page stays 1280 pixels wide in the middle

### Requirement: Preferences per device type

A member SHALL be able to set, per device type, the layout of each view, light or dark for musicians and vocalists layouts, and a text size for stage layouts, both in one Display panel that stays open while they're changed: the colors as one row of choices and the text size as a smaller, percent, larger bar. The preferences SHALL be stored with the member, so a new phone gets the member's phone preferences.

#### Scenario: Bigger text on the music stand tablet
- **WHEN** a vocalist sets a larger text size on tablets
- **THEN** every tablet they use shows vocalists layouts with the larger text

### Requirement: Empty states

A view with nothing to show SHALL say so calmly, in the community's theme: what would appear there, and the next step for people allowed to take it, e.g. "No playlists yet" with "Create the first one" for the team. An empty state SHALL NOT look like an error: no warning colors or icons, and no words like "error" or "failed". Projector screens and the broadcast overlay SHALL show only their background when there is nothing live, and stage screens a resting view (the clock, the next song when there is one), never empty-state text for the audience.

#### Scenario: New community
- **WHEN** a team member opens Norless before any playlist exists
- **THEN** the page says there are no playlists yet and offers to create the first one, in the community's colors

#### Scenario: Visitor sees the same empty list
- **WHEN** a visitor opens the same page
- **THEN** it says there are no playlists yet, without the create button

#### Scenario: Nothing live on the projector
- **WHEN** a projector screen opens before anything went live
- **THEN** it shows its background only

### Requirement: Loading states

When content takes more than 300 ms to appear, the view SHALL show placeholders shaped like the content (e.g. grey bars where playlist entries will be), never a blank page. This SHALL hold from the first moment: while the app's code itself loads, the page SHALL show the same placeholders after 300 ms, until the app shows something. Content that arrives within 300 ms SHALL appear without a placeholder flashing first. A button whose action waits for the server SHALL show that it's working, and SHALL NOT run the action twice when tapped again. Projector, stage and broadcast screens SHALL keep the last content while loading or reconnecting, and SHALL NOT show spinners or placeholders to the audience; while their code loads they SHALL stay blank.

#### Scenario: Slow church Wi-Fi
- **WHEN** a playlist takes 2 seconds to load on a phone
- **THEN** the phone shows placeholder rows for the entries until they arrive

#### Scenario: Double tap on save
- **WHEN** an editor taps save twice quickly on a slow connection
- **THEN** the song is saved once, and the button shows it's saving

#### Scenario: Opening the app on slow 4G
- **WHEN** a member opens Norless on a phone and the app's code takes 3 seconds to arrive
- **THEN** grey placeholder bars show from 300 ms on, until the playlist appears

#### Scenario: A projector opening
- **WHEN** a projector window opens and its code takes a second to load
- **THEN** it stays blank until the slide shows

### Requirement: Errors look different from empty

When something fails, such as the server not answering or a save being refused, the view SHALL say what failed and what to do next (try again, or whom to ask), in a way that is clearly different from an empty state. Text the person typed SHALL be kept.

#### Scenario: Save refused
- **WHEN** a save of a song fails because the connection dropped
- **THEN** the editor says the song wasn't saved, offers to try again, and keeps the typed text

### Requirement: Icons

Every button, menu item, navigation link and layout choice SHALL show an icon before its text, from one icon set, the same icon for the same action everywhere. Where space is tight, a button MAY show only its icon, and SHALL then have an accessible name. Icons SHALL be decorative for screen readers. Slides, part buttons and page previews SHALL show their own content instead.

#### Scenario: Icons in the Classic menu
- **WHEN** a member opens the menu
- **THEN** Create new song, the members, settings, privacy and About links each show an icon before their text

#### Scenario: Icon-only button on a phone
- **WHEN** the live buttons show only their icons on a phone
- **THEN** a screen reader still reads "Close", "Previous" and "Next"

### Requirement: Translatable interface

Every user-facing text SHALL be translatable. The app SHALL ship with Romanian, Ukrainian and English, each complete. For now, the interface SHALL be English for everyone and offer no language choice, until the Romanian and Ukrainian texts are reviewed. When the choice comes back, each member SHALL be able to choose a UI language, defaulting to the browser's language, or English when that's unsupported. Dates and relative times SHALL follow the interface language, and times of day SHALL use the 24-hour clock in every language, in the app and in notifications. The automated checks SHALL fail on user-facing text written in the code instead of passed through the translations.

#### Scenario: English for now
- **WHEN** a member whose browser is in Romanian opens Norless
- **THEN** menus, buttons, messages and dates are in English, and no language picker is offered

#### Scenario: Missing translation is caught before release
- **WHEN** a developer adds a button label without Romanian and Ukrainian translations
- **THEN** the automated checks fail

#### Scenario: Hard-coded text is caught before release
- **WHEN** a developer writes a button label straight in the code
- **THEN** the automated checks fail

#### Scenario: A service's time
- **WHEN** a member reads a Sunday 10 o'clock service in the team schedule, in English
- **THEN** it says 10:00, and a 7 in the evening rehearsal says 19:00, without AM or PM

### Requirement: Language labels

Where a community language is shortened (song editor tabs, Project buttons, projector previews, screens, the vocalists' language choice), it SHALL show as a country code with the country's flag, drawn by the app so it looks the same on every device (Windows shows no flag emoji): RO with Romania's flag and UA with Ukraine's, since Ukrainian's code `uk` reads as the United Kingdom. A language without a flag SHALL show its code alone. The interface language picker SHALL keep each language's own name.

#### Scenario: Ukrainian tab
- **WHEN** an editor opens the song editor in a community with Romanian and Ukrainian
- **THEN** the tabs read RO and UA, each with its flag

### Requirement: Permalinks

The app SHALL live at `norless.com`. Every URL of a community SHALL start with the community's slug, e.g. `norless.com/unu-unu/playlists/…`, so links keep working when more communities join. Playlists, songs and screens SHALL also have a short code of 6 letters and digits, e.g. `norless.com/x9Kp4w`, that redirects to the full URL, for sharing in chats; 3 were too short, and the first 3- and 4-character codes keep working. Short codes SHALL never be reused. Every code has a digit, so community slugs SHALL have none, and never collide with a code. A screen's settings SHALL offer one link, its short link, both to open and to copy.

#### Scenario: Link to a song
- **WHEN** an editor sends a song's URL to another editor
- **THEN** the other editor opens it straight in the song view

#### Scenario: Short link in a chat
- **WHEN** the operator shares `norless.com/x9Kp4w` for today's playlist on WhatsApp
- **THEN** opening it shows that playlist

### Requirement: Old links keep working

URLs of the old app on `app.norless.com` and `app-ua.norless.com` SHALL redirect to the new app, including old playlist links (`/playlist/<old id>`) to the imported playlist. Once the interface language can be chosen again, links from `app-ua.norless.com` SHALL open with the Ukrainian language selected.

#### Scenario: Old playlist bookmark
- **WHEN** someone opens a bookmarked `app.norless.com/playlist/<old id>` after the cutover
- **THEN** they land on the same playlist in the new app

#### Scenario: Ukrainian bookmark
- **WHEN** someone opens `app-ua.norless.com` once the language choice is back
- **THEN** the new app opens with Ukrainian selected

### Requirement: Connection status

The app SHALL show when it is disconnected or reconnecting, and SHALL reconnect automatically. When connected, the indicator SHALL get out of the way.

#### Scenario: Server restart
- **WHEN** the server restarts during a service
- **THEN** the app shows "reconnecting", and continues once the server is back, without a reload

### Requirement: Source code link

Every page, except screens, SHALL link to the source code and the license (AGPL-3.0-or-later), through About. If the running version differs from the public repository, the link SHALL lead to the running version's source. About, Privacy and Install SHALL be in the app's menus and never in a footer, so the app doesn't look like a website: on a laptop in the account menu, or for visitors in a small ⋯ menu beside Log in; on a phone in a community's menu.

#### Scenario: A user asks for the source
- **WHEN** a member opens "About"
- **THEN** it shows the license and a link to the source code of the running version

#### Scenario: About on a phone
- **WHEN** a singer opens a playlist on a phone
- **THEN** About and Privacy are in the menu, and not at the bottom of the page

#### Scenario: About on a laptop
- **WHEN** a member opens a playlist on a laptop
- **THEN** the page has no footer, and About and Privacy are in the menu under their name

#### Scenario: A visitor on a laptop
- **WHEN** a visitor opens a playlist on a laptop
- **THEN** About and Privacy are in the ⋯ menu beside Log in

### Requirement: Privacy notice

The app SHALL have a privacy page, linked from every page except screens, from the app's menus (`Source code link`). It SHALL say what personal data is stored (name, email, Google profile picture, sessions, who did what), why, for how long, who is responsible, and how to get one's data or delete one's account. The responsible party SHALL be the community, set with its contact in the community settings (for Unu-Unu: the church). The notice SHALL also name the service operator, who processes the data on the community's behalf, and the services it uses (hosting, email). A member SHALL be able to delete their own account; their past contributions then stay without a name. The app SHALL set only the cookies it needs (the session), so no cookie banner is needed.

#### Scenario: Member deletes their account
- **WHEN** a member deletes their account on My account
- **THEN** their email, name and picture are removed, and songs and playlists they added stay without a name

### Requirement: Keyboard shortcuts overview

Pressing `?` outside a text field SHALL show all keyboard shortcuts.

#### Scenario: New operator
- **WHEN** a new operator presses "?"
- **THEN** a list of shortcuts appears (search, add, live, next, previous, blank, delete, save)

### Requirement: New versions reach open pages

After a new version of Norless is deployed, every open page SHALL find it without a manual reload: when its live connection reconnects, and at least hourly. Controllers' and members' pages SHALL show a notice that a new version is ready, with a Reload button, and SHALL NOT reload by themselves; the notice SHALL close with ✕ and come back only with the next new version. Screens and stage devices SHALL reload by themselves to the new version, but only while they show nothing: their room is blank, or no service or rehearsal is running by the schedule. A reload SHALL never interrupt a song on a screen.

#### Scenario: The operator's laptop during a service
- **WHEN** a new version is deployed while the operator runs a service
- **THEN** the laptop shows "A new version of Norless is ready" with Reload, and keeps working until the operator reloads

#### Scenario: Not now
- **WHEN** an operator closes the new-version notice with ✕ during a service
- **THEN** it stays closed until another new version is deployed

#### Scenario: The projector waits for blank
- **WHEN** a new version is deployed while the projector shows a refrain
- **THEN** the projector keeps showing it, and reloads to the new version the next time the operator blanks the screen

#### Scenario: The stage TV during the week
- **WHEN** a new version is deployed on a Wednesday with no service running
- **THEN** the stage TV reloads to it at once

### Requirement: Accessibility checks

The automated checks SHALL open every page the end-to-end tests visit, screens included, in light and dark mode, and SHALL fail on any serious or critical accessibility violation that axe-core finds.

#### Scenario: A button without a name
- **WHEN** a developer adds an icon-only button without an accessible name
- **THEN** the automated checks fail

### Requirement: Community bar

While the app frame is on, a community's pages SHALL start with one bar: the community's logo and name, which open its home, then, on a playlist, its title and actions (⋯); Playlists; menus that group its other pages: Stage (the musicians and vocalists views, the stage monitor, the Host view), Team (the team schedule, My schedule) and More (statistics, recordings, the feature tree, a new song, ideas and feedback, changes, settings); then the interface language and the account. Each menu SHALL list only the pages this person may open with the community's features; a menu with one page SHALL show as that page's link, and an empty one SHALL not show. On a laptop the bar SHALL take one line. On a phone, the bar SHALL hold, from the left, a burger menu with the same groups, the language, About, Privacy and Install; the community's name, or on a playlist its name, which opens its actions, Rename first, with the community's name on a line of its own above the bar, small, muted and centered; and at the right end the account as a round photo or initials, with the name in a tooltip, or Log in for a visitor, as in Classic's bar. While the app frame is off, the Classic bar SHALL stay (`classic-layout` spec).

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

### Requirement: Start page

The app's address without a path SHALL open the community this device opened last. On a device that has opened no community in this browser, it SHALL show a one-page presentation instead: in a card with the app's icon, one line on what Norless is; Install as the main button (the browser's install prompt, or the platform's steps where the browser has none, as in Safari on iOS); and the way into the community: a button "Open" with its name when there is one community, the list of communities when there are several. Log in SHALL be only in the page's header. Where the browser may offer to install, Install's place SHALL be kept, so nothing moves when the offer comes. While that one community has something live and follow-along is on, the page SHALL link its follow-along page at the top. The page SHALL link the manual. The install suggestion SHALL NOT show on the presentation, where Install is the main button. The installed app SHALL never show the presentation: it opens the playlist the home opens, or the list of communities when there are several, since an installed app doesn't share the browser's storage on every platform.

#### Scenario: A new phone
- **WHEN** a new team member opens `norless.com` in Chrome on an Android phone for the first time
- **THEN** the presentation shows with Install as its main button, and once installed, the app opens on the community's playlist, where they log in

#### Scenario: iPhone
- **WHEN** someone opens `norless.com` in Safari on an iPhone for the first time
- **THEN** Install shows how to add Norless to the home screen

#### Scenario: Back on a known device
- **WHEN** a singer who opened the community on this phone before opens `norless.com`
- **THEN** the community's playlist opens, without the presentation

#### Scenario: The installed app
- **WHEN** someone opens the installed app from the home screen for the first time
- **THEN** it opens on the playlist the home opens, never on the presentation

#### Scenario: During a service
- **WHEN** a visitor types `norless.com` while songs are live and follow-along is on
- **THEN** the presentation links following along at the top

#### Scenario: Several communities
- **WHEN** there are two communities and a fresh device opens `norless.com`
- **THEN** the presentation lists both

#### Scenario: A browser that can't install
- **WHEN** someone opens `norless.com` in Firefox on a laptop for the first time
- **THEN** Open with the community's name is the button in the card, and Log in is in the header

### Requirement: Window title

The browser tab's and the installed app's window title SHALL say where one is: the place, then the community ("October 4 · Unu-Unu", "Amazing Grace · Unu-Unu", "Settings · Unu-Unu"), and "Norless" outside a community.

#### Scenario: Two windows on a laptop
- **WHEN** an operator has a playlist in one window and a song's page in another
- **THEN** their titles name the playlist and the song, each with the community

### Requirement: Links in menus

On a laptop, a menu item that opens a page SHALL be a link, so that right-click, Cmd or Ctrl-click and middle-click work on it as on any link.

#### Scenario: A new tab from the menu
- **WHEN** a member Cmd-clicks Settings in the community's menu
- **THEN** Settings opens in a new tab

### Requirement: Not found

An address that leads nowhere (an unknown page, community or record) SHALL say that the page doesn't exist, and SHALL offer Go back first, where there is a page to go back to, and the start page second.

#### Scenario: A link to a page that's gone
- **WHEN** a member follows a link from a playlist to a page that doesn't exist
- **THEN** the page says so, and Go back returns to the playlist

### Requirement: System bars in the app's colors

On a phone, the status bar and, where the system lets the page color it, the navigation bar SHALL take the background of the page shown: the app's light or dark mode and the community's colors, and a view that fills the page its own background.

#### Scenario: A light playlist after a dark stage view
- **WHEN** a singer goes from the vocals view, which is dark, to the playlist in light mode
- **THEN** the phone's status bar turns light with the page

### Requirement: Phone menus as pages

On a phone, the community's menu (the ☰, in Classic and with the app frame) SHALL take the screen below the bar, scroll on its own, and hold the page behind it still, so a scroll that reaches the menu's end doesn't move the page.

#### Scenario: Scrolling a short menu
- **WHEN** a member opens the menu on a phone and swipes up on it
- **THEN** the menu stays where it is, and the playlist behind it doesn't move

### Requirement: Who's online by the photo

Who's online SHALL never include the person looking. On a phone, the others online SHALL stack small under the person's photo in the community's bar, instead of a row above the search box; the photo SHALL open the account menu as a page of its own, with a row as tall as the bar on top and who's online under it, each with their devices and the stage views they have open. On a laptop the row above the search box SHALL stay, without the person looking.

#### Scenario: Two in the team online
- **WHEN** Ioana opens a playlist on her phone while Maria has it open on hers
- **THEN** Maria's photo sits small under Ioana's in the bar, and Ioana's own photo is in no row of who's online
