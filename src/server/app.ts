import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { noteNamings, type NoteNaming } from "../shared/preferences.js";
import { featureNames, switchable, type Switches } from "../shared/features.js";
import { attachSessions, requireRole } from "./auth/auth.js";
import type { Db } from "./db/db.js";
import { attachActivity } from "./ops/activity.js";
import { attachChanges } from "./changes.js";
import { alertAppTeam, attachAlerts } from "./ops/alerts.js";
import { watchConverter } from "./converter.js";
import { attachDeviceLogin } from "./auth/device-login.js";
import { attachEditing } from "./songs/editing.js";
import { attachFeatureRequests } from "./community/feature-requests.js";
import { attachLiveChord } from "./live/live-chord.js";
import { attachTeamSchedule } from "./schedule/team-schedule.js";
import { attachFeedback } from "./community/feedback.js";
import { attachGoogle } from "./auth/google.js";
import { attachLoginLinks } from "./auth/login-links.js";
import type { Mail, Mailer } from "./mail.js";
import { attachLive, type Live } from "./live/live.js";
import { attachRecordings } from "./live/recordings.js";
import { attachMembers, isMember } from "./auth/members.js";
import { attachLiveState } from "./live/live-state.js";
import { attachNextPlaylists } from "./playlists/next-playlist.js";
import { attachOldLinks } from "./playlists/old-links.js";
import { attachPages } from "./playlists/pages.js";
import { attachPlaylists } from "./playlists/playlist-routes.js";
import { attachPrivacy } from "./community/privacy.js";
import { attachProblems } from "./playlists/problems.js";
import { attachSchedule } from "./schedule/schedule-routes.js";
import { attachCalendar } from "./schedule/calendar.js";
import { attachOffline } from "./live/offline.js";
import { attachScreens } from "./live/screens.js";
import { attachPresence } from "./live/presence.js";
import { type Community, search } from "./songs/search.js";
import { attachShortCodes } from "./playlists/short-codes.js";
import { attachSimulation, type Simulation } from "./live/simulate.js";
import { attachSongs } from "./songs/song-routes.js";
import { attachSongFeedback } from "./songs/song-feedback.js";
import { attachStatistics } from "./songs/statistics.js";
import { attachSearchMisses } from "./songs/search-misses.js";
import { attachRooms } from "./live/rooms.js";
import { attachLinkPreviews } from "./songs/link-preview.js";
import { attachSlideFiles } from "./playlists/slide-files.js";
import { attachWelcome } from "./community/welcome.js";
import { attachAvatars } from "./auth/avatars.js";
import { attachChapters, type YouTube } from "./songs/chapters.js";
import { attachReplays } from "./songs/replays.js";
import { attachTheme, publicTheme, themeOf } from "./theme.js";
import { attachUsage } from "./ops/usage.js";

// Resolves to <repo>/dist/client both from src/server (dev) and dist/server (built).
const clientDir = fileURLToPath(new URL("../../dist/client", import.meta.url));

export function buildApp({
  db,
  logger = true,
  devLogin = false,
  embedding,
  origin = "https://norless.com",
  source = null,
  backupDir,
  recordingsDir,
  slidesDir,
  mailer = null,
  devMail,
  operator = null,
  services = [],
  google,
  simulation,
  appTeam = [],
  trustProxy = false,
  youtube,
  vapid,
  converterWatch = false,
}: {
  db: Db;
  logger?: boolean;
  devLogin?: boolean;
  /** Checks whether a page can be shown in a frame; tests replace it. */
  embedding?: (url: string) => Promise<boolean | null>;
  /** Where the app lives, for redirects from the old app's hosts. */
  origin?: string;
  /** The running version's source code, which the AGPL asks to offer to users. */
  source?: string | null;
  /** Where backups are kept, for the alerts. */
  backupDir?: string;
  /** Where recordings are kept; without it, recording is off. */
  recordingsDir?: string;
  /** Where slides from files are kept; without it, they're off. */
  slidesDir?: string;
  /** Sends emails: login links. Without one, there's no login by email. */
  mailer?: Mailer | null;
  /** With the dev login: the last email kept for an address, instead of sent. */
  devMail?: (to: string) => Mail | undefined;
  /** For the privacy notice: who runs this server, and the services it uses. */
  operator?: string | null;
  services?: string[];
  /** Google's OAuth client, for login with Google; the issuer only in tests. */
  google?: {
    clientId: string;
    clientSecret: string;
    issuer?: URL;
    insecure?: boolean;
  };
  /** A slow or bad network, for trying the app locally (SLOW=1, FLAKY=1). */
  simulation?: Simulation;
  /** The Norless app team's email addresses, who get the ideas sent to them. */
  appTeam?: string[];
  /** Behind a proxy (Caddy) that sets X-Forwarded-For, for visitors' addresses. */
  trustProxy?: boolean;
  /** The YouTube Data API, for the chapters' offset; without it, the offset is typed. */
  youtube?: YouTube;
  /** The VAPID keys push is sent with; without them, the app only tells. */
  vapid?: { publicKey: string; privateKey: string; subject: string };
  /** Checks the converter every minute and alerts the app team while it's away. */
  converterWatch?: boolean;
}) {
  const app = Fastify({ logger, trustProxy });
  if (simulation) attachSimulation(app, simulation);
  attachOldLinks(app, { db, origin });

  // Ok only while the database answers, for deploys and the uptime check.
  app.get("/api/health", async (_request, reply) => {
    try {
      db.prepare("SELECT 1").get();
      return { status: "ok" };
    } catch {
      return reply.code(503).send({ status: "database unavailable" });
    }
  });
  if (backupDir && appTeam.length > 0)
    attachAlerts(app, { backupDir, appTeam, mailer, origin });
  if (converterWatch) {
    const stop = watchConverter((subject, text) =>
      alertAppTeam(app, { appTeam, mailer, origin }, subject, text),
    );
    app.addHook("onClose", async () => stop());
  }
  app.get("/api/about", async () => ({ license: "AGPL-3.0-or-later", source }));
  attachSessions(app, db, {
    devLogin,
    emailLogin: !!mailer,
    googleLogin: !!google,
    devMail: !!devMail,
    appTeam,
  });
  const live = attachLive(app, { db, simulation, trustProxy });
  // Before every other route, so each request's changes are logged as its user's.
  attachChanges(app, {
    db,
    live,
    findCommunity: (slug) =>
      db
        .prepare(
          "SELECT id FROM communities WHERE slug = ? AND deleted_at IS NULL",
        )
        .get(slug) as { id: string } | undefined,
  });
  if (google) attachGoogle(app, { db, origin, ...google });
  if (mailer) attachLoginLinks(app, { db, mailer, origin });
  // Development and end-to-end tests only: the email a login link would have sent.
  if (devLogin && devMail)
    app.get<{ Querystring: { to: string } }>(
      "/api/auth/dev-mail",
      async (request, reply) =>
        devMail(request.query.to) ?? reply.code(404).send({ error: "None" }),
    );
  attachEditing(live, db);
  attachPresence(live, db);
  attachActivity(live, db);

  const findCommunity = (
    slug: string,
  ): (Community & { slug: string; name: string }) | undefined => {
    const row = db
      .prepare(
        "SELECT id, slug, name, languages FROM communities WHERE slug = ? AND deleted_at IS NULL",
      )
      .get(slug) as
      { id: string; slug: string; name: string; languages: string } | undefined;
    return row && { ...row, languages: JSON.parse(row.languages) as string[] };
  };

  // The communities, for the start page of a device that hasn't opened one yet.
  app.get("/api/communities", async () =>
    db
      .prepare(
        "SELECT slug, name FROM communities WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE",
      )
      .all(),
  );

  app.get<{ Params: { slug: string } }>(
    "/api/communities/:slug",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const { slug, name, languages } = community;
      // So an empty library can say so and offer to add the first song.
      const { songCount } = db
        .prepare(
          "SELECT count(*) AS songCount FROM songs WHERE community_id = ? AND deleted_at IS NULL",
        )
        .get(community.id) as { songCount: number };
      const theme = publicTheme(themeOf(db, community.id), slug);
      const {
        bible_versions,
        note_names,
        tempo_percent,
        tempo_seconds,
        youtube_channel,
        switches,
      } = db
        .prepare(
          "SELECT bible_versions, note_names, tempo_percent, tempo_seconds, youtube_channel, switches FROM communities WHERE id = ?",
        )
        .get(community.id) as {
        switches: string;
        bible_versions: string;
        note_names: NoteNaming;
        tempo_percent: number;
        tempo_seconds: number;
        youtube_channel: string | null;
      };
      return {
        slug,
        name,
        languages,
        songCount,
        theme,
        switches: JSON.parse(switches) as Switches,
        bibleVersions: JSON.parse(bible_versions) as Record<string, number>,
        noteNames: note_names,
        tempoCheck: { percent: tempo_percent, seconds: tempo_seconds },
        youtubeChannel: youtube_channel,
      };
    },
  );

  // Owners choose the bible.com version per community language.
  app.put<{
    Params: { slug: string };
    Body: { versions: Record<string, number> };
  }>(
    "/api/communities/:slug/bible-versions",
    {
      schema: {
        body: {
          type: "object",
          required: ["versions"],
          additionalProperties: false,
          properties: {
            versions: {
              type: "object",
              additionalProperties: {
                type: "integer",
                minimum: 1,
                maximum: 99_999,
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const userId = requireRole(db, request, reply, community.id, "owner");
      if (!userId) return reply;
      const { versions } = request.body;
      if (Object.keys(versions).some((l) => !community.languages.includes(l)))
        return reply.code(400).send({ error: "Not a community language" });
      db.prepare(
        "UPDATE communities SET bible_versions = ?, updated_at = ?, updated_by = ? WHERE id = ?",
      ).run(
        JSON.stringify(versions),
        new Date().toISOString(),
        userId,
        community.id,
      );
      return reply.code(204).send();
    },
  );

  // Owners choose how chords are named for members who didn't choose.
  app.put<{ Params: { slug: string }; Body: { noteNames: NoteNaming } }>(
    "/api/communities/:slug/note-names",
    {
      schema: {
        body: {
          type: "object",
          required: ["noteNames"],
          additionalProperties: false,
          properties: { noteNames: { type: "string", enum: [...noteNamings] } },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const userId = requireRole(db, request, reply, community.id, "owner");
      if (!userId) return reply;
      db.prepare(
        "UPDATE communities SET note_names = ?, updated_at = ?, updated_by = ? WHERE id = ?",
      ).run(
        request.body.noteNames,
        new Date().toISOString(),
        userId,
        community.id,
      );
      return reply.code(204).send();
    },
  );

  // Owners choose when a drift shows on stage: off by this percent for these seconds.
  app.put<{
    Params: { slug: string };
    Body: { percent: number; seconds: number };
  }>(
    "/api/communities/:slug/tempo-check",
    {
      schema: {
        body: {
          type: "object",
          required: ["percent", "seconds"],
          additionalProperties: false,
          properties: {
            percent: { type: "number", exclusiveMinimum: 0, maximum: 20 },
            seconds: { type: "integer", minimum: 2, maximum: 60 },
          },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const userId = requireRole(db, request, reply, community.id, "owner");
      if (!userId) return reply;
      db.prepare(
        "UPDATE communities SET tempo_percent = ?, tempo_seconds = ?, updated_at = ?, updated_by = ? WHERE id = ?",
      ).run(
        request.body.percent,
        request.body.seconds,
        new Date().toISOString(),
        userId,
        community.id,
      );
      return reply.code(204).send();
    },
  );

  // Owners switch single features on or off: the whole set, each
  // feature true or false; one not in it is off.
  app.put<{ Params: { slug: string }; Body: { switches: Switches } }>(
    "/api/communities/:slug/switches",
    {
      schema: {
        body: {
          type: "object",
          required: ["switches"],
          additionalProperties: false,
          properties: {
            switches: {
              type: "object",
              additionalProperties: false,
              properties: Object.fromEntries(
                featureNames
                  .filter(switchable)
                  .map((name) => [name, { type: "boolean" }]),
              ),
            },
          },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const userId = requireRole(db, request, reply, community.id, "owner");
      if (!userId) return reply;
      db.prepare(
        "UPDATE communities SET switches = ?, updated_at = ?, updated_by = ? WHERE id = ?",
      ).run(
        JSON.stringify(request.body.switches),
        new Date().toISOString(),
        userId,
        community.id,
      );
      return reply.code(204).send();
    },
  );

  app.get<{
    Params: { slug: string };
    Querystring: { q?: string; playlist?: string };
  }>("/api/communities/:slug/search", async (request, reply) => {
    const community = findCommunity(request.params.slug);
    if (!community) return reply.code(404).send({ error: "Not found" });
    const user = request.user;
    const member =
      user && !user.device && isMember(db, community.id, user.id)
        ? user.id
        : undefined;
    const { q = "", playlist } = request.query;
    return { results: search(db, community, q, member, playlist) };
  });

  // Saved songs and changed playlists also reach the live view where they're live.
  let liveChanged: (topic: string) => void = () => {};
  const relayed: Live = {
    ...live,
    publish: (topic, data) => {
      live.publish(topic, data);
      liveChanged(topic);
    },
  };
  attachDeviceLogin(app, { db, live, findCommunity });
  attachSongs(app, { db, live: relayed, findCommunity });
  attachSongFeedback(app, { db, live: relayed, findCommunity });
  attachFeatureRequests(app, { db, findCommunity });
  attachLiveChord(app, { db, live, findCommunity });
  attachTeamSchedule(app, { db, findCommunity, vapid });
  attachStatistics(app, { db, findCommunity });
  attachSearchMisses(app, { db, findCommunity });
  attachLinkPreviews(app, { db, findCommunity });
  attachAvatars(app, db);
  attachChapters(app, { db, findCommunity, youtube });
  attachReplays(app, { db, findCommunity, youtube });
  attachMembers(app, {
    db,
    findCommunity,
    mail: mailer ? { mailer, origin } : undefined,
  });
  attachPlaylists(app, { db, live: relayed, findCommunity });
  attachSlideFiles(app, { db, live: relayed, findCommunity, dir: slidesDir });
  attachSchedule(app, { db, findCommunity });
  attachCalendar(app, { db, findCommunity });
  attachOffline(app, { db, findCommunity });
  attachNextPlaylists(app, { db, live });
  const { stateOf, changed, viewOf, republish, forget } = attachLiveState(app, {
    db,
    live,
    findCommunity,
  });
  liveChanged = changed;
  attachRecordings(app, {
    db,
    findCommunity,
    dir: recordingsDir,
    viewOf,
    republish,
  });
  const { connectedScreens } = attachScreens(app, { db, live, findCommunity });
  attachProblems(app, { db, findCommunity, stateOf, connectedScreens });
  attachRooms(app, { db, findCommunity, stateOf, forget });
  attachPages(app, { db, findCommunity, embedding });
  attachTheme(app, { db, findCommunity });
  attachWelcome(app, { db, findCommunity });
  attachFeedback(app, {
    db,
    findCommunity,
    mail: mailer ? { mailer, origin } : undefined,
    appTeam,
  });
  attachPrivacy(app, { db, findCommunity, operator, services });
  attachUsage(app, { db, appTeam });

  // Serve the built client, and index.html for client-side routes.
  const client = existsSync(clientDir);
  attachShortCodes(app, {
    db,
    findCommunity,
    notFound: (reply) =>
      client
        ? reply.sendFile("index.html")
        : reply.code(404).send({ error: "Not found" }),
  });
  if (client) {
    app.register(fastifyStatic, {
      root: clientDir,
      // Built files carry their hash in the name, so browsers keep them for good;
      // the page and the service worker are asked for again each time.
      setHeaders: (reply, path) => {
        if (path.startsWith(join(clientDir, "assets")))
          reply.header("cache-control", "public, max-age=31536000, immutable");
      },
    });
    app.setNotFoundHandler((request, reply) =>
      request.url.startsWith("/api/")
        ? reply.code(404).send({ error: "Not found" })
        : reply.sendFile("index.html"),
    );
  }

  return app;
}
