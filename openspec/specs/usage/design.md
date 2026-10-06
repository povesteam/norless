# Usage design

Why usage is counted the way the spec says: Norless's own events in its own database, kept raw and read only by the app team.

## Decisions

- **Events, not counters**: every event keeps its time, so the app team can draw a timeline per feature or read one service in order. Counts alone didn't say enough. Nothing leaves Norless's server, and there is no cookie or third party.
- **A fixed list of features and ways**: `src/shared/usage.ts` names each feature and its ways (`via`), such as `live.go` by Go live, double-click, Enter, a part button or the song page. The server refuses unknown names, and the pages can list what nobody used. Ways tell button from keyboard, which server logs can't.
- **Unused means not used for 30 days, per way**: a way that needs a feature a community hasn't switched on (the part buttons need the laptop layouts) is skipped for it, so the community isn't told it ignores something it doesn't have.
- **Queued on the client, sent in batches**: events go every 5 seconds and when the page is hidden, by `fetch` with `keepalive` (it outlives the page and sends JSON), so measuring never slows a click. Each event says how long before the batch it happened, so its time doesn't depend on the device's clock. A tab left offline keeps at most a few batches.
- **The server fills in the rest**: the time, the community and the member, unless they switched counting off. At most 100 events per batch and 600 per address per minute, counted in memory, which is enough for one server.
- **The member's id is optional, and removable**: on by default, off in My account, and deleting an account clears the id from every event, as its songs stay without its name. Events are kept raw and for good, so new questions can be asked of old data.
- **Only the app team reads it**: the events show how people work, so owners and members don't see them. Beyond their pages and the CSV export, analysis is plain SQL on `usage_events`, from the database or a backup; the app has no analysis box.
- **A small table**: time, community, device type, layout when there is one, feature, and a `detail` JSON object of at most 8 short keys. Indexes are on `(feature, at)` and `(community_id, at)`.

## Rejected

- A self-hosted Umami or Plausible: one more service to run and back up.
- Server logs only: they miss keyboard versus button.
- Counts without events: no timelines, no single service.
- Showing usage to owners or members.
- An expiry for events.
