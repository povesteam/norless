// A fresh database of demo data for the screenshots, safe for a public manual: hymns in
// the public domain (English ones from the 18th and 19th centuries, and the ancient
// prayers and hymns Romanian churches sing), with made-up people. Chords are made up.
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { migrate, openDatabase } from "../../src/server/db/db.js";
import { convertSongs } from "../../src/server/songs/songs.js";
import { indexSongs } from "../../src/server/songs/search.js";

const path = process.env.DATABASE_PATH;
if (!path) throw new Error("Set DATABASE_PATH");
for (const suffix of ["", "-wal", "-shm"])
  rmSync(path + suffix, { force: true });

const db = openDatabase(path);
migrate(db);
const at = "2026-09-01T08:00:00.000Z";
db.exec(`
  INSERT INTO communities (id, slug, name, languages, time_zone, theme, created_at, updated_at) VALUES
    ('c', 'example', 'Example Church', '["ro","en"]', 'Europe/Bucharest',
     '{"color":"#2d5a8a","tint":"#f4f7fb"}', '${at}', '${at}');
  INSERT INTO rooms (id, community_id, name, created_at, updated_at) VALUES
    ('room', 'c', 'Main hall', '${at}', '${at}');
  INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
    ('ana', 'Ana Popescu', 'ana@example.org', 'active', '${at}', '${at}'),
    ('ioana', 'Ioana Marin', 'ioana@example.org', 'active', '${at}', '${at}'),
    ('mihai', 'Mihai Ionescu', 'mihai@example.org', 'active', '${at}', '${at}'),
    ('andrei', 'Andrei Lungu', 'andrei@example.org', 'active', '${at}', '${at}'),
    ('elena', 'Elena Rusu', 'elena@example.org', 'active', '${at}', '${at}');
  INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
    ('m-ana', 'c', 'ana', '["owner"]', 'active', '${at}', '${at}'),
    ('m-ioana', 'c', 'ioana', '["team"]', 'active', '${at}', '${at}'),
    ('m-mihai', 'c', 'mihai', '["editor","team"]', 'active', '${at}', '${at}'),
    ('m-andrei', 'c', 'andrei', '["team"]', 'active', '${at}', '${at}'),
    ('m-elena', 'c', 'elena', '[]', 'active', '${at}', '${at}');
  -- Until the demo's last Sunday, so the server doesn't make the next one's playlist.
  INSERT INTO schedule_events (id, community_id, name, type, kind, weekday, start_time, end_time, last_date, created_at, updated_at) VALUES
    ('service', 'c', 'Sunday service', 'service', 'recurring', 7, '10:00', '12:00', '2026-09-27', '${at}', '${at}'),
    -- A weekly rehearsal with no end, for the team schedule's dates.
    ('rehearsal', 'c', 'Band rehearsal', 'rehearsal', 'recurring', 4, '19:00', '21:00', NULL, '${at}', '${at}');
  INSERT INTO pages (id, community_id, name, url, position, created_at, updated_at) VALUES
    ('start', 'c', 'Welcome', 'https://welcome.example.invalid/', 1, '${at}', '${at}'),
    ('end', 'c', 'Goodbye', 'https://goodbye.example.invalid/', 2, '${at}', '${at}');
  INSERT INTO screens (id, community_id, room_id, name, type, languages, layout, settings, secret, position, created_at, updated_at) VALUES
    ('s-ro', 'c', 'room', 'Projector RO', 'projector', '["ro"]', NULL, '{"background":"#14213d"}', 'demo-projector-ro', 1, '${at}', '${at}'),
    ('s-en', 'c', 'room', 'Projector EN', 'projector', '["en"]', NULL, '{"background":"#14213d"}', 'demo-projector-en', 2, '${at}', '${at}'),
    ('s-band', 'c', 'room', 'Instruments', 'musicians', '["en"]', NULL, '{}', 'demo-musicians', 3, '${at}', '${at}'),
    ('s-stage', 'c', 'room', 'Stage monitor', 'stage', '["en"]', NULL, '{"clock":true}', 'demo-stage', 4, '${at}', '${at}'),
    ('s-live', 'c', 'room', 'Broadcast', 'overlay', '["ro","en"]', NULL, '{"overlayBackground":"green"}', 'demo-broadcast', 5, '${at}', '${at}');
`);

const song = db.prepare(
  `INSERT INTO songs (id, community_id, key_signature, time_signature, tags, created_by, updated_by, created_at, updated_at)
   VALUES (?, 'c', ?, ?, ?, 'mihai', 'mihai', '${at}', '${at}')`,
);
const version = db.prepare(
  `INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at)
   VALUES (?, 'c', ?, ?, ?, ?, '${at}', '${at}')`,
);
const lines = (...l: string[]) => l.join("\n");

// John Newton, 1779.
song.run("grace", "G", "3/4", '["grace"]');
version.run(
  "grace-en",
  "grace",
  "en",
  "Amazing Grace",
  lines(
    "1:",
    // An intro in bars, C holding two of its bar's three beats.
    ".| G | G7 | C_ G | D |",
    ".G           G7       C        G",
    "Amazing grace! How sweet the sound",
    ".G           Em       D",
    "That saved a wretch like me!",
    ".G           G7         C        G",
    "I once was lost, but now am found;",
    ".G         D        G",
    "Was blind, but now I see.",
    "",
    "2:",
    ".G           G7       C        G",
    "'Twas grace that taught my heart to fear,",
    ".G           Em       D",
    "And grace my fears relieved;",
    ".G           G7         C        G",
    "How precious did that grace appear",
    ".G         D        G",
    "The hour I first believed!",
    "",
    "3:",
    ".G           G7       C        G",
    "Through many dangers, toils and snares,",
    ".G           Em       D",
    "I have already come;",
    ".G           G7         C        G",
    "'Tis grace hath brought me safe thus far,",
    ".G         D        G",
    "And grace will lead me home.",
    "",
    "4:",
    "! all, slower",
    ".G           G7       C        G",
    "The Lord has promised good to me,",
    ".G           Em       D",
    "His word my hope secures;",
    ".G           G7         C        G",
    "He will my shield and portion be",
    ".G         D        G",
    "As long as life endures.",
  ),
);

// Reginald Heber, 1826.
song.run("holy", "D", "4/4", '["praise"]');
version.run(
  "holy-en",
  "holy",
  "en",
  "Holy, Holy, Holy",
  lines(
    "1:",
    "Holy, holy, holy! Lord God Almighty!",
    "Early in the morning our song shall rise to Thee;",
    "Holy, holy, holy! merciful and mighty!",
    "God in three Persons, blessed Trinity!",
    "",
    "2:",
    "Holy, holy, holy! all the saints adore Thee,",
    "Casting down their golden crowns around the glassy sea;",
    "Cherubim and seraphim falling down before Thee,",
    "Which wert, and art, and evermore shalt be.",
  ),
);

// Horatio Spafford, 1873.
song.run("well", "C", "4/4", '["peace"]');
version.run(
  "well-en",
  "well",
  "en",
  "It Is Well with My Soul",
  lines(
    "1:",
    // Every degree of C, a 7, a sus, a maj7, slash chords and D7 from outside the
    // key, for the chord colors' pictures.
    ".C        F         C             Am",
    "When peace like a river attendeth my way,",
    ".Dm7          G7       C",
    "When sorrows like sea billows roll;",
    ".C         Em          F            D7",
    "Whatever my lot, Thou hast taught me to say,",
    ".C/G       G    Gsus4    G7    C",
    "It is well, it is well with my soul.",
    "",
    "R:",
    ".Am       Em    F",
    "It is well with my soul,",
    ".Fmaj7      Bdim   C/G   G7  C",
    "It is well, it is well with my soul.",
    "",
    "2:",
    "Though Satan should buffet, though trials should come,",
    "Let this blest assurance control,",
    "That Christ has regarded my helpless estate,",
    "And hath shed His own blood for my soul.",
    "",
    "R",
  ),
);

// The Lord's Prayer, as churches pray it.
song.run("father", "", "", '["prayer"]');
version.run(
  "father-ro",
  "father",
  "ro",
  "Tatăl nostru",
  lines(
    "Tatăl nostru, Care ești în ceruri,",
    "Sfințească-se numele Tău,",
    "Vie împărăția Ta,",
    "Facă-se voia Ta,",
    "Precum în cer așa și pe pământ.",
    "",
    "Pâinea noastră cea de toate zilele",
    "Dă-ne-o nouă astăzi",
    "Și ne iartă nouă greșelile noastre,",
    "Precum și noi iertăm greșiților noștri.",
    "",
    "Și nu ne duce pe noi în ispită,",
    "Ci ne izbăvește de cel rău.",
    "Că a Ta este împărăția și puterea și slava,",
    "În vecii vecilor. Amin.",
  ),
);
version.run(
  "father-en",
  "father",
  "en",
  "The Lord's Prayer",
  lines(
    "Our Father, who art in heaven,",
    "Hallowed be thy name;",
    "Thy kingdom come,",
    "Thy will be done,",
    "On earth as it is in heaven.",
    "",
    "Give us this day our daily bread,",
    "And forgive us our trespasses,",
    "As we forgive those",
    "Who trespass against us.",
    "",
    "And lead us not into temptation,",
    "But deliver us from evil.",
    "For thine is the kingdom, the power and the glory,",
    "For ever and ever. Amen.",
  ),
);

// Phos hilaron, 3rd century; in English by Robert Bridges, 1899.
song.run("light", "A", "", '["evening"]');
version.run(
  "light-ro",
  "light",
  "ro",
  "Lumină lină",
  lines(
    "Lumină lină a sfintei slave",
    "A Tatălui ceresc, Celui fără de moarte,",
    "Sfântului, Fericitului, Iisuse Hristoase,",
    "",
    "Venind la apusul soarelui,",
    "Văzând lumina cea de seară,",
    "Lăudăm pe Tatăl, pe Fiul și pe Sfântul Duh, Dumnezeu.",
    "",
    "Vrednic ești în toată vremea",
    "A fi lăudat de glasuri cuvioase,",
    "Fiul lui Dumnezeu, Cel ce dai viață,",
    "Pentru aceasta lumea Te slăvește.",
  ),
);
version.run(
  "light-en",
  "light",
  "en",
  "O Gladsome Light",
  lines(
    "O gladsome light, O grace",
    "Of God the Father's face,",
    "The eternal splendour wearing;",
    "Celestial, holy, blest,",
    "Our Saviour Jesus Christ,",
    "Joyful in thine appearing.",
    "",
    "Now, ere day fadeth quite,",
    "We see the evening light,",
    "Our wonted hymn outpouring;",
    "Father of might unknown,",
    "Thee, his incarnate Son,",
    "And Holy Spirit adoring.",
    "",
    "To thee of right belongs",
    "All praise of holy songs,",
    "O Son of God, lifegiver;",
    "Thee, therefore, O Most High,",
    "The world doth glorify,",
    "And shall exalt for ever.",
  ),
);

// The Easter hymn, sung three times.
song.run("risen", "E", "", '["easter"]');
version.run(
  "risen-ro",
  "risen",
  "ro",
  "Hristos a înviat",
  lines(
    "/:.Hristos a înviat din morți,",
    "Cu moartea pe moarte călcând,",
    "Și celor din morminte",
    "Viață dăruindu-le.:/",
  ),
);
version.run(
  "risen-en",
  "risen",
  "en",
  "Christ Is Risen",
  lines(
    "/:.Christ is risen from the dead,",
    "Trampling down death by death,",
    "And upon those in the tombs",
    "Bestowing life.:/",
  ),
);

// From Isaiah 8 and 9, as the Romanian evening service sings it.
song.run("with-us", "Dm", "4/4", "[]");
version.run(
  "with-us-ro",
  "with-us",
  "ro",
  "Cu noi este Dumnezeu",
  lines(
    "R:",
    ".Dm          Gm      A",
    "Cu noi este Dumnezeu,",
    ".Dm             Gm            A",
    "Înțelegeți, neamuri, și vă plecați,",
    ".Dm      A       Dm",
    "Că cu noi este Dumnezeu.",
    "",
    "1:",
    "Auziți până la marginea pământului,",
    "Că cu noi este Dumnezeu.",
    "",
    "R",
    "",
    "2:",
    "Cei puternici, plecați-vă,",
    "Că cu noi este Dumnezeu.",
    "",
    "R",
  ),
);

// The Trisagion, sung three times.
song.run("trisagion", "", "", "[]");
version.run(
  "trisagion-ro",
  "trisagion",
  "ro",
  "Sfinte Dumnezeule",
  lines(
    "/:.Sfinte Dumnezeule,",
    "Sfinte tare,",
    "Sfinte fără de moarte,",
    "Miluiește-ne pe noi.:/",
  ),
);

const playlist = db.prepare(
  `INSERT INTO playlists (id, community_id, title, service_date, created_by, created_at, updated_at) VALUES (?, 'c', ?, ?, ?, ?, ?)`,
);
// Sundays have no title: their date names them.
const playlists = [
  ["p-27", null, "2026-09-27", "ioana", "2026-09-26T18:00:00.000Z"],
  ["p-20", null, "2026-09-20", "andrei", "2026-09-19T18:00:00.000Z"],
  ["p-13", null, "2026-09-13", "ioana", "2026-09-12T18:00:00.000Z"],
  ["p-thu", "Thursday rehearsal", null, "andrei", "2026-09-30T17:00:00.000Z"],
  ["p-sun", null, "2026-10-04", "ioana", "2026-10-02T18:00:00.000Z"],
] as const;
for (const [id, title, date, by, when] of playlists)
  playlist.run(id, title, date, by, when, when);

const entry = db.prepare(
  `INSERT INTO entries (id, community_id, playlist_id, position, kind, song_id, text, planned_minutes,
     bible_book, bible_chapter, bible_verse_from, bible_verse_to, created_by, created_at, updated_at)
   VALUES (?, 'c', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '${at}', '${at}')`,
);
const sunday: [string, string | null, string | null, number | null][] = [
  ["song", "grace", null, null],
  ["song", "holy", null, null],
  ["divider", null, "Prayer", 5],
  ["song", "father", null, null],
  ["bible", null, null, null],
  ["song", "with-us", null, null],
  [
    "text",
    null,
    "# Announcements\n\nThursday at 7 pm: rehearsal.\nSunday: lunch together after the service.",
    3,
  ],
  ["divider", null, "Sermon", 35],
  ["song", "well", null, null],
  ["song", "light", null, null],
];
sunday.forEach(([kind, songId, text, minutes], i) =>
  entry.run(
    `e-${i}`,
    "p-sun",
    i + 1,
    kind,
    songId,
    text,
    minutes,
    kind === "bible" ? 19 : null,
    kind === "bible" ? 23 : null,
    kind === "bible" ? 1 : null,
    kind === "bible" ? 4 : null,
    i % 3 === 0 ? "andrei" : "ioana",
  ),
);
for (const [i, songId] of ["risen", "trisagion", "grace"].entries())
  entry.run(
    `old-${i}`,
    "p-27",
    i + 1,
    "song",
    songId,
    null,
    null,
    null,
    null,
    null,
    null,
    "ioana",
  );

// Services that played songs, for the empty search box's reasons:
// two of the 27th's, and a song sung often until early 2025.
const play = db.prepare(
  `INSERT INTO plays (id, community_id, song_id, mode, played_at, created_at, updated_at)
   VALUES (?, 'c', ?, 'service', ?, '${at}', '${at}')`,
);
for (const [song, day] of [
  ["risen", "2026-09-27"],
  ["grace", "2026-09-27"],
  ["trisagion", "2025-01-05"],
  ["trisagion", "2025-02-02"],
  ["trisagion", "2025-03-02"],
])
  play.run(`play-${song}-${day}`, song, `${day}T08:30:00.000Z`);

// Slides from a file, a made-up deck (e2e/screenshots/camp.pdf, by
// LibreOffice from camp.fodp), at the end of Sunday's playlist: the converter draws its
// pages when the server starts, as for a file a restart interrupted.
db.prepare(
  `INSERT INTO entries (id, community_id, playlist_id, position, kind, text, created_by, created_at, updated_at)
   VALUES ('e-slides', 'c', 'p-sun', 20, 'slides', 'Summer camp 2027', 'andrei', '${at}', '${at}')`,
).run();
db.prepare(
  `INSERT INTO slide_files (id, community_id, entry_id, name, kind, originals, state, created_by, created_at, updated_at)
   VALUES ('demoslides', 'c', 'e-slides', 'Summer camp 2027.pdf', 'pdf', '["original-1.pdf"]', 'preparing', 'andrei', '${at}', '${at}')`,
).run();
const deck = join(dirname(path), "slides", "demoslides");
rmSync(deck, { recursive: true, force: true });
mkdirSync(deck, { recursive: true });
copyFileSync("e2e/screenshots/camp.pdf", join(deck, "original-1.pdf"));

db.prepare(
  `INSERT INTO feedback (id, community_id, text, page, device_type, created_by, updated_by, created_at, updated_at)
   VALUES ('f1', 'c', ?, '/example/vocalists', 'phone', 'elena', 'elena', '${at}', '${at}')`,
).run(
  "It would help to see the next song's key on the vocalists' phones, so we can get ready.",
);

// Classic's hints were seen, so they don't cover the views.
db.exec(
  `UPDATE users SET preferences = json_set(preferences, '$.hints', json('["goLive","search","keys","project","musician"]'))`,
);

// Chords written in the texts go to the track, as after an import, and the songs
// to the search index.
convertSongs(db);
indexSongs(db);
db.close();
