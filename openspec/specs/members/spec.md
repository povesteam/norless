# members Specification

## Purpose
Manage who belongs to the community and what each person may do, bring existing accounts over one by one, and show who is online.

## Requirements

### Requirement: Roles

A member SHALL have zero or more roles:
- **owner**: all actions, including managing members, screens and community settings
- **editor**: create, edit and delete songs
- **team**: control live and manage playlists (the people at the laptop, the singers and the musicians)

A member with no role SHALL be able to do what visitors can, and also see names and who is online, and keep their own preferences. Roles SHALL combine: a member with several roles can do what each of them allows. Owners SHALL pass every role check. Anyone, without logging in, SHALL be able to read songs and playlists, search, export playlists, see what is live and project locally. Member lists, presence, community settings, and every change SHALL require membership with the matching role. The server SHALL enforce roles on every action.

#### Scenario: Editor who is also on the team
- **WHEN** a member has the editor and team roles
- **THEN** they can edit songs, change playlists and control live, but not manage members

#### Scenario: Former operators and musicians
- **WHEN** the roles are updated on an existing community
- **THEN** every member who had the operator or the musician role has the team role

### Requirement: Who can do what

Each action SHALL be allowed to exactly these people (✓), and the server SHALL refuse it to anyone else:

| Action | Visitor | Member, no role | Team | Editor | Owner |
|---|---|---|---|---|---|
| Read songs and playlists, search, export, project locally, see what's live | ✓ | ✓ | ✓ | ✓ | ✓ |
| See names, avatars and who is online | | ✓ | ✓ | ✓ | ✓ |
| Like or dislike songs, with a reason for a dislike; see the counts | | ✓ | ✓ | ✓ | ✓ |
| Keep preferences (language, layouts, colors, text size) | on the device | ✓ | ✓ | ✓ | ✓ |
| Keep the songs and newest playlists on a device, to project them offline | | ✓ | ✓ | ✓ | ✓ |
| Keep a musician profile (instruments, guitar shapes, note names, chord colors) | | ✓ | ✓ | ✓ | ✓ |
| Choose one's photo: Google's, an uploaded one, or initials | | ✓ | ✓ | ✓ | ✓ |
| Delete one's own account | | ✓ | ✓ | ✓ | ✓ |
| Switch off being counted in usage events | | ✓ | ✓ | ✓ | ✓ |
| Log another device in as oneself, from a phone | | ✓ | ✓ | ✓ | ✓ |
| Send an idea or feedback to the owners | | ✓ | ✓ | ✓ | ✓ |
| See the feature tree, ask the owners for a feature that's off or planned and withdraw it, see how many asked | | ✓ | ✓ | ✓ | ✓ |
| Read and archive ideas and feedback | | | | | ✓ |
| Read the reasons for dislikes, exclude a song and include it again | | | | | ✓ |
| Control live: next, previous, blank, parts, pages, stage messages, verses from bible.com, mode | | | ✓ | | ✓ |
| Start a practice room, and join one | | | ✓ | | ✓ |
| Share the chord played, from a piano, the mixer or a microphone | | | ✓ | | ✓ |
| See the team schedule; accept or decline one's own slots, take open ones or offer to; mark one's away days; get notifications | | ✓ | ✓ | ✓ | ✓ |
| Build the team schedule: templates, slots, who's in them, confirm offers, mark people for roles | | | ✓ | | ✓ |
| Tell a service's people its playlist is ready | | | ✓ | | ✓ |
| Edit the service roles | | | | | ✓ |
| Set the church's calendar address, and see it | | | | | ✓ |
| See what's coming in the church's calendar | | ✓ | ✓ | ✓ | ✓ |
| Switch a practice room between rehearsal and service, and end it | | | own | | ✓ |
| Open screens on displays, pair a TV as a screen, share a screen's short link | | | ✓ | | ✓ |
| Log a laptop in as the community's laptop, or a guest musician's phone, and end it | | | ✓ | | ✓ |
| Create, rename, archive and restore playlists, change their entries and their host's words | | | ✓ | | ✓ |
| Create, edit and delete songs | | | | ✓ | ✓ |
| Edit chords, bar lines, `!` notes, notation blocks, tempo and the reference links of songs | | | ✓ | ✓ | ✓ |
| Change a song's key permanently, moving its chords | | | ✓ | ✓ | ✓ |
| Set a song's key for one service, on its playlist entry | | | ✓ | | ✓ |
| Choose who leads a song, on its playlist entry; see who leads | | | ✓ | | ✓ |
| See who leads each song | | ✓ | ✓ | ✓ | ✓ |
| Listen for the band's tempo on a device | | | ✓ | | ✓ |
| Record audio (guest musicians too) | | | ✓ | | ✓ |
| See the recordings and ask for access | | | ✓ | | ✓ |
| Listen to and download a recording | | | own, or when granted | | own, or when granted |
| Grant or refuse access to a recording | | | own | | own |
| Delete a recording | | | own | | ✓ |
| See a song's history | | ✓ | ✓ | ✓ | ✓ |
| See the song statistics: most sung, not sung lately, each song's services | | ✓ | ✓ | ✓ | ✓ |
| Copy a playlist's YouTube chapters | | ✓ | ✓ | ✓ | ✓ |
| Correct when a service's stream started | | | ✓ | | ✓ |
| Open the Host view | | ✓ | ✓ | ✓ | ✓ |
| Restore a song as it was before a save | | | | ✓ | ✓ |
| See the searches that found nothing | | | | ✓ | ✓ |
| Invite and remove members, change roles | | | | | ✓ |
| Community settings: theme, privacy contact, languages, schedule, screens, pages, interface step and feature switches, Bible versions, note names, tempo check, YouTube channel | | | | | ✓ |
| See who asked for a feature, with their notes | | | | | ✓ |
| Read the change log: who changed what, when, and what it was before | | | | | ✓ |

Screen devices, opened with a screen's secret URL or paired with a code, SHALL only show live content. Usage events SHALL be read only by the Norless app team, whatever their roles in a community.

#### Scenario: Team member can't edit lyrics
- **WHEN** a member with only the team role sends a change to a song's lyrics
- **THEN** the server refuses it

#### Scenario: Editor can't control live
- **WHEN** a member with only the editor role opens the live song
- **THEN** no live controls are offered, and the server refuses a live change from them

#### Scenario: Visitor without an account
- **WHEN** a visitor who isn't logged in opens Norless
- **THEN** they can search and read songs and playlists, but see no member list and no edit or live controls

#### Scenario: Server enforces roles
- **WHEN** a member without the editor role sends a song update directly to the server
- **THEN** the server rejects it

### Requirement: Settings with tabs

Owners SHALL find the community's settings in tabs, each with its own address (`/settings/<tab>`): Members first, then Theme, Privacy, Schedule, Screens and Pages. On laptops and tablets the tabs SHALL be a list at the side; on a phone, `/settings` SHALL list the sections, each opening on its own page with a way back to the list. The members SHALL be managed there, not from a menu entry of their own; the old `/members` address SHALL lead to the Members tab. Features are switched in the feature graph, and the old `/settings/interface` address SHALL lead to the Features page.

#### Scenario: Straight to the schedule
- **WHEN** an owner opens Settings and chooses the Schedule tab
- **THEN** the address ends in `/settings/schedule`, and opening it later shows that tab

#### Scenario: Settings on a phone
- **WHEN** an owner opens Settings on a phone and taps Schedule
- **THEN** the schedule's page opens with a way back to the list of sections

### Requirement: Invitations

An owner SHALL be able to invite a person by email with chosen roles. The invited person SHALL get an email with a login link. The invitation SHALL be accepted on their first login with that email address, whether through Google or an email link.

#### Scenario: Invite a new vocalist
- **WHEN** the owner invites "ana@example.com" with the team role
- **THEN** Ana gets an email, and after logging in she can control live

### Requirement: Review imported accounts one at a time

The owner SHALL see a list of accounts imported from the old app, one row per person. Each row SHALL show the display name, email, old admin status, the date the account was created, and when it was last active, as far as the old data shows it. For each person the owner SHALL be able to invite them (choosing roles) or delete them; deleting SHALL be in the row's menu (⋯), after a confirmation. Deleting SHALL remove the person's email and name, and keep their past contributions anonymous.

#### Scenario: Inactive account
- **WHEN** the owner reviews an account last active in 2017 and chooses delete
- **THEN** the person's email and name are removed, and songs they created stay without a name

#### Scenario: Linked on first login
- **WHEN** the owner invites an imported person and they log in with the same email through Google
- **THEN** their account is linked to the imported one, and their past songs and playlists show them as creator

### Requirement: Remove a member or change roles

An owner SHALL be able to change a member's roles and remove a member. Removing SHALL be in the member's row menu (⋯), after a confirmation, not a button on every row. The last owner SHALL NOT be removable, and SHALL NOT be able to drop their own owner role.

#### Scenario: Last owner
- **WHEN** the only owner tries to remove their own owner role
- **THEN** the system refuses and explains that the community needs an owner

### Requirement: Attribution

The system SHALL record who created and who last changed every song, playlist and playlist entry, and who made each live change. Members SHALL see who added a playlist entry with the selected entry ("Added by …" under its title in Classic, above its parts in the other layouts), not on every row, and who created and last edited each song as small avatars with the name in a styled tooltip. Visitors who aren't logged in SHALL NOT see names or avatars.

A member's avatar SHALL be their photo, else their initials. At each Google login, the photo of their Google account SHALL be copied into Norless, and again every week from where Google gave it, unless they uploaded their own or chose initials; a photo that didn't change SHALL stay as it is. On My account a member SHALL be able to upload a photo, use their initials (no photo kept), or go back to their Google photo, at once when Norless knows where it is, else from the next Google login. Where Google's photo is SHALL go with a deleted account. Norless SHALL keep each photo as a 256-pixel square JPEG and serve it itself, so that no browser contacts Google to show it; a replaced photo SHALL be deleted, and so SHALL a deleted account's. A device logged in from a member's phone (a laptop or a guest musician) SHALL NOT change the member's photo. Avatars SHALL show the photo wherever they show: a song's creator and last editor, a playlist's other viewers, who is online, and the account button.

#### Scenario: Who added this song to the playlist
- **WHEN** a member selects an entry in today's playlist
- **THEN** "Added by" and the name of the member who added it show with its slides

#### Scenario: Visitor sees no names
- **WHEN** a visitor who isn't logged in opens the same playlist
- **THEN** no avatars or names are shown

#### Scenario: Google photo
- **WHEN** Ana logs in with Google for the first time
- **THEN** her Google photo is copied into Norless and shows as her avatar on the songs she edits, among who is online, and on her account button

#### Scenario: Initials instead
- **WHEN** Ana chooses "Use my initials" on My account and later logs in with Google again
- **THEN** her photo is deleted from Norless, and her avatar stays her initials

#### Scenario: Own photo
- **WHEN** Ion uploads a photo on My account
- **THEN** it becomes his avatar as a 256-pixel square, and later Google logins don't replace it

#### Scenario: A new Google photo
- **WHEN** a member who uses their Google photo changes it in their Google account
- **THEN** Norless shows the new photo within a week, without a login

### Requirement: Presence

Members (not visitors) SHALL see who is currently online, each as their avatar (their photo, else their initials), without their name beside it: their name and their devices (phone or computer) SHALL show in a tooltip on hover, keyboard focus and a long-press. The person who made the last live change SHALL have a ring around their avatar, and the tooltip SHALL say so. The same row SHALL show in a playlist's title row, in Classic and on the Big screen.

#### Scenario: See who controls
- **WHEN** a musician on a phone and the operator on a laptop are online, and the musician pressed next
- **THEN** both show as their avatars, the musician's with a ring, and the musician's tooltip reads their name, "phone" and "last live change"

#### Scenario: Initials without a photo
- **WHEN** Maria, who has no photo, is online
- **THEN** her initials show among who is online, and hovering them shows "Maria … · phone"

### Requirement: First owner

A person with access to the server SHALL be able to invite the first owner from the command line, with an email address and roles. An imported account with that email SHALL be the one invited.

#### Scenario: Pavel becomes the owner
- **WHEN** Pavel runs the invite command with his email and the owner role on a freshly imported database
- **THEN** his imported account is invited as owner, and his first login makes him the owner
