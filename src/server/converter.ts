import { openAsBlob } from "node:fs";

/*
 * The converter (`src/converter/`): files from people and from the
 * internet are read there, apart from the database and the stored files. Each job sends
 * its file and gets the results back; nothing is shared but the bytes.
 */

/** This environment's converter; development and tests run its container on 3900. */
export const converterUrl = () =>
  process.env.CONVERTER_URL ?? "http://127.0.0.1:3900";

/** The converter can't take the job now (down, or busy past the job's wait): try later. */
export class ConverterAway extends Error {
  constructor() {
    super("The converter is unreachable");
  }
}

/** The converter refused the file: it isn't what it says it is, and why. */
export class Refused extends Error {}

/** Sends a job; throws Refused when the converter can't read the file, ConverterAway while it can't take it. */
async function job(path: string, body: Blob | Buffer) {
  let response: Response;
  try {
    response = await fetch(`${converterUrl()}/v1/${path}`, {
      method: "POST",
      body: body instanceof Blob ? body : new Uint8Array(body),
    });
  } catch {
    throw new ConverterAway();
  }
  if (response.status === 503) throw new ConverterAway();
  if (response.ok) return response;
  throw new Refused(
    response.status === 422 ? await response.text() : `${response.status}`,
  );
}

/** A job's result, null when the file was refused. */
const unlessRefused = <T>(result: Promise<T>) =>
  result.catch((error: unknown) => {
    if (error instanceof Refused) return null;
    throw error;
  });

/**
 * A picture made small, as a JPEG at most 320 pixels wide, or a square cut from its
 * middle (avatars); null for what isn't a picture. Throws ConverterAway.
 */
export async function shrink(
  picture: Buffer,
  type: string,
  { square }: { square?: number } = {},
) {
  const query = new URLSearchParams({
    type: type.split(";")[0]?.trim().toLowerCase() ?? "",
  });
  if (square) query.set("square", String(square));
  return unlessRefused(
    job(`pictures?${query}`, picture).then(async (response) =>
      Buffer.from(await response.arrayBuffer()),
    ),
  );
}

/**
 * A recording cut into stretches (milliseconds, the last one open to the end), a file
 * each in m4a; null when the converter can't read it. Throws ConverterAway.
 */
export async function cutRecording(
  file: string,
  ext: string,
  stretches: { start: number; end: number | null }[],
) {
  const query = new URLSearchParams({
    ext,
    stretches: stretches.map((s) => `${s.start}-${s.end ?? ""}`).join(","),
  });
  return unlessRefused(
    job(`recordings?${query}`, await openAsBlob(file)).then(
      async (response) => {
        // ponytail: the files are held in memory at once (about 1 MB a minute of
        // recording); stream the parts to disk if rehearsals grow past a few hours.
        const parts = (await response.formData()).getAll("file");
        return Promise.all(
          parts.map(async (part) =>
            Buffer.from(await (part as Blob).arrayBuffer()),
          ),
        );
      },
    ),
  );
}

/** Pages drawn by the converter, by "page-width" ("3-1280"). */
const pagesFrom = async (response: Response) =>
  new Map(
    await Promise.all(
      [...(await response.formData())].map(
        async ([name, part]) =>
          [name, Buffer.from(await (part as Blob).arrayBuffer())] as const,
      ),
    ),
  );

/**
 * Slides from files, a step at a time. Each throws Refused with the
 * converter's reason ("The file couldn't be opened") and ConverterAway.
 */
export const documents = {
  /** A PDF's page count. */
  info: async (pdf: string) =>
    (
      (await (
        await job("documents/info?type=pdf", await openAsBlob(pdf))
      ).json()) as { pages: number }
    ).pages,
  /** Pages `from` to `to` of a PDF, at each width. */
  pages: async (pdf: string, from: number, to: number) =>
    pagesFrom(
      await job(
        `documents/pages?type=pdf&from=${from}&to=${to}`,
        await openAsBlob(pdf),
      ),
    ),
  /** A picture as one page, at each width. */
  picture: async (file: string, type: string) =>
    pagesFrom(
      await job(
        `documents/picture?type=${encodeURIComponent(type)}`,
        await openAsBlob(file),
      ),
    ),
};

const MINUTE = 60_000;

/** When the converter was last seen away, and whether the app team was told. */
export type Watch = { awaySince: number | null; told: boolean };

/**
 * One check's news for the app team: "away" once it's been unreachable for 5 minutes,
 * "back" once it answers again after that (operations spec).
 */
export function converterNews(
  watch: Watch,
  ok: boolean,
  now: number,
): { watch: Watch; news: "away" | "back" | null } {
  if (ok)
    return {
      watch: { awaySince: null, told: false },
      news: watch.told ? "back" : null,
    };
  const awaySince = watch.awaySince ?? now;
  const due = !watch.told && now - awaySince >= 5 * MINUTE;
  return {
    watch: { awaySince, told: watch.told || due },
    news: due ? "away" : null,
  };
}

/** Checks the converter every minute and tells the app team; returns the stop. */
export function watchConverter(tell: (subject: string, text: string) => void) {
  let watch: Watch = { awaySince: null, told: false };
  const check = async () => {
    const ok = await fetch(`${converterUrl()}/health`, {
      signal: AbortSignal.timeout(5000),
    }).then(
      (response) => response.ok,
      () => false,
    );
    const step = converterNews(watch, ok, Date.now());
    watch = step.watch;
    if (step.news === "away")
      tell(
        "the converter is unreachable for 5 minutes",
        "Recordings wait to be cut into songs, and new pictures are skipped, until it's back. `docker compose ps` and its log say why.",
      );
    if (step.news === "back")
      tell(
        "the converter is back",
        "Waiting recordings are cut into songs now.",
      );
  };
  const timer = setInterval(() => void check(), MINUTE);
  timer.unref();
  return () => clearInterval(timer);
}
