# Songs design

Why the song library, its text format and its editing work as the spec says.

## Decisions

- **One song, a version per language**: shared fields (key, time signature, tags) live on the song, title and words on each version. Translations are linked by structure, not by a "RO title / UA title" naming habit.
- **One pure parser, in `src/shared`**: the server (search index, exports) and the browser (editor, slides, screens) run the same code. It keeps source line ranges, so a section can be edited in place.
- **Stored as words plus a chord track**: `song_versions.lyrics` holds the words, `songs.music` the track (`chord-editing` spec). When the server sends a song, it builds the old Norless text from both, and every view parses that text as before. Rewriting the views would change no screen.
- **Chord placement follows the old rule exactly**: a chord at column N goes before lyric character N, minus the lyric line's leading spaces. Only lines starting with `..` changed (they are lyrics).
- **Compatibility is tested, not trusted**: a local check runs the old prod parser over every imported song and compares slide by slide. Only the fixes listed in the spec may differ.
- **Typography is applied when shown, never stored**: editors see what they typed. The comma-below letters are needed in Romanian.
- **Formatting by a small allowlist tokenizer**: plain text plus `<i>`, `<b>`, `<u>` and `<span style="color: …">`, with a named color, `#rgb`, `#rrggbb` or `rgb()`. Everything else stays literal text. Existing skits use exactly this, and React escapes the rest.
- **Repeat marks show as "×2" and "×3"**: about 1,000 imported versions use them, and a slide is the unit of projection. A repeat that crosses slides can't be shown that way, so it stays as written and is flagged as a typo.
- **Section names get types**: so each screen can style a type (refrains in italics by default). The old data uses `R` far more than any other name.
- **The last slide ends with a grey `*`**: an emoji looked different on Apple, Windows, Android and TVs. On screens it is half the text's opacity, on pages the muted text color (4.5:1 contrast).
- **The editor is one text area per language, for the whole song**: part-by-part areas felt wrong. Two languages sit side by side on wide screens, with a tab per other language. The slide previews show how the text splits. The editor takes words only, since almost nobody used dot-lines; chords go to the Chords mode.
- **Saving a section carries its base text**: the server replaces the section when it still has that text at the index, or at exactly one other index (sections were added before it). Otherwise it answers with a conflict and both versions are shown.
- **One editor per song, held in memory**: two people editing different parts made merges the normal case. The whole song is held while the editor, the Chords mode or a section is open, on all the holder's devices, and freed on close, disconnect or 5 minutes without typing. The team holds songs too, since it edits chords. A server restart frees every hold and loses only unsaved drafts. Members still watch the holder's draft live.
- **Every save is a revision**: fields, words, track, links and credits, with who and when. Restoring is a save, so it can be undone. History shows a line diff (the `diff` library).
- **Delete is soft**: past playlists keep showing the song as deleted, so what was sung stays true.
- **Tags are lowercase without diacritics**: so "Crăciun!" and "craciun" are one tag. The chosen tags show above the box that adds one, so its suggestions never cover them.
- **Credits are three free fields on the song**: authors, copyright and an `https` source. They are not per language; a translator goes in Authors. A save that leaves one out keeps it, so an old open tab can't wipe them. Projectors don't show them.
- **Reference links are a list of up to 10, any `https` page**: not only YouTube. Several versions of a song are normal. They are links, never an embedded player: a player would set Google's cookies for everyone who opens a song page. They open in a new tab, without a referrer, and every reader sees them, visitors too, since they point to public recordings.
- **Titles are read from the link**: YouTube through oEmbed, other pages from `og:title`, `og:site_name` and `og:image`, else `<title>`. The title stays editable. A link with no readable title shows its site's address.
- **The link reader is guarded**: only public `https`, never this machine or a private network, checked on the address actually connected to and again after each redirect. At most 5 seconds, 512 KB of page and 5 MB of picture.
- **Link pictures are copied into Norless**: shrunk by the converter (ffmpeg) to a JPEG at most 320 pixels wide, read only as JPEG, PNG, WebP or GIF, and served from `/api/images/:id` with an immutable cache. Readers' browsers never contact the linked site. A picture whose link is never saved stays; it is a few kilobytes.
- **Links are part of the song's revisions**: History shows their changes and a restore brings them back. There is no reordering (remove and add again) and no re-reading of a renamed video's title.
- **Notes (`!`) can address a group**: `! drums: …`. Musicians views and stage monitors show them; projectors and the overlay never do, and exports leave them out unless asked.
- **The song page keeps one row of equal actions**: the rare ones (key, history, short link, exclude) sit in a ⋯ menu. On a laptop every language shows side by side, each part named as the live view names it.

## Rejected

- Sections as rows in the database: it breaks compatibility with the imported texts, and complicates reordering and repeats.
- An HTML sanitizer (DOMPurify): it needs a DOM on the server, and is far more than four tags need.
- Real-time co-editing of one section: one editor per song is enough.
- A lock per section with a 2-minute timeout, merging concurrent edits: merges became the common case instead of the rare one.
- Asking the holder to let go, or taking a song over before the timeout: wait, or ask them.
- Storing the old text format next to the words and the track: every song was stored twice. Old texts are taken apart once, on import, and the old parser's leading-space quirk for chords past a line's end went with it.
- A recording player in the song page: cookies and the privacy notice.
- Copyright shown on projected slides: not offered.
