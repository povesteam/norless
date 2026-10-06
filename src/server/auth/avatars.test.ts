import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { buildApp } from "../app.js";
import { createSession } from "./auth.js";
import { copyGooglePhoto, refreshGooglePhotos } from "./avatars.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import { deleteAccount } from "./members.js";
import { fakePng, stubConverter } from "../test-helpers.js";

let db: Db;
let session: string;

let converter: Awaited<ReturnType<typeof stubConverter>>;
beforeAll(async () => {
  converter = await stubConverter();
});
afterAll(() => converter.close());

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('ana', 'Ana', 'ana@example.com', 'active', 'x', 'x');
  `);
  session = createSession(db, "ana");
});

const put = (payload: object) =>
  buildApp({ db, logger: false }).inject({
    method: "PUT",
    url: "/api/me/avatar",
    headers: { cookie: `__Host-session=${session}` },
    payload,
  });
const me = async () =>
  (
    await buildApp({ db, logger: false }).inject({
      url: "/api/me",
      headers: { cookie: `__Host-session=${session}` },
    })
  ).json<{ user: { avatar: string | null; avatarSource: string | null } }>()
    .user;
const images = () =>
  db.prepare("SELECT count(*) FROM images").pluck().get() as number;

/** A picture, as a browser sends it. */
const photo = fakePng;

test("an uploaded photo becomes a 256-pixel square, in place of the one before", async () => {
  const first = (await put({ photo: photo() })).json<{ avatar: string }>();
  expect(await me()).toMatchObject({
    avatar: first.avatar,
    avatarSource: "own",
  });
  const picture = await buildApp({ db, logger: false }).inject({
    url: `/api/images/${first.avatar}`,
  });
  expect(picture.headers["content-type"]).toBe("image/jpeg");
  // A 256-pixel square, made by the converter.
  expect(picture.payload).toBe("small picture 256");
  expect(converter.jobs.at(-1)?.query.get("type")).toBe("image/png");

  const second = (await put({ photo: photo() })).json<{ avatar: string }>();
  expect(second.avatar).not.toBe(first.avatar);
  expect(images()).toBe(1);

  // Initials: the photo goes, and a Google login doesn't bring one back.
  expect((await put({ use: "initials" })).json()).toEqual({ avatar: null });
  expect(images()).toBe(0);
  expect(await me()).toMatchObject({
    avatar: null,
    avatarSource: "initials",
  });
});

test("what isn't a picture is refused; Google's photo waits for the next login when its address isn't known", async () => {
  expect((await put({ photo: "data:image/png;base64,AAAA" })).statusCode).toBe(
    400,
  );
  expect((await put({ photo: "data:text/html;base64,AAAA" })).statusCode).toBe(
    400,
  );
  expect((await put({ use: "google" })).json()).toEqual({ avatar: null });
  expect(await me()).toMatchObject({ avatar: null, avatarSource: "google" });
});

test("a laptop logged in from someone's phone can't change their photo", async () => {
  db.exec(`
    INSERT INTO users (id, display_name, status, device_of, device_kind, created_at, updated_at) VALUES
      ('laptop', 'Ana', 'active', 'ana', 'laptop', 'x', 'x');
  `);
  const response = await buildApp({ db, logger: false }).inject({
    method: "PUT",
    url: "/api/me/avatar",
    headers: { cookie: `__Host-session=${createSession(db, "laptop")}` },
    payload: { use: "initials" },
  });
  expect(response.statusCode).toBe(403);
});

test("Google's photo is copied only when they chose neither their own nor initials", async () => {
  await put({ use: "initials" });
  // Never fetched: they chose initials.
  await copyGooglePhoto(db, "ana", "https://127.0.0.1/photo=s96-c");
  expect(await me()).toMatchObject({ avatar: null, avatarSource: "initials" });
});

test("a deleted account's photo goes with it", async () => {
  await put({ photo: photo() });
  db.prepare(
    "UPDATE users SET google_picture = 'https://x/p' WHERE id = 'ana'",
  ).run();
  expect(deleteAccount(db, "ana")).not.toBe("last-owner");
  expect(images()).toBe(0);
  expect(googlePicture()).toEqual({
    google_picture: null,
    google_picture_at: null,
  });
});

const googlePicture = () =>
  db
    .prepare(
      "SELECT google_picture, google_picture_at FROM users WHERE id = 'ana'",
    )
    .get() as {
    google_picture: string | null;
    google_picture_at: string | null;
  };

/** A fetch that answers with Google's photo, and remembers what it was asked for. */
const fakeGoogle = () => {
  const asked: string[] = [];
  const body = Buffer.from(photo().split(",")[1] ?? "", "base64");
  const fetch = (address: string) => {
    asked.push(address);
    return Promise.resolve({ url: address, type: "image/png", body });
  };
  return { asked, fetch };
};

test("Google's photo is fetched again once a week, and kept as it was when it didn't change", async () => {
  // Where Google's photo is, kept at the login even with initials chosen.
  await put({ use: "initials" });
  await copyGooglePhoto(db, "ana", "https://lh3.example/photo=s96-c");
  expect(googlePicture().google_picture).toBe(
    "https://lh3.example/photo=s96-c",
  );

  // With initials, never fetched; with Google's photo, when a week old.
  const google = fakeGoogle();
  const week = 7 * 24 * 3_600_000;
  await refreshGooglePhotos(db, {
    now: new Date(Date.now() + 2 * week),
    fetch: google.fetch,
  });
  expect(google.asked).toEqual([]);
  db.prepare(
    "UPDATE users SET avatar_source = 'google', google_picture_at = ? WHERE id = 'ana'",
  ).run(new Date(Date.now() - 8 * 24 * 3_600_000).toISOString());
  await refreshGooglePhotos(db, { fetch: google.fetch });
  expect(google.asked).toEqual(["https://lh3.example/photo=s256-c"]);
  const first = (await me()).avatar;
  expect(first).not.toBeNull();
  expect(await me()).toMatchObject({ avatarSource: "google" });

  // Not again within the week; a week later the same picture stays the same image.
  await refreshGooglePhotos(db, { fetch: google.fetch });
  expect(google.asked).toHaveLength(1);
  await refreshGooglePhotos(db, {
    now: new Date(Date.now() + week + 60_000),
    fetch: google.fetch,
  });
  expect(google.asked).toHaveLength(2);
  expect((await me()).avatar).toBe(first);
  expect(images()).toBe(1);
});

test("while the converter is away, an upload is refused for now and a Google login goes on", async () => {
  converter.away(true);
  try {
    expect((await put({ photo: photo() })).statusCode).toBe(503);
    await copyGooglePhoto(db, "ana", "https://127.0.0.1/photo=s96-c");
    expect(await me()).toMatchObject({ avatar: null });
  } finally {
    converter.away(false);
  }
});
