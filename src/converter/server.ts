// The converter: reads the files that come from people and from the
// internet, apart from the app and its data. Each job's file comes in its request and
// the results go back in the response; nothing is kept. Node 24 runs this file as it is
// (type stripping), in a container of its own (Dockerfile) with no database, no stored
// files and no internet. The jobs' paths stay stable (`/v1/…`), so an app and a
// converter one version apart still work together.
import { spawn } from "node:child_process";
import { createWriteStream, openAsBlob } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream } from "node:stream/web";

/** Each kind of job: how many run at once, how long one may wait or run, its file's size. */
const kinds = {
  pictures: { at: 2, ms: 10_000, bytes: 20e6 },
  recordings: { at: 1, ms: 15 * 60_000, bytes: 1e9 },
  documents: { at: 1, ms: 180_000, bytes: 100e6 },
};
type Kind = keyof typeof kinds;

/**
 * A kind's queue: a job gets a release once fewer than `at` run, or null when it has
 * waited `ms` (the app tries again later).
 */
export function queue(at: number) {
  let running = 0;
  const waiting: (() => void)[] = [];
  const release = () => {
    let done = false;
    return () => {
      if (done) return;
      done = true;
      running--;
      waiting.shift()?.();
    };
  };
  return (ms: number) =>
    new Promise<(() => void) | null>((resolve) => {
      if (running < at) {
        running++;
        return resolve(release());
      }
      const go = () => {
        clearTimeout(timer);
        running++;
        resolve(release());
      };
      const timer = setTimeout(() => {
        waiting.splice(waiting.indexOf(go), 1);
        resolve(null);
      }, ms);
      waiting.push(go);
    });
}

/** A recording's stretches, "0-3000,3400-": milliseconds, the last one to the end. */
export function parseStretches(text: string) {
  const stretches = text.split(",").map((part) => {
    const match = /^(\d{1,9})-(\d{1,9})?$/.exec(part);
    if (!match) return null;
    const start = Number(match[1]);
    const end = match[2] === undefined ? null : Number(match[2]);
    return end === null || end > start ? { start, end } : null;
  });
  return stretches.length <= 500 && stretches.every(Boolean)
    ? (stretches as { start: number; end: number | null }[])
    : null;
}

/** Runs a tool with its arguments only (no shell), killed past `ms`. */
function run(tool: string, args: string[], ms: number, input?: Buffer) {
  return new Promise<{ ok: boolean; out: Buffer }>((resolve) => {
    const child = spawn(tool, args, {
      stdio: [input ? "pipe" : "ignore", "pipe", "ignore"],
    });
    const out: Buffer[] = [];
    const timer = setTimeout(() => child.kill("SIGKILL"), ms);
    child.stdout?.on("data", (chunk: Buffer) => out.push(chunk));
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ ok: false, out: Buffer.alloc(0) });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, out: Buffer.concat(out) });
    });
    if (input && child.stdin) {
      child.stdin.on("error", () => undefined);
      child.stdin.end(input);
    }
  });
}

class TooBig extends Error {}

/** The request's body, up to `max` bytes, into memory or a file. */
async function receive(request: IncomingMessage, max: number, file?: string) {
  if (Number(request.headers["content-length"] ?? 0) > max) throw new TooBig();
  let size = 0;
  const chunks: Buffer[] = [];
  async function* counted(source: AsyncIterable<Buffer>) {
    for await (const chunk of source) {
      size += chunk.length;
      if (size > max) throw new TooBig();
      yield chunk;
    }
  }
  if (file) {
    await pipeline(request, counted, createWriteStream(file));
    return Buffer.alloc(0);
  }
  for await (const chunk of counted(request)) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const send = async (reply: ServerResponse, response: Response) => {
  reply.writeHead(response.status, Object.fromEntries(response.headers));
  if (response.body)
    await pipeline(Readable.fromWeb(response.body as ReadableStream), reply);
  else reply.end();
};

/** The picture formats read, each with ffmpeg's reader named, so it opens nothing else. */
const readers: Record<string, string> = {
  "image/jpeg": "jpeg_pipe",
  "image/png": "png_pipe",
  "image/webp": "webp_pipe",
  "image/gif": "gif",
};

/** A recording's formats, as browsers record them, each with its demuxer named. */
const demuxers: Record<string, string> = {
  webm: "matroska",
  m4a: "mov",
  ogg: "ogg",
  wav: "wav",
};

/** The widths a document's pages are drawn at: 4K screens, phones and stage, thumbnails. */
const widths = [3840, 1280, 320];
/** At most this many pages per file, and per request for its pages. */
const MAX_PAGES = 300;
const BATCH = 20;

/** A PDF's page count; null when it can't be opened (broken, or a password). */
async function pageCount(pdf: string, ms: number) {
  const { ok, out } = await run("pdfinfo", [pdf], ms);
  const pages = Number(/^Pages:\s+(\d+)/m.exec(out.toString())?.[1] ?? 0);
  return ok && pages > 0 ? pages : null;
}

const jpeg = (bytes: Buffer) =>
  new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });

const jobs: Record<
  Kind,
  (url: URL, request: IncomingMessage, reply: ServerResponse) => Promise<void>
> = {
  /** A picture made small, as a JPEG at most 320 wide, or a square cut from its middle. */
  async pictures(url, request, reply) {
    const reader = readers[url.searchParams.get("type") ?? ""];
    const square = Number(url.searchParams.get("square") ?? 0);
    if (!reader || !Number.isInteger(square) || square < 0 || square > 2048)
      return send(reply, new Response("Not a picture", { status: 422 }));
    const picture = await receive(request, kinds.pictures.bytes);
    const { ok, out } = await run(
      "ffmpeg",
      [
        ...["-v", "error", "-protocol_whitelist", "pipe"],
        ...["-f", reader, "-i", "pipe:0", "-frames:v", "1", "-vf"],
        square
          ? `scale=${square}:${square}:force_original_aspect_ratio=increase,crop=${square}:${square}`
          : "scale='min(320,iw)':-2",
        ...["-f", "image2", "-c:v", "mjpeg", "-q:v", "5", "pipe:1"],
      ],
      kinds.pictures.ms,
      picture,
    );
    await send(
      reply,
      ok && out.length
        ? new Response(new Uint8Array(out), {
            headers: { "content-type": "image/jpeg" },
          })
        : new Response("Not a picture", { status: 422 }),
    );
  },

  /**
   * A recording cut into its stretches, a file each in m4a (AAC), which plays everywhere,
   * Finder and QuickTime included; seeking before the input is fast, and exact once
   * re-encoded, and faststart lets playback begin before a file has loaded.
   */
  async recordings(url, request, reply) {
    const demuxer = demuxers[url.searchParams.get("ext") ?? ""];
    const stretches = parseStretches(url.searchParams.get("stretches") ?? "");
    if (!demuxer || !stretches)
      return send(reply, new Response("Not a recording", { status: 422 }));
    const folder = await mkdtemp(join(tmpdir(), "recording-"));
    try {
      const upload = join(folder, "upload");
      await receive(request, kinds.recordings.bytes, upload);
      const until = Date.now() + kinds.recordings.ms;
      const form = new FormData();
      for (const [i, { start, end }] of stretches.entries()) {
        const file = join(folder, `${i + 1}.m4a`);
        const { ok } = await run(
          "nice",
          [
            ...["-n", "10", "ffmpeg", "-v", "error", "-y"],
            ...["-protocol_whitelist", "file", "-ss", String(start / 1000)],
            ...(end === null ? [] : ["-t", String((end - start) / 1000)]),
            ...["-f", demuxer, "-i", upload, "-map", "0:a"],
            ...["-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", file],
          ],
          Math.max(0, until - Date.now()),
        );
        if (!ok)
          return await send(
            reply,
            new Response("Not a recording", { status: 422 }),
          );
        form.append(
          "file",
          await openAsBlob(file, { type: "audio/mp4" }),
          `${i + 1}.m4a`,
        );
      }
      await send(reply, new Response(form));
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  },

  /**
   * Slides from files, in steps the app takes one after another, so it
   * can show the progress: `info` counts a PDF's pages; `pages` draws pages `from` to
   * `to` of a PDF at each width with pdftoppm;
   * `picture` fits a picture to each width, never enlarged. Pages come back as
   * `multipart/form-data`, a field per page and width ("3-1280").
   */
  async documents(url, request, reply) {
    const step = url.pathname.split("/")[3];
    const type = url.searchParams.get("type") ?? "pdf";
    const refuse = (why: string) =>
      send(reply, new Response(why, { status: 422 }));
    const until = Date.now() + kinds.documents.ms;
    const left = () => Math.max(0, until - Date.now());
    const folder = await mkdtemp(join(tmpdir(), "document-"));
    try {
      if (step === "picture") {
        const reader = readers[type];
        if (!reader) return await refuse("Not a picture");
        const picture = await receive(request, kinds.documents.bytes);
        const form = new FormData();
        for (const width of widths) {
          const { ok, out } = await run(
            "ffmpeg",
            [
              ...["-v", "error", "-protocol_whitelist", "pipe"],
              ...["-f", reader, "-i", "pipe:0", "-frames:v", "1"],
              ...["-vf", `scale='min(${width},iw)':-2`, "-f", "image2"],
              ...["-c:v", "mjpeg", "-q:v", "3", "pipe:1"],
            ],
            left(),
            picture,
          );
          if (!ok || !out.length)
            return await refuse("The picture couldn't be opened");
          form.append(`1-${width}`, jpeg(out), `1-${width}.jpg`);
        }
        return await send(reply, new Response(form));
      }
      if (type !== "pdf") return await refuse("Not a PDF");
      const pdf = join(folder, "in.pdf");
      await receive(request, kinds.documents.bytes, pdf);
      const pages = await pageCount(pdf, left());
      if (pages === null) return await refuse("The file couldn't be opened");
      if (pages > MAX_PAGES) return await refuse("More than 300 pages");
      if (step === "info") return await send(reply, Response.json({ pages }));
      if (step !== "pages") return await refuse("No such step");
      const from = Number(url.searchParams.get("from") ?? 1);
      const to = Math.min(Number(url.searchParams.get("to") ?? from), pages);
      if (
        !Number.isInteger(from) ||
        from < 1 ||
        to < from ||
        to - from >= BATCH
      )
        return await refuse("No such pages");
      const form = new FormData();
      for (let page = from; page <= to; page++)
        for (const width of widths) {
          const out = join(folder, `${page}-${width}`);
          const { ok } = await run(
            "pdftoppm",
            [
              ...["-f", String(page), "-l", String(page), "-singlefile"],
              ...["-jpeg", "-jpegopt", "quality=85"],
              ...["-scale-to-x", String(width), "-scale-to-y", "-1", pdf, out],
            ],
            left(),
          );
          if (!ok) return await refuse("The file couldn't be drawn");
          form.append(
            `${page}-${width}`,
            await openAsBlob(`${out}.jpg`, { type: "image/jpeg" }),
            `${page}-${width}.jpg`,
          );
        }
      await send(reply, new Response(form));
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  },
};

const queues = {
  pictures: queue(kinds.pictures.at),
  recordings: queue(kinds.recordings.at),
  documents: queue(kinds.documents.at),
};

export const server = createServer(async (request, reply) => {
  const url = new URL(request.url ?? "/", "http://converter");
  if (request.method === "GET" && url.pathname === "/health")
    return void reply.end("ok");
  const kind =
    /^\/v1\/(?:(pictures|recordings)|(documents)\/(?:info|pages|picture))$/
      .exec(url.pathname)
      ?.slice(1)
      .find(Boolean) as Kind | undefined;
  if (request.method !== "POST" || !kind) {
    reply.statusCode = 404;
    return void reply.end();
  }
  const release = await queues[kind](kinds[kind].ms);
  if (!release) {
    reply.statusCode = 503;
    return void reply.end("Busy: try again later");
  }
  try {
    await jobs[kind](url, request, reply);
  } catch (error) {
    if (!reply.headersSent)
      reply.statusCode = error instanceof TooBig ? 413 : 500;
    reply.end();
  } finally {
    release();
  }
});

if (import.meta.main) {
  server.listen(Number(process.env.PORT ?? 3900), "0.0.0.0");
  // As the container's first process, nothing stops it unless it stops itself.
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => process.exit(0));
}
