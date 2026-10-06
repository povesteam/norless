# Host view design

Why the host's words and their view work as the spec says.

## Decisions

- **Words on any entry**: the host speaks before a sermon or an offering as much as before a song, and the notes should follow when the order changes.
- **One plain text per community language**, at most 2,000 characters, stored as JSON on the entry (`entries.host_words`, `{ "ro": "…", "uk": "…" }`, NULL when none). A bilingual service needs both texts side by side; empty ones are dropped.
- **Team writes, members read**: whoever changes a playlist writes them, from the entry's actions. They are the team's notes, so the view is for members only.
- **Kept off screens, the stage monitor, prints and exports**: they are the host's own notes, not part of what the room sees.
- **The view follows the live entry**: its title and words large, then "Next:" with the next entry's title and words, smaller, so the host reads what to say about the live entry and prepares the next.
- **Language switch**: one language or all, one under the other; it starts on the member's interface language when the community has it.

## Rejected

- A host role in the schedule: it belongs with the team's service roles.
