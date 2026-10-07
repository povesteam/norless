# Playlists design

Why playlists work as the spec says: one shared list per service, edited live from every device.

## Decisions

- **One playlist for all languages**: its entries point to songs, and each viewer reads the titles in their own language, so nothing needs keeping in step.
- **Permalinks, and a home that lands on one**: `/<community>/playlists/<id>`. The home replaces its URL with the link of the playlist it opens, so the address bar is always something to share.
- **Members land on the next service, visitors on the last one held**: between services the team is still changing next Sunday's songs, and a visitor looks for the ones they heard. A started service counts as held, so one under way comes first by itself; the walk goes back 60 days, as the next one looks forward 60, and past that the newest playlist is as good a guess. The list response carries both (`next` and `held`) and the home picks once it knows who this is, so a member never flashes past a visitor's playlist.
- **The date is data, the title is optional**: a playlist's date is its service date, else the local day it was created in the community's time zone. It is formatted per viewer ("4 octombrie", "4 жовтня"), with the year only when it isn't this one. A stored date-title would freeze one language. Renaming stores a real title for everyone; saving it empty makes the playlist untitled again. Rename starts from an empty field with the date as placeholder, since renaming is rare. The ☰ filter also matches the shown date. Server texts (exports, chapters, news) format the date in the recipient's language, else the community's first.
- **Several playlists on one day are fine**: there are two services some days, so the date isn't unique.
- **Archive, not delete**: `archived_at` hides a playlist from lists but keeps its link readable and lets it still go live. It asks nothing, because Restore undoes it. The server refuses entry changes and renames while archived.
- **Order is a REAL `position`**: a new entry goes at max + 1, a move sets the halfway point between its new neighbors, so one move rewrites one row. The server renumbers the playlist 1, 2, 3 when two neighbors get closer than 1e-9.
- **The server places an inserted entry**: adding takes `after` (an entry id, or null for the top), so it lands in one change and other devices never see it at the end first.
- **Whole-playlist reload on change**: one REST route per change, then the server publishes `playlist:<id>` and clients fetch the playlist again. Playlists have tens of entries, so this is cheap and keeps every device consistent. Editing is online only. Anyone may follow the topic, since playlists are public.
- **Activity is its own members-only topic**: `activity:<playlist id>`, like presence. Drag messages are sent when the drop target changes, not on every pointer move. The live server's `onUnsubscribe` hook clears a person when the playlist closes, not only when the tab does.
- **React Aria's `GridList` with `useDragAndDrop`**: mouse, long-press on touch and keyboard drag come from one library. Alt+Up and Alt+Down move the selected entry one place, like moving a line in a code editor.
- **Rows make room while dragging**: the drop indicator is a gap as tall as the dragged entry, measured when the drag starts, with a 150 ms transition. The dragged entry stays in place, half transparent: collapsing it would move every row under the pointer and make the target flicker.
- **Glide with FLIP and the Web Animations API**: rows reordered by someone else move 200 ms ease-out; no library. An inner element glides, not the row, because React Aria finds the row above and drop targets by where rows are drawn, and a translated row broke that. A reorder within 1.5 s of a change made on this device snaps, so a click or key right after lands where it's aimed. Reduced motion turns gliding off.
- **No buttons on rows**: handles and a ✕ on every row were too prominent on phones. A right-click, the context menu key or Shift+F10 opens the actions with a mouse; touch screens get a "⋯" button with every action. A long press can't open the menu, because it starts the drag.
- **Remove is a soft delete with 5 seconds of Undo**: only the person who removed sees it. Delete and Backspace both remove the selected entry (a Mac's delete key sends Backspace), never while a text field is focused.
- **Fixed row heights** (72 px for a song, 48 px for the rest): nothing a row shows makes it taller, so the list never jumps.
- **Selection is local state**: each device has its own selected entry, not stored, so two operators don't fight over it.
- **The server judges, the device guesses first**: add, move and remove show at once; a refusal reloads the playlist as the server has it, with "That didn't go through". An added entry shows at the end with what the search result knew (title, key) until the reload.
- **Search box on a playlist**: for the team, Enter adds the selected result at the end and selects it; a typed query can become a divider. For a new song, the editor opens with the query as title and "Save and add to playlist" creates and adds, so closing leaves nothing behind. Text slides have a button, since their text is longer than a query.
- **Text slides use a small built-in Markdown subset** (headings, paragraphs, bold, italic, lists): no dependency. Planned minutes are whole numbers from 1 to 240, typed in the forms `parseMinutes` accepts, with 1:30 meaning an hour and a half.
- **Insert between rows has its own feature switch**: on a laptop its + shows after the mouse rests 300 ms between two rows, so passing over the list doesn't flicker it, and it sits in the rows' column of icons, without a line across the row. "Song" waits for one pick, and the search box says where it will land, with an × to cancel. It shows only for people who change entries, and only between rows, since the end already has the search box. Touch screens and the right-click menu offer the same "above" items.
- **Progress is position, for everyone**: everything above the live entry is muted, skipped entries too, with the text's muted color (it keeps 4.5:1). While the screens are blank the live entry is done as well, and a thin line under it marks where the service is; while it shows, its frame is enough. No checkmarks, and no clocks in the rows: they took too much space. Dividers keep their planned minutes, and the header keeps the estimated end.
- **Bible links use the community's version per language**: stored in `communities.bible_versions`, defaults Cornilescu, Ogienko and King James, or any bible.com number. The link falls back to the first community language.
- **Slides are PDFs and pictures, made ready once on the server**: the converter service (apart from the app and its data) draws each page with `pdftoppm` as JPEG quality 85 at 3840 px (screens), 1280 px (phones, stage views) and 320 px (thumbnails). Pictures are fitted the same way, never enlarged. Views use `srcset`; pages are served at `/api/slide-pages/:id/:page/:width`, cached for a year, because a page never changes (a new file for the same entry makes new pages).
- **Upload answers at once, progress follows**: the entry shows "Preparing" while the app asks the converter for 20 pages at a time and saves them as they come, which is the progress the entry shows. One multipart request per drop, read with `Response.formData()`.
- **Slide files keep the uploaded file**: `slides/<file id>/` holds it beside its pages, for Retry and download. Files stay while their entry exists, also in archived playlists, and go 30 days after a removed entry's removal.
- **A file per language replaces the main file on that language's screens**: a shorter file shows its last page; a screen with two languages shows its first language's file once.
- **Fonts for PDFs that don't embed theirs**: Liberation (metric-compatible with Arial and Times New Roman) and DejaVu.
- **The playlists list shows the name, the songs and who made it**: "Created …" repeated the service date most names already carry.

## Rejected

- A playlist per language: the copies had to be kept in step by hand.
- Showing visitors the coming service from an hour before it: until it starts, the team may still change its songs.
- The server answering by who asks: `next` also marks the list and opens new practice rooms, so every response needs it.
- PowerPoint, OpenDocument and Keynote conversion with LibreOffice: it lost fonts, animations and videos, added a few hundred MB of image and memory spikes per file on a small server, and every presentation app exports a PDF that looks as designed. No small, stable converter exists (pre-1.0 libraries, commercial ones, wrappers around LibreOffice). A dropped presentation adds nothing and says where each app exports a PDF; the file picker still offers presentations, so picking one gets that message, not a greyed-out file.
- A library of files reused across playlists, and Google Slides links: an upload per entry is enough; reuse by uploading again.
- Swiping a row for its actions: several rows stayed open at once, React Aria's row swallowed the taps that should close one, and a swipe ending outside the row never finished.
- A ⋯ on the selected row only, an "Edit list" mode, a long-press menu: harder to find, or clashing with the drag.
- A drag handle on every row: too prominent, mostly on phones.
- A drag library of our own: React Aria already covers mouse, touch and keyboard.
- Undo for archiving, or a trash for owners: Restore is enough.
- A confirm before creating a new song from the search box: closing the editor leaves nothing behind.
