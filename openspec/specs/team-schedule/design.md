# Team schedule design

Why the roles, slots, notifications, song leaders, calendar and playlist news work as the spec says.

## Decisions

- **Service roles are apart from permission roles**: the team role builds the schedule and owners edit the roles, so scheduling adds no new permission. Members read the schedule and answer for themselves.
- **Instrument roles mark their players by themselves**: the musician profile already says who plays guitar, so nobody is entered twice.
- **"Leads the songs" is a mark on a role**, not a kind of role, so owners can give it to any role. The starter worship lead has it.
- **The starter list is written in the community's first language** when the roles are first read, and owners edit it from there.
- **Reading never saves**: a date shows its weekly event's template until the team (or a sign-up) changes it. Then its slots are saved and the template no longer reaches it. The first to change a date is its builder, who is told of its declines, sign-ups and offers.
- **Slots are known by role and place** (`roleId:0`), the same before and after saving, so the routes don't care whether a date was saved. A one-off event starts without slots, and 8 weeks ahead is shown.
- **A decline lives in what the builder was told**, not on the slot: the slot is simply open again, with statuses open, asked, accepted and offered.
- **Away is a warning, not a block**: the team may still ask someone who marked a day away. Two roles or more in one date are allowed, each place naming the person's others ("Also Chitară and Tobe"), which says how many and which.
- **The people picker is a select**: those marked for the role come first, with "(away)" beside those away that day. A combobox lost its list when the schedule reloaded after a change.
- **Devices don't take slots**: the community's laptop and guests' phones are not people.
- **A deleted account** loses its away days, notifications, push subscriptions and role markings, and its slots open again.
- **Destructive actions sit in a row's ⋯ menu** with a confirmation, so a slip doesn't hit them. The away days' and roles' trash buttons stay, since each is a list of one's own entries.
- **Times are on the 24-hour clock** everywhere, the server's notification text included. A schedule's time of day is local to the community's time zone, and push texts say the time in that zone.
- **Notifications are rows**, shown in the app and pushed. An `about` key makes each go once: a slot's reminder, an open role on a date to one person. A decline's open notice and a playlist's "ready" carry their time, so they can go again.
- **One minute-by-minute job** sends reminders, open-slot notices and changed-song news, so saving a slot or a song needn't know about notifications.
- **Push texts are in the community's first language**, since the server doesn't know a device's language; the app shows them in the reader's.
- **Push uses web-push** (MPL-2.0) with the server's own keys. Without keys push stays off, people are told in the app and the Notifications page says so. The service worker shows the notification and opens what it's about on a tap. Subscriptions the push service says are gone are deleted.
- **How each push went is kept** on its notification: devices sent, failed or stopped, or why none. The Notifications page shows it in a muted line, so a member sees why their phone stayed quiet. A failed push is logged on the server with the push service's host and answer, never the device's address (it is a secret URL).
- **A playlist knows its service**: the next service's playlist Norless makes gets it when made. A playlist made by hand plans the next service no playlist plans yet, so "Sunday" made on Tuesday is Sunday's. There is no field to change it; when it is wrong, choosing a leader per song still works.
- **Who leads a song**: the first person in a leading slot, assigned or accepted, unless the team chose another person from that service's leading or vocal slots. A play keeps the chosen person, else the lead, when it is recorded.
- **Names go to members only**: a playlist's leaders and the live view's leader travel on the members' topic, as for who changed the slide. The playlist reloads when slots or roles change, so a new lead shows at once.
- **The calendar is only a list**: events are information, not services, so the calendar never changes the schedule, the live mode or the slots.
- **ical.js** (MPL-2.0) parses the calendar. It expands repeating events, keeps cancelled dates out and relates moved dates through the series' own ids. A long-running series is walked from its start, at most 5,000 dates.
- **The calendar is read on a visit**: a member's visit reads it when the last read is over an hour old, so communities nobody opens cost nothing. It goes through `fetchPublic` (public https addresses only, 4 MB at most, 5 seconds), and the read is kept in memory, so a restart reads again on the first visit. A failed read keeps the events read before and says so.
- **The secret address stays with owners**: it is stored on the community but left out of the data every page loads, and only owners get it from the calendar's own route.
- **Calendar times**: whole-day events stay dates ("All day") whatever the server's time zone, the rest show in the device's time zone. 8 weeks ahead and at most 30 events, like the team schedule.
- **The calendar sits where nothing moves when it loads**: on My schedule after one's own slots, and at the end of the team schedule.
- **"Ready" is said, not guessed**: a playlist is built bit by bit, so Norless can't know when it is ready. The team says so from the playlist's actions, with a dialog that explains who is told, and can say it again. The people told are those in its service's slots, assigned or accepted, except the one telling.
- **Changed songs are told only after "ready"**: while the team is building, changes are expected. Afterwards, a song's text, chords or key, a key for the service, or a song added is told once to the people in instrument or leading slots, singers included since a key matters to them.
- **A bell for what's new**: in every bar of a community (the laptop's header, the phone's bar, Classic's), for members while service roles are on, always there so nothing moves, with the count of new ones (9+ past nine). It opens the Notifications page, the same on every device: newest first, bold until seen there, each leading where its push does (a playlist's news to the playlist, the rest to My schedule), with how its push went and this device's switch. My schedule links to it; the line at the top keeps the next place and Accept. What was new showed only on My schedule before.
- **Why Take or Offer, in a tooltip**: the labels stay; hover or a long press says "You're among the people for Tobe: it's yours at once" or "The team chooses the people for Chitară: it confirms your offer". The interface may be rethought once the team uses it.
- **Photos beside names**: in the slots, the choice of who's in one, the people marked for a role and their choice, and the choice of who leads a song, the photo hidden from screen readers, which read the name.
- **The templates say where the services are set**: the weekly services and rehearsals are the schedule in Settings, a link for owners, a sentence for the rest of the team.

## Rejected

- **A calendar feed of one's own schedule**: My schedule and push are enough.
- **Email notifications**: push and the app are enough. A phone without push is told in the app, and My schedule explains how to install Norless.
- **Events from the church calendar becoming services, rehearsals or slots**: a list is all it gives.
- **Visitors seeing the schedule or the calendar**: members only.
- **Rehearsal-only roles**: every role can be used for any event.
- **A trash button on every row**: destructive actions move into the row's menu.
- **A statistics view by leader**: the data is kept, a view comes when asked for.
- A count ("3 roles that day") or an icon with ×3: they don't say which roles.
- One line above the schedule explaining Take and Offer, or one "Sign up" for both.
- A popover under the bell on a laptop, the top line always shown, or a dot on the photo: one page on every device is simpler.
- The app's What's new bubble merged into the bell: kept apart until both are used.
