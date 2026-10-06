// Creates a fresh database with the fixtures the end-to-end tests use.
import { rmSync } from "node:fs";
import { migrate, openDatabase } from "../src/server/db/db.js";
import { convertSongs } from "../src/server/songs/songs.js";
import { featureNames, isAdded, switchable } from "../src/shared/features.js";
import { indexSongs } from "../src/server/songs/search.js";

const path = process.env.DATABASE_PATH;
if (!path) throw new Error("Set DATABASE_PATH");
for (const suffix of ["", "-wal", "-shm"])
  rmSync(path + suffix, { force: true });

const db = openDatabase(path);
migrate(db);
db.exec(`
  INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
    ('c', 'unu-unu', 'Unu-Unu', '["ro","uk"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01'),
    ('c-new', 'biserica-noua', 'Biserica Nouă', '["ro"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01');
`);
db.exec(`
  INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
    ('ana', 'Ana', 'ana@example.com', 'active', '2026-01-01', '2026-01-01'),
    ('ion', 'Ion', 'ion@example.com', 'imported', '2016-01-01', '2016-01-01'),
    ('maria', 'Maria', 'maria@example.com', 'active', '2026-01-01', '2026-01-01'),
    ('vasile', 'Vasile', 'vasile@example.com', 'imported', '2016-01-01', '2016-01-01'),
    ('petru', 'Petru', 'petru@example.com', 'imported', '2016-01-01', '2016-01-01'),
    ('ioana', 'Ioana', 'ioana@example.com', 'active', '2026-01-01', '2026-01-01'),
    -- Only the test that tries the laptop layouts, whose choice is the member's: others'
    -- pages would open in the layout it's on.
    ('sorin', 'Sorin', 'sorin@example.com', 'active', '2026-01-01', '2026-01-01');
  INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
    ('m-ana', 'c', 'ana', '["owner"]', 'active', '2026-01-01', '2026-01-01'),
    ('m-ion', 'c', 'ion', '[]', 'imported', '2016-01-01', '2016-01-01'),
    ('m-maria', 'c', 'maria', '["editor"]', 'active', '2026-01-01', '2026-01-01'),
    ('m-vasile', 'c', 'vasile', '[]', 'imported', '2016-01-01', '2016-01-01'),
    ('m-petru', 'c', 'petru', '[]', 'imported', '2016-01-01', '2016-01-01'),
    ('m-ioana', 'c', 'ioana', '["team"]', 'active', '2026-01-01', '2026-01-01'),
    ('m-sorin', 'c', 'sorin', '["team"]', 'active', '2026-01-01', '2026-01-01'),
    -- A community with no songs yet, for empty states.
    ('m-ana-new', 'c-new', 'ana', '["owner"]', 'active', '2026-01-01', '2026-01-01');
`);

const song = db.prepare(
  "INSERT INTO songs (id, community_id, key_signature, time_signature, tags, created_at, updated_at) VALUES (?, 'c', ?, ?, ?, '2026-01-01', '2026-01-01')",
);
const version = db.prepare(
  "INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at) VALUES (?, 'c', ?, ?, ?, ?, ?, ?)",
);
song.run("grace", "G", "3/4", '["har"]');
version.run(
  "grace-ro",
  "grace",
  "ro",
  "Har minunat",
  [
    "1:",
    ".G      C",
    "Amazing grace how sweet",
    "",
    "R:",
    "! unison",
    "Slavă <i>ţie</i> <script>alert(1)</script>",
    "",
    "R",
    "",
    "Amin *",
  ].join("\n"),
  "2026-01-01",
  "2026-01-01",
);
version.run(
  "grace-uk",
  "grace",
  "uk",
  "Дивна благодать",
  "Слава Тобі",
  "2026-01-02",
  "2026-01-02",
);

song.run("isus", "D", "4/4", "[]");
version.run(
  "isus-ro",
  "isus",
  "ro",
  "Isus e Domn",
  "Cântăm cu bucurie\nHar peste har",
  "2026-01-01",
  "2026-01-01",
);
// A playlist no test changes, for tests that need a stable page with the search box.
db.exec(`
  INSERT INTO playlists (id, community_id, title, created_at, updated_at) VALUES
    ('steady', 'c', 'Listă de test', '2026-01-01', '2026-01-01');
  INSERT INTO entries (id, community_id, playlist_id, position, kind, song_id, created_at, updated_at) VALUES
    ('steady-1', 'c', 'steady', 1, 'song', 'grace', '2026-01-01', '2026-01-01');
`);

// A community of its own for logging laptops in from a phone, so its offers to the
// team's phones on this address don't reach the other tests' pages.
db.exec(`
  INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
    ('c-hall', 'sala-mica', 'Sala mică', '["ro"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01');
  INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
    ('dan', 'Dan', 'dan@example.com', 'active', '2026-01-01', '2026-01-01'),
    ('eva', 'Eva', 'eva@example.com', 'active', '2026-01-01', '2026-01-01');
  INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
    ('m-dan-hall', 'c-hall', 'dan', '["editor","team"]', 'active', '2026-01-01', '2026-01-01');
`);

// A community with chord detection switched on, which arrives off
// elsewhere: a song in C, live in its playlist.
db.exec(`
  INSERT INTO communities (id, slug, name, languages, time_zone, switches, created_at, updated_at) VALUES
    ('c-detect', 'acorduri', 'Acorduri', '["ro"]', 'Europe/Bucharest',
     '{"midiChords":true,"audioChords":true,"chordWheel":true,"liveChord":true}', '2026-01-01', '2026-01-01');
  INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
    ('m-ana-detect', 'c-detect', 'ana', '["owner"]', 'active', '2026-01-01', '2026-01-01'),
    ('m-ioana-detect', 'c-detect', 'ioana', '["team"]', 'active', '2026-01-01', '2026-01-01'),
    ('m-maria-detect', 'c-detect', 'maria', '[]', 'active', '2026-01-01', '2026-01-01');
  INSERT INTO songs (id, community_id, key_signature, time_signature, tags, created_at, updated_at) VALUES
    ('detect-song', 'c-detect', 'C', '4/4', '[]', '2026-01-01', '2026-01-01');
  INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at) VALUES
    ('detect-song-ro', 'c-detect', 'detect-song', 'ro', 'Cântați', '1:
Cântați Domnului', '2026-01-01', '2026-01-01');
  INSERT INTO playlists (id, community_id, title, created_at, updated_at) VALUES
    ('detect-sunday', 'c-detect', 'Duminică', '2026-01-01', '2026-01-01');
  INSERT INTO entries (id, community_id, playlist_id, position, kind, song_id, created_at, updated_at) VALUES
    ('detect-1', 'c-detect', 'detect-sunday', 1, 'song', 'detect-song', '2026-01-01', '2026-01-01');
`);

// A community with the team schedule switched on: a service every
// Sunday morning.
db.exec(`
  INSERT INTO communities (id, slug, name, languages, time_zone, switches, created_at, updated_at) VALUES
    ('c-team', 'echipa', 'Echipa', '["ro"]', 'Europe/Bucharest',
     '{"serviceRoles":true,"mySchedule":true,"signUps":true,"blockouts":true,"pushNotifications":true,"ledBy":true,"churchCalendar":true,"playlistNews":true}', '2026-01-01', '2026-01-01');
  INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
    ('m-ana-team', 'c-team', 'ana', '["owner"]', 'active', '2026-01-01', '2026-01-01'),
    ('m-ioana-team', 'c-team', 'ioana', '["team"]', 'active', '2026-01-01', '2026-01-01'),
    ('m-maria-team', 'c-team', 'maria', '[]', 'active', '2026-01-01', '2026-01-01');
  INSERT INTO schedule_events (id, community_id, name, type, kind, weekday, start_time, end_time, created_at, updated_at) VALUES
    ('team-sunday', 'c-team', 'Serviciu', 'service', 'recurring', 7, '10:00', '12:00', '2026-01-01', '2026-01-01');
`);

// Communities with only Classic's set: one that stays so, for Classic's flows, and one
// whose switches a test changes.
db.exec(`
  INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
    ('c-classic', 'clasic', 'Clasic', '["ro","uk"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01'),
    ('c-switches', 'functii', 'Funcții', '["ro","uk"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01');
  INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
    ('m-ana-classic', 'c-classic', 'ana', '["owner"]', 'active', '2026-01-01', '2026-01-01'),
    ('m-ioana-classic', 'c-classic', 'ioana', '["team"]', 'active', '2026-01-01', '2026-01-01'),
    ('m-maria-classic', 'c-classic', 'maria', '["editor","team"]', 'active', '2026-01-01', '2026-01-01'),
    ('m-ana-switches', 'c-switches', 'ana', '["owner"]', 'active', '2026-01-01', '2026-01-01'),
    ('m-ioana-switches', 'c-switches', 'ioana', '["team"]', 'active', '2026-01-01', '2026-01-01');
  INSERT INTO songs (id, community_id, key_signature, time_signature, tags, created_at, updated_at) VALUES
    ('lumina', 'c-classic', 'Re', '4/4', '["corect"]', '2026-01-01', '2026-01-01'),
    ('harul', 'c-classic', 'La', '', '[]', '2026-01-01', '2026-01-01'),
    ('pas', 'c-switches', 'G', '', '[]', '2026-01-01', '2026-01-01');
  INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at) VALUES
    ('lumina-ro', 'c-classic', 'lumina', 'ro', 'Lumina lumii', '1:
O stea se-aprinde peste sat

R:
Cântăm cu toții împreună

2:
E noapte, dar nu ne temem

R', '2026-01-01', '2026-01-01'),
    ('lumina-uk', 'c-classic', 'lumina', 'uk', 'Світло світу', '1:
Зоря засвітилась над селом

R:
Співаємо всі разом

2:
Ніч, але ми не боїмось

R', '2026-01-01', '2026-01-01'),
    ('harul-ro', 'c-classic', 'harul', 'ro', 'Doar harul Tău', '1:
Doar harul Tău

2:
M-a ridicat', '2026-01-01', '2026-01-01'),
    ('pas-ro', 'c-switches', 'pas', 'ro', 'Pas cu pas', '1:
Pas cu pas', '2026-01-01', '2026-01-01');
  INSERT INTO playlists (id, community_id, title, created_at, updated_at, created_by) VALUES
    ('classic-sunday', 'c-classic', 'Duminică', '2026-01-01', '2026-01-01', 'ioana'),
    ('switches-sunday', 'c-switches', 'Duminică', '2026-01-01', '2026-01-01', 'ioana');
  INSERT INTO entries (id, community_id, playlist_id, position, kind, song_id, text, created_by, created_at, updated_at) VALUES
    ('classic-1', 'c-classic', 'classic-sunday', 1, 'song', 'lumina', NULL, 'ioana', '2026-01-01', '2026-01-01'),
    ('classic-2', 'c-classic', 'classic-sunday', 2, 'divider', NULL, 'Rugăciune', 'ioana', '2026-01-01', '2026-01-01'),
    ('classic-3', 'c-classic', 'classic-sunday', 3, 'song', 'harul', NULL, 'ioana', '2026-01-01', '2026-01-01'),
    ('switches-1', 'c-switches', 'switches-sunday', 1, 'song', 'pas', NULL, 'ioana', '2026-01-01', '2026-01-01');
`);

// Last sung in a service 3 weeks ago; a later rehearsal doesn't count.
const daysAgo = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString();
const play = db.prepare(
  "INSERT INTO plays (id, community_id, song_id, mode, played_at, created_at, updated_at) VALUES (?, 'c', 'grace', ?, ?, '2026-01-01', '2026-01-01')",
);
play.run("p1", "service", daysAgo(21));
play.run("p2", "rehearsal", daysAgo(2));
// Isus e Domn: sung in 3 services, none in the last 6 months, so not played lately.
for (const [id, days] of [
  ["p3", 200],
  ["p4", 230],
  ["p5", 260],
] as const)
  db.prepare(
    "INSERT INTO plays (id, community_id, song_id, mode, played_at, created_at, updated_at) VALUES (?, 'c', 'isus', 'service', ?, '2026-01-01', '2026-01-01')",
  ).run(id, daysAgo(days));

// Classic's hints: Eva hasn't seen them; everyone else has, so they don't cover what
// the other tests click.
db.exec(`
  INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
    ('m-eva-classic', 'c-classic', 'eva', '["team"]', 'active', '2026-01-01', '2026-01-01');
  UPDATE users SET preferences = '{"hints":["goLive","search","keys","project","musician"]}'
    WHERE id <> 'eva';
`);

// A band of its own for the instrument layouts, whose live song no other test changes.
db.exec(`
  INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
    ('c-band', 'formatia', 'Formația', '["ro","uk"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01');
  INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
    ('radu', 'Radu', 'radu@example.com', 'active', '2026-01-01', '2026-01-01');
  INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
    ('m-radu-band', 'c-band', 'radu', '["team"]', 'active', '2026-01-01', '2026-01-01'),
    ('m-maria-band', 'c-band', 'maria', '["editor"]', 'active', '2026-01-01', '2026-01-01'),
    ('m-ana-band', 'c-band', 'ana', '["owner"]', 'active', '2026-01-01', '2026-01-01');
  UPDATE users SET preferences = json_set(preferences, '$.hints', json('["goLive","search","keys","project","musician"]')) WHERE id = 'radu';
`);

// Follow-along's own community, since its tests and the band's run at the same time.
db.exec(`
  INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
    ('c-follow', 'urmarim', 'Urmărim', '["ro","uk"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01');
  INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
    ('m-radu-follow', 'c-follow', 'radu', '["team"]', 'active', '2026-01-01', '2026-01-01'),
    ('m-maria-follow', 'c-follow', 'maria', '["editor"]', 'active', '2026-01-01', '2026-01-01'),
    ('m-ana-follow', 'c-follow', 'ana', '["owner"]', 'active', '2026-01-01', '2026-01-01');
`);

// Recordings' own community: its tests change the live state while recording.
db.exec(`
  INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
    ('c-rec', 'repetitii', 'Repetiții', '["ro"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01');
  INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
    ('m-radu-rec', 'c-rec', 'radu', '["team"]', 'active', '2026-01-01', '2026-01-01'),
    ('m-ioana-rec', 'c-rec', 'ioana', '["team"]', 'active', '2026-01-01', '2026-01-01'),
    ('m-maria-rec', 'c-rec', 'maria', '["editor"]', 'active', '2026-01-01', '2026-01-01');
`);

// The tempo check's own community, whose live state no other test changes.
db.exec(`
  INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
    ('c-tempo', 'tempo', 'Tempo', '["ro"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01');
  INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
    ('m-radu-tempo', 'c-tempo', 'radu', '["team"]', 'active', '2026-01-01', '2026-01-01'),
    ('m-maria-tempo', 'c-tempo', 'maria', '["editor"]', 'active', '2026-01-01', '2026-01-01');
`);

// Notation's own community, whose live state no other test changes.
db.exec(`
  INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
    ('c-notes', 'notatie', 'Notație', '["ro"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01');
  INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
    ('m-radu-notes', 'c-notes', 'radu', '["team"]', 'active', '2026-01-01', '2026-01-01'),
    ('m-maria-notes', 'c-notes', 'maria', '["editor"]', 'active', '2026-01-01', '2026-01-01');
`);

// Slides from files' own community, in RO and UA: a playlist with a
// song, before which slides are added.
db.exec(`
  INSERT INTO communities (id, slug, name, languages, time_zone, switches, created_at, updated_at) VALUES
    ('c-slides', 'diapozitive', 'Diapozitive', '["ro","uk"]', 'Europe/Bucharest', '{"fileSlides":true}', '2026-01-01', '2026-01-01');
  INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
    ('m-ana-slides', 'c-slides', 'ana', '["owner"]', 'active', '2026-01-01', '2026-01-01'),
    ('m-ioana-slides', 'c-slides', 'ioana', '["team"]', 'active', '2026-01-01', '2026-01-01');
  INSERT INTO songs (id, community_id, tags, created_at, updated_at) VALUES
    ('slides-song', 'c-slides', '[]', '2026-01-01', '2026-01-01');
  INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at) VALUES
    ('slides-song-ro', 'c-slides', 'slides-song', 'ro', 'Cântec după anunțuri', 'Primul vers', '2026-01-01', '2026-01-01');
  INSERT INTO playlists (id, community_id, title, created_at, updated_at) VALUES
    ('slides-sunday', 'c-slides', 'Duminică', '2026-01-01', '2026-01-01');
  INSERT INTO entries (id, community_id, playlist_id, position, kind, song_id, created_at, updated_at) VALUES
    ('slides-song-entry', 'c-slides', 'slides-sunday', 1, 'song', 'slides-song', '2026-01-01', '2026-01-01');
`);

// Big screen's own community, in RO and UA, with two songs live
// in turn.
db.exec(`
  INSERT INTO communities (id, slug, name, languages, time_zone, switches, created_at, updated_at) VALUES
    ('c-big', 'ecran-mare', 'Ecran mare', '["ro","uk"]', 'Europe/Bucharest', '{"bigScreen":true,"welcome":true}', '2026-01-01', '2026-01-01');
  INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
    ('m-ana-big', 'c-big', 'ana', '["owner"]', 'active', '2026-01-01', '2026-01-01'),
    ('m-ioana-big', 'c-big', 'ioana', '["team"]', 'active', '2026-01-01', '2026-01-01'),
    ('m-radu-big', 'c-big', 'radu', '["team"]', 'active', '2026-01-01', '2026-01-01');
  INSERT INTO songs (id, community_id, key_signature, tags, created_at, updated_at) VALUES
    ('big-1', 'c-big', 'G', '[]', '2026-01-01', '2026-01-01'),
    ('big-2', 'c-big', 'D', '[]', '2026-01-01', '2026-01-01');
  INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at) VALUES
    ('big-1-ro', 'c-big', 'big-1', 'ro', 'Primul cântec', '1:
Unu doi

R:
Trei patru', '2026-01-01', '2026-01-01'),
    ('big-2-ro', 'c-big', 'big-2', 'ro', 'Al doilea cântec', 'Cinci șase', '2026-01-01', '2026-01-01');
  INSERT INTO playlists (id, community_id, title, created_at, updated_at) VALUES
    ('big-sunday', 'c-big', 'Duminică', '2026-01-01', '2026-01-01');
  INSERT INTO entries (id, community_id, playlist_id, position, kind, song_id, created_at, updated_at) VALUES
    ('big-e1', 'c-big', 'big-sunday', 1, 'song', 'big-1', '2026-01-01', '2026-01-01'),
    ('big-e2', 'c-big', 'big-sunday', 2, 'song', 'big-2', '2026-01-01', '2026-01-01');
`);

// Every feature on but those added later, which a community switches on itself; the
// Classic communities keep only Classic's set.
db.prepare(
  "UPDATE communities SET switches = json_patch(?, switches) WHERE id NOT IN ('c-hall', 'c-classic', 'c-switches')",
).run(
  JSON.stringify(
    Object.fromEntries(
      featureNames
        .filter((name) => switchable(name) && !isAdded(name))
        .map((name) => [name, true]),
    ),
  ),
);

// Unu-Unu's team adds between rows, switched on by its owners.
db.exec(
  "UPDATE communities SET switches = json_set(switches, '$.insertBetween', json('true')) WHERE id = 'c'",
);

// Chords written in the texts go to the track, as after an import, and the songs
// to the search index.
convertSongs(db);
indexSongs(db);
db.close();
