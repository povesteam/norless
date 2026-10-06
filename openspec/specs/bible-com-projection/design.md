# bible.com projection design

Why Norless talks to the "Project verses from bible.com" extension (by Nicolae Matei, github.com/nmatei/chrome-bible-utilities) the way the spec says.

## Decisions

- **Optional, with Norless's own screens as the default**: the extension's windows are the projector only in setups that already use them. Without the extension, nothing in Norless breaks; the live bar says "unavailable".
- **Sent from the operator's browser**: the extension lives in the operator's browser, so the live bar of the team member's device sends each change with `chrome.runtime.sendMessage` to the extension's ID. The server can't reach it. The extension must list Norless's address in its `externally_connectable`; until it does, Norless sees it as unavailable.
- **Mapping is per device**: each language goes to window 1, window 2, all enabled windows or none, kept in browser storage and defaulting to none. The extension is installed on one laptop, not on the community. A window mapped by two languages takes the first.
- **Detection by `help`, windows by `status`**: status 200 on `help` means the extension is there and accepts Norless. `status` is optional on the extension's side and answers `{ status: 200, windows: [1, 2] }` with the open windows; without it Norless says only "connected". Where a language is mapped and the extension isn't connected, the bar links to the store.
- **HTML in the format the extension fits**: `updateText` goes with `markdown: false` and a header `h1.reference` ("#2/5 · key · title", in that window's language), a `div.singlelines` with one `p` per line, refrains in italics and ×N after repeated lines. The next slide's first line and the final mark use inline opacity, since the extension's own classes for them aren't known. The final mark is a light grey `*`.
- **Everything escaped**: every character of song text is escaped as an entity, because it is injected as HTML into another extension's page.
- **A shorter translation shows its last slide**: a version with fewer slides than the live one stays on its own last slide.
- **Text slides as Markdown, Bible references send nothing**: a text slide goes with `markdown: true`. A Bible reference entry sends nothing, so the verses the operator projects from bible.com stay on screen and Norless never overwrites the Bible.
- **Pages by frame**: a start or end page goes as `updateFrame` with its URL to every mapped window. Only `https` URLs are accepted in the settings. A window that showed a page gets an empty frame before the next text, so the page doesn't stay over the song.
- **Errors reach the operator**: any status other than 200 is shown; 404 says to open the projection window first. A 404 from a window that is only part of "all windows" isn't reported, since not every window needs to be open.
- **Verses come back over a connection**: the extension only takes messages, so Norless opens a connection with `chrome.runtime.connect(EXTENSION_ID, { name: "norless" })` and listens. The extension posts `{ action: "verse", payload: { index, reference, text } }` when a window projects a verse, and `reference: null` when it clears that window. This needs `onConnectExternal` in the extension.
- **A verse is a live change**: the team device that has the extension and Norless open sends it like any live change, so every projector, stage monitor and phone following shows it in its language, over what's live. The server refuses it from anyone but the team and in languages the community doesn't have.
- **Verses from two windows within 10 seconds are one verse in two languages**: the operator projects Romanian in window 1 and Ukrainian in window 2 one after the other, and Norless can't compare references in two languages. A language whose window sent nothing shows the other's verse.
- **A verse covers, and leaves the way it came**: it stays over what's live until Next, Previous, another entry, blank, or Back to the playlist in the live bar, which says "Verse from bible.com" with its reference. Next and Previous only take it down, back to the slide it covered, so the band keeps its place. During a timed entry such as the sermon the stage monitor keeps its countdown.
- **The bible.com windows keep what they show**: while a verse is live Norless sends them nothing, since that would overwrite the verse the operator just picked there.

## Rejected

- Mirroring one app's clicks into another by matching song titles (the old extension's sync): fragile and needing two operators. One live state per room drives every language.
- Webhooks for verses: a connection the extension already can open is simpler.
- Bible text inside Norless's own data: the extension handles the Bible; Norless shows only what it posts.
- Sending to the extension from the server: it isn't reachable from there.
