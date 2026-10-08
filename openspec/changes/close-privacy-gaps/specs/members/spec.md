## MODIFIED Requirements

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
| Create, rename, archive and restore playlists, change their dates, their entries and their host's words | | | ✓ | | ✓ |
| Create, edit and delete songs | | | | ✓ | ✓ |
| Edit chords, bar lines, `!` notes, notation blocks, tempo and the reference links of songs | | | ✓ | ✓ | ✓ |
| Change a song's key permanently, moving its chords | | | ✓ | ✓ | ✓ |
| Set a song's key for one service, on its playlist entry | | | ✓ | | ✓ |
| Choose who leads a song, on its playlist entry; see who leads | | | ✓ | | ✓ |
| See who leads each song | | ✓ | ✓ | ✓ | ✓ |
| Listen for the band's tempo on a device | | | ✓ | | ✓ |
| Record audio (guest musicians too) | | | ✓ | | ✓ |
| See the recordings and ask for access | | | ✓ | | ✓ |
| Listen to and download a recording | | | own, when granted, or once its maker's account is deleted | | own, when granted, or once its maker's account is deleted |
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
