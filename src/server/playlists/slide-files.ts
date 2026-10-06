import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { extname, join } from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireRole } from "../auth/auth.js";
import { ConverterAway, documents, Refused } from "../converter.js";
import type { Db } from "../db/db.js";
import { newId } from "../ids.js";
import type { Live } from "../live/live.js";
import type { Community } from "../songs/search.js";
import { addEntry, moveEntry } from "./entries.js";
import {
  pageWidths,
  type SlideFile,
  type SlideKind,
  type Slides,
} from "../../shared/slides.js";

/*
 * Slides from files: a slides entry shows the pages of a PDF or of
 * pictures; a presentation is added as a PDF exported from it. Each file is kept under `slides/<file id>/` beside its
 * pages, drawn once by the converter at three widths; a file per language is optional.
 */

export type { SlideFile, SlideKind, Slides };
const MAX_BYTES = 100e6;
const BATCH = 20;
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** What each accepted file is, by its extension. */
const kindOf: Record<string, SlideKind> = {
  ".pdf": "pdf",
  ".png": "pictures",
  ".jpg": "pictures",
  ".jpeg": "pictures",
  ".webp": "pictures",
};
const pictureTypes: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

type Row = {
  id: string;
  community_id: string;
  entry_id: string;
  language: string | null;
  name: string;
  kind: SlideKind;
  originals: string;
  pages: number;
  total: number | null;
  state: SlideFile["state"];
  error: string | null;
};

const shown = (row: Row): SlideFile => ({
  id: row.id,
  language: row.language,
  name: row.name,
  kind: row.kind,
  pages: row.pages,
  total: row.total,
  state: row.state,
  error: row.error,
});

/** The slides entries' files, by entry: the main one first. */
export function slideFilesOf(db: Db, entryIds: string[]) {
  const files = new Map<string, SlideFile[]>();
  if (!entryIds.length) return files;
  const rows = db
    .prepare(
      `SELECT * FROM slide_files WHERE deleted_at IS NULL
         AND entry_id IN (SELECT value FROM json_each(?))
       ORDER BY language IS NOT NULL, language`,
    )
    .all(JSON.stringify(entryIds)) as Row[];
  for (const row of rows)
    files.set(row.entry_id, [...(files.get(row.entry_id) ?? []), shown(row)]);
  return files;
}

/** An uploaded file, checked: its name, its kind and its bytes. */
type Upload = { name: string; ext: string; kind: SlideKind; bytes: Buffer };

/** The files of a multipart upload, or why they can't be slides. */
async function uploadsOf(request: FastifyRequest) {
  const form = await new Response(new Uint8Array(request.body as Buffer), {
    headers: { "content-type": request.headers["content-type"] ?? "" },
  })
    .formData()
    .catch(() => null);
  const files = (form?.getAll("file") ?? []).filter(
    (f): f is File => typeof f !== "string",
  );
  if (!files.length) return "No file";
  const uploads: Upload[] = [];
  for (const file of files) {
    const ext = extname(file.name).toLowerCase();
    const kind = kindOf[ext];
    if (!kind) return `Not a PDF or picture: ${file.name}`;
    if (file.size > MAX_BYTES) return `Over 100 MB: ${file.name}`;
    uploads.push({
      name: file.name,
      ext,
      kind,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
  }
  return uploads;
}

/**
 * The entries an upload makes: one per PDF, and the pictures together,
 * a page each in file name order.
 */
export function entriesFrom(uploads: Upload[]) {
  const pictures = uploads
    .filter((u) => u.kind === "pictures")
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return [
    ...uploads.filter((u) => u.kind !== "pictures").map((u) => [u]),
    ...(pictures.length ? [pictures] : []),
  ];
}

/** An entry's title: the file's name without its extension. */
const titleOf = (name: string) =>
  name.slice(0, name.length - extname(name).length).trim() || name;

export function attachSlideFiles(
  app: FastifyInstance,
  {
    db,
    live,
    findCommunity,
    dir,
  }: {
    db: Db;
    /** Relayed: a playlist's change also goes out to the screens showing it. */
    live: Live;
    findCommunity: (slug: string) => Community | undefined;
    /** Where files and pages are kept; without it, there are no slides from files. */
    dir?: string;
  },
) {
  const row = (id: string) =>
    db.prepare("SELECT * FROM slide_files WHERE id = ?").get(id) as
      Row | undefined;
  const folderOf = (id: string) => join(dir ?? "", id);
  /** The playlist of the file's entry hears of it, and the screens where it's live. */
  const tell = (fileId: string) => {
    const playlist = db
      .prepare(
        "SELECT e.playlist_id FROM slide_files f JOIN entries e ON e.id = f.entry_id WHERE f.id = ?",
      )
      .pluck()
      .get(fileId) as string | undefined;
    if (playlist) live.publish(`playlist:${playlist}`, {});
  };
  const update = (id: string, set: Partial<Row>) => {
    const columns = Object.keys(set);
    db.prepare(
      `UPDATE slide_files SET ${columns.map((c) => `${c} = @${c}`).join(", ")}, updated_at = @at WHERE id = @id`,
    ).run({ ...set, id, at: new Date().toISOString() });
  };

  // Files being prepared now, so a retry doesn't start a second preparation.
  const preparing = new Set<string>();
  /**
   * Draws a file's pages, a step at a time, saying how far it is; while the converter
   * is away it stays preparing and is tried again every minute.
   */
  const prepare = async (id: string) => {
    if (preparing.has(id) || !dir) return;
    preparing.add(id);
    try {
      await prepareNow(id);
    } catch (error) {
      if (error instanceof ConverterAway) update(id, {});
      else {
        if (!(error instanceof Refused))
          app.log.error({ error, id }, "Slides not prepared");
        update(id, {
          state: "failed",
          error:
            error instanceof Refused && !/^\d+$/.test(error.message)
              ? error.message
              : "The file couldn't be opened",
        });
      }
    } finally {
      preparing.delete(id);
      tell(id);
    }
  };
  const prepareNow = async (id: string) => {
    const file = row(id);
    if (!file || file.state !== "preparing") return;
    const folder = folderOf(id);
    const originals = JSON.parse(file.originals) as string[];
    const save = (pages: Map<string, Buffer>, page: (n: number) => number) => {
      for (const [name, bytes] of pages) {
        const [n, width] = name.split("-").map(Number);
        if (!n || !(pageWidths as readonly number[]).includes(width ?? 0))
          throw new Error(`Unexpected page ${name}`);
        writeFileSync(join(folder, `${page(n)}-${width}.jpg`), bytes);
      }
    };
    if (file.kind === "pictures") {
      update(id, { total: originals.length });
      for (let i = file.pages; i < originals.length; i++) {
        const original = originals[i] ?? "";
        save(
          await documents.picture(
            join(folder, original),
            pictureTypes[extname(original)] ?? "",
          ),
          () => i + 1,
        );
        update(id, { pages: i + 1 });
        tell(id);
      }
    } else {
      const pdf = join(folder, originals[0] ?? "");
      const total = file.total ?? (await documents.info(pdf));
      update(id, { total });
      for (let from = file.pages + 1; from <= total; from += BATCH) {
        const to = Math.min(from + BATCH - 1, total);
        save(await documents.pages(pdf, from, to), (n) => n);
        update(id, { pages: to });
        tell(id);
      }
    }
    update(id, { state: "ready", error: null });
  };

  /** Keeps an upload's files as a slide file of the entry, and starts preparing it. */
  const keep = (
    uploads: Upload[],
    entryId: string,
    language: string | null,
    { communityId, userId }: { communityId: string; userId: string },
  ) => {
    const id = newId();
    const folder = folderOf(id);
    mkdirSync(folder, { recursive: true });
    const originals = uploads.map((u, i) => `original-${i + 1}${u.ext}`);
    uploads.forEach((u, i) =>
      writeFileSync(join(folder, originals[i] ?? ""), u.bytes),
    );
    const at = new Date().toISOString();
    db.prepare(
      `INSERT INTO slide_files (id, community_id, entry_id, language, name, kind, originals, state,
         created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'preparing', ?, ?, ?, ?)`,
    ).run(
      id,
      communityId,
      entryId,
      language,
      uploads[0]?.name ?? "",
      uploads[0]?.kind ?? "pdf",
      JSON.stringify(originals),
      at,
      at,
      userId,
      userId,
    );
    void prepare(id);
    return id;
  };

  /** The community and the team member changing the playlist; or null once answered. */
  const authorize = (request: FastifyRequest, reply: FastifyReply) => {
    const { slug } = request.params as { slug: string };
    const community = findCommunity(slug);
    if (!community) {
      void reply.code(404).send({ error: "Not found" });
      return null;
    }
    const userId = requireRole(db, request, reply, community.id, "team");
    return userId ? { community, communityId: community.id, userId } : null;
  };
  const entryOf = (communityId: string, playlistId: string, entryId: string) =>
    db
      .prepare(
        `SELECT e.id FROM entries e JOIN playlists p ON p.id = e.playlist_id
         WHERE e.id = ? AND e.playlist_id = ? AND e.community_id = ? AND e.kind = 'slides'
           AND e.deleted_at IS NULL AND p.deleted_at IS NULL AND p.archived_at IS NULL`,
      )
      .get(entryId, playlistId, communityId) !== undefined;

  // Uploads are multipart, read whole (100 MB at most); only these routes take them.
  void app.register(async (scope) => {
    scope.addContentTypeParser(
      "multipart/form-data",
      { parseAs: "buffer", bodyLimit: MAX_BYTES + 1e6 },
      (_request, body, done) => done(null, body),
    );

    // New slides entries from files, at the end or after `after` (a drop).
    scope.post<{
      Params: { slug: string; id: string };
      Querystring: { after?: string };
    }>(
      "/api/communities/:slug/playlists/:id/slides",
      {
        bodyLimit: MAX_BYTES + 1e6,
        schema: {
          querystring: {
            type: "object",
            additionalProperties: false,
            properties: { after: { type: "string", maxLength: 100 } },
          },
        },
      },
      async (request, reply) => {
        const who = authorize(request, reply);
        if (!who) return reply;
        if (!dir) return reply.code(404).send({ error: "Not here" });
        const uploads = await uploadsOf(request);
        if (typeof uploads === "string")
          return reply.code(400).send({ error: uploads });
        const ids: string[] = [];
        let after = request.query.after ?? null;
        for (const group of entriesFrom(uploads)) {
          const added = addEntry(
            db,
            request.params.id,
            { kind: "slides", text: titleOf(group[0]?.name ?? "") },
            who,
          );
          if (!added) return reply.code(404).send({ error: "Not found" });
          if ("error" in added) return reply.code(400).send(added);
          if (after) moveEntry(db, request.params.id, added.id, after, who);
          after = added.id;
          keep(group, added.id, null, who);
          ids.push(added.id);
        }
        live.publish(`playlist:${request.params.id}`, {});
        return reply.code(201).send({ entries: ids });
      },
    );

    // A file for one of the community's other languages, in place of the one it had.
    scope.put<{
      Params: { slug: string; id: string; entryId: string; language: string };
    }>(
      "/api/communities/:slug/playlists/:id/entries/:entryId/slides/:language",
      { bodyLimit: MAX_BYTES + 1e6 },
      async (request, reply) => {
        const who = authorize(request, reply);
        if (!who) return reply;
        const { id, entryId, language } = request.params;
        if (!dir || !entryOf(who.communityId, id, entryId))
          return reply.code(404).send({ error: "Not found" });
        if (!who.community.languages.includes(language))
          return reply
            .code(400)
            .send({ error: "A language the community doesn't have" });
        const uploads = await uploadsOf(request);
        if (typeof uploads === "string")
          return reply.code(400).send({ error: uploads });
        if (entriesFrom(uploads).length !== 1)
          return reply.code(400).send({ error: "One file, or pictures" });
        dropLanguage(entryId, language);
        keep(uploads, entryId, language, who);
        live.publish(`playlist:${id}`, {});
        return reply.code(204).send();
      },
    );
  });

  const dropLanguage = (entryId: string, language: string) =>
    db
      .prepare(
        "UPDATE slide_files SET deleted_at = ?, updated_at = ? WHERE entry_id = ? AND language = ? AND deleted_at IS NULL",
      )
      .run(
        new Date().toISOString(),
        new Date().toISOString(),
        entryId,
        language,
      );

  app.delete<{
    Params: { slug: string; id: string; entryId: string; language: string };
  }>(
    "/api/communities/:slug/playlists/:id/entries/:entryId/slides/:language",
    async (request, reply) => {
      const who = authorize(request, reply);
      if (!who) return reply;
      const { id, entryId, language } = request.params;
      if (!entryOf(who.communityId, id, entryId))
        return reply.code(404).send({ error: "Not found" });
      dropLanguage(entryId, language);
      live.publish(`playlist:${id}`, {});
      return reply.code(204).send();
    },
  );

  /** A file of the community that isn't deleted. */
  const fileOf = (communityId: string, id: string) => {
    const file = row(id);
    return file?.community_id === communityId ? file : undefined;
  };

  app.post<{ Params: { slug: string; fileId: string } }>(
    "/api/communities/:slug/slide-files/:fileId/retry",
    async (request, reply) => {
      const who = authorize(request, reply);
      if (!who) return reply;
      const file = fileOf(who.communityId, request.params.fileId);
      if (!file) return reply.code(404).send({ error: "Not found" });
      if (file.state === "failed") {
        update(file.id, { state: "preparing", error: null });
        void prepare(file.id);
        tell(file.id);
      }
      return reply.code(204).send();
    },
  );

  // The original file, to download from the entry's menu.
  app.get<{ Params: { slug: string; fileId: string } }>(
    "/api/communities/:slug/slide-files/:fileId/original",
    async (request, reply) => {
      const who = authorize(request, reply);
      if (!who) return reply;
      const file = fileOf(who.communityId, request.params.fileId);
      const [original] = file ? (JSON.parse(file.originals) as string[]) : [];
      if (!file || !original)
        return reply.code(404).send({ error: "Not found" });
      return reply
        .header(
          "content-disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        )
        .type("application/octet-stream")
        .send(readFileSync(join(folderOf(file.id), original)));
    },
  );

  // A page as a picture. Public, like what's live; a page never changes, so it's kept
  // for a year: a new file makes new pages.
  app.get<{ Params: { fileId: string; page: string; width: string } }>(
    "/api/slide-pages/:fileId/:page/:width",
    async (request, reply) => {
      const { fileId, page, width } = request.params;
      const path = join(
        folderOf(fileId),
        `${Number(page)}-${Number(width)}.jpg`,
      );
      if (
        !dir ||
        !/^[A-Za-z0-9]{1,20}$/.test(fileId) ||
        !(pageWidths as readonly number[]).includes(Number(width)) ||
        !row(fileId) ||
        !existsSync(path)
      )
        return reply.code(404).send({ error: "Not found" });
      return reply
        .header("cache-control", "public, max-age=31536000, immutable")
        .type("image/jpeg")
        .send(readFileSync(path));
    },
  );

  // Every minute: files the converter couldn't take, and those a restart interrupted.
  // Every day: files gone for 30 days (their entry removed, or replaced) leave the disk.
  const again = () => {
    const waiting = db
      .prepare(
        "SELECT id FROM slide_files WHERE state = 'preparing' AND deleted_at IS NULL AND updated_at < ?",
      )
      .pluck()
      .all(new Date(Date.now() - MINUTE).toISOString()) as string[];
    for (const id of waiting) void prepare(id);
  };
  const sweep = () => {
    if (!dir) return;
    const before = new Date(Date.now() - 30 * DAY).toISOString();
    const gone = db
      .prepare(
        `SELECT f.id FROM slide_files f JOIN entries e ON e.id = f.entry_id
         WHERE f.deleted_at < @before OR e.deleted_at < @before`,
      )
      .pluck()
      .all({ before }) as string[];
    for (const id of gone) {
      rmSync(folderOf(id), { recursive: true, force: true });
      db.prepare("DELETE FROM slide_files WHERE id = ?").run(id);
    }
  };
  const timers = [setInterval(again, MINUTE), setInterval(sweep, DAY)];
  for (const timer of timers) timer.unref();
  app.addHook("onReady", async () => {
    again();
    sweep();
  });
  app.addHook("onClose", async () => timers.forEach(clearInterval));
  return { prepare };
}
