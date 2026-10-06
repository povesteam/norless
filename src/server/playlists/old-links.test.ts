import { expect, test } from "vitest";
import { buildApp } from "../app.js";
import { migrate, openDatabase } from "../db/db.js";
import { legacyId } from "../import/mapping.js";
import { oldLinkTarget } from "./old-links.js";

const db = openDatabase(":memory:");
migrate(db);
const shared = legacyId("shared", "playlists", "oldRo");
const uaCopy = legacyId("ua", "playlists", "oldBoth");
db.prepare(
  "INSERT INTO communities (id, slug, name, languages, time_zone, imported_at, created_at, updated_at) VALUES ('c', 'unu-unu', 'Unu-Unu', '[\"ro\",\"uk\"]', 'Europe/Bucharest', 'x', 'x', 'x')",
).run();
const playlist = db.prepare(
  "INSERT INTO playlists (id, community_id, title, created_at, updated_at) VALUES (?, 'c', 'P', '2026-10-04T08:00:00.000Z', '2026-10-04T08:00:00.000Z')",
);
playlist.run(shared);
playlist.run(legacyId("shared", "playlists", "oldBoth"));
playlist.run(uaCopy);

test("old playlist links go to the imported playlist, in the old app's language", () => {
  expect(oldLinkTarget(db, "app.norless.com", "/playlist/oldRo")).toBe(
    `/unu-unu/playlists/${shared}?lang=ro`,
  );
  // The Ukrainian app's own copy of a playlist both apps had.
  expect(oldLinkTarget(db, "app-ua.norless.com", "/playlist/oldBoth")).toBe(
    `/unu-unu/playlists/${uaCopy}?lang=uk`,
  );
  expect(oldLinkTarget(db, "app.norless.com", "/playlist/gone")).toBe(
    "/unu-unu/playlists?lang=ro",
  );
  expect(oldLinkTarget(db, "app-ua.norless.com", "/")).toBe("/unu-unu?lang=uk");
  expect(oldLinkTarget(db, "app-ua.norless.com", "/template/output.html")).toBe(
    "/unu-unu/projector/uk",
  );
  expect(oldLinkTarget(db, "norless.com", "/playlist/oldRo")).toBeNull();
});

test("the server redirects requests for the old hosts for good", async () => {
  const app = buildApp({ db, logger: false, origin: "https://norless.com" });
  const response = await app.inject({
    method: "GET",
    url: "/playlist/oldRo",
    headers: { host: "app.norless.com" },
  });
  expect(response.statusCode).toBe(301);
  expect(response.headers.location).toBe(
    `https://norless.com/unu-unu/playlists/${shared}?lang=ro`,
  );
  const here = await app.inject({ method: "GET", url: "/api/health" });
  expect(here.statusCode).toBe(200);
});
