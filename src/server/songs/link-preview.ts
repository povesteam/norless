import { lookup } from "node:dns";
import { request } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import type { FastifyInstance } from "fastify";
import { requireRole } from "../auth/auth.js";
import { shrink } from "../converter.js";
import type { Db } from "../db/db.js";
import { newId } from "../ids.js";
import type { Community } from "./search.js";
import type { ReferenceLink } from "./songs.js";

/*
 * Reading a link's title and picture: Norless opens the page the
 * team links, so it must never be pointed at this machine or its networks. Only https,
 * only public addresses (checked on the address actually connected to, after each
 * redirect), 5 seconds and a size limit.
 */

const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
] as const)
  blocked.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
  ["::", 127], // unspecified and loopback
  ["64:ff9b::", 96], // NAT64
  ["2002::", 16], // 6to4
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const)
  blocked.addSubnet(network, prefix, "ipv6");
// IPv4 inside IPv6 (::ffff:127.0.0.1) is checked against the IPv4 networks by BlockList.

/** Whether an IP address is on the internet, not this machine or a private network. */
export function isPublic(address: string) {
  const family = isIP(address);
  return (
    family !== 0 && !blocked.check(address, family === 6 ? "ipv6" : "ipv4")
  );
}

/** DNS, refusing a name that leads to an address that isn't public. */
const publicLookup: LookupFunction = (hostname, options, callback) =>
  lookup(hostname, { ...options, all: true }, (error, addresses) => {
    const first = addresses?.[0];
    if (error || !first) return callback(error ?? new Error("No address"), []);
    if (addresses.some((a) => !isPublic(a.address)))
      return callback(new Error(`Not a public address: ${hostname}`), []);
    if (options.all) callback(null, addresses);
    else callback(null, first.address, first.family);
  });

export type Fetched = { url: string; type: string; body: Buffer };

/**
 * GETs a public https address, following up to 3 redirects. Past `maxBytes` it stops:
 * with what it has when `partial` (a page's head is enough), else with nothing.
 */
export function fetchPublic(
  address: string,
  {
    maxBytes = 512_000,
    partial = false,
    redirects = 3,
    timeoutMs = 5000,
  }: {
    maxBytes?: number;
    partial?: boolean;
    redirects?: number;
    timeoutMs?: number;
  } = {},
): Promise<Fetched | null> {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return Promise.resolve(null);
  }
  // An address written as numbers connects without DNS, so it's checked here.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (url.protocol !== "https:" || (isIP(host) && !isPublic(host)))
    return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = request(
      url,
      {
        lookup: publicLookup,
        headers: {
          "user-agent": "Norless/1 (+https://norless.com)",
          accept: "text/html,application/json,image/*;q=0.9",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        if (status >= 300 && status < 400 && location) {
          res.resume();
          clearTimeout(timer);
          resolve(
            redirects > 0
              ? fetchPublic(new URL(location, url).href, {
                  maxBytes,
                  partial,
                  redirects: redirects - 1,
                  timeoutMs,
                })
              : null,
          );
          return;
        }
        if (status !== 200) {
          res.resume();
          return resolve(null);
        }
        const chunks: Buffer[] = [];
        let size = 0;
        const done = () =>
          resolve({
            url: url.href,
            type: String(res.headers["content-type"] ?? ""),
            body: Buffer.concat(chunks),
          });
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size <= maxBytes) return void chunks.push(chunk);
          req.destroy();
          if (partial) done();
          else resolve(null);
        });
        res.on("end", done);
        res.on("error", () => resolve(null));
      },
    );
    const timer = setTimeout(() => req.destroy(), timeoutMs);
    req.on("close", () => clearTimeout(timer));
    req.on("error", () => resolve(null));
    req.end();
  });
}

const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};
const decode = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (!name.startsWith("#")) return entities[name.toLowerCase()] ?? whole;
    const code = /^#x/i.test(name)
      ? parseInt(name.slice(2), 16)
      : Number(name.slice(1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
const clean = (text: string, max = 200) =>
  text.replace(/\s+/g, " ").trim().slice(0, max);

/** A page's title, site name and picture: its Open Graph tags, else its <title>. */
export function pageInfo(html: string, base: string) {
  const meta = new Map<string, string>();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attribute = (name: string) => {
      const m = new RegExp(
        `\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
        "i",
      ).exec(tag);
      return m ? decode(m[1] ?? m[2] ?? m[3] ?? "") : null;
    };
    const key = (attribute("property") ?? attribute("name"))?.toLowerCase();
    const content = attribute("content");
    if (key && content !== null && !meta.has(key)) meta.set(key, content);
  }
  const title =
    meta.get("og:title") ??
    meta.get("twitter:title") ??
    decode(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? "");
  const image =
    meta.get("og:image") ??
    meta.get("og:image:url") ??
    meta.get("twitter:image");
  let picture: string | null = null;
  try {
    picture = image ? new URL(image, base).href : null;
  } catch {
    // Not an address: no picture.
  }
  return {
    title: clean(title),
    site: clean(meta.get("og:site_name") ?? "", 100),
    image: picture,
  };
}

const youTube = /^(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be)$/i;

/**
 * What a link is: YouTube through its oEmbed service (from Europe its pages first ask
 * about cookies), any other page from its tags.
 */
export async function previewOf(address: string) {
  const none = { title: "", site: "", image: null as string | null };
  const url = new URL(address);
  if (youTube.test(url.hostname)) {
    const got = await fetchPublic(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url.href)}`,
    );
    try {
      const data = got
        ? (JSON.parse(got.body.toString("utf8")) as {
            title?: string;
            thumbnail_url?: string;
          })
        : {};
      return {
        title: clean(data.title ?? ""),
        site: "YouTube",
        image: data.thumbnail_url ?? null,
      };
    } catch {
      return { ...none, site: "YouTube" };
    }
  }
  const page = await fetchPublic(url.href, { partial: true });
  if (!page?.type.includes("html")) return none;
  const head = page.body.subarray(0, 4000).toString("latin1");
  const charset =
    /charset=["']?([\w-]+)/i.exec(page.type)?.[1] ??
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ??
    "utf-8";
  let html: string;
  try {
    html = new TextDecoder(charset).decode(page.body);
  } catch {
    html = page.body.toString("utf8");
  }
  return pageInfo(html, page.url);
}

export function attachLinkPreviews(
  app: FastifyInstance,
  {
    db,
    findCommunity,
  }: { db: Db; findCommunity: (slug: string) => Community | undefined },
) {
  // The team and editors adding a link: its title, site and a copy of its picture.
  app.post<{ Params: { slug: string }; Body: { url: string } }>(
    "/api/communities/:slug/link-preview",
    {
      schema: {
        body: {
          type: "object",
          required: ["url"],
          additionalProperties: false,
          properties: {
            url: {
              type: "string",
              maxLength: 500,
              pattern: "^https://[^\\s]+$",
            },
          },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const userId = requireRole(db, request, reply, community.id, [
        "team",
        "editor",
      ]);
      if (!userId) return reply;
      const { url } = request.body;
      const info = await previewOf(url);
      const picture =
        info.image && (await fetchPublic(info.image, { maxBytes: 5_000_000 }));
      // Without the converter, the link is kept without its picture.
      const small =
        picture && (await shrink(picture.body, picture.type).catch(() => null));
      let image: string | null = null;
      if (small) {
        image = newId();
        db.prepare(
          "INSERT INTO images (id, content_type, data, created_at, created_by) VALUES (?, 'image/jpeg', ?, ?, ?)",
        ).run(image, small, new Date().toISOString(), userId);
      }
      // ponytail: a picture whose link is never saved stays; they're a few kilobytes.
      const link: ReferenceLink = {
        url,
        title: info.title,
        site: info.site,
        image,
      };
      return link;
    },
  );

  // Pictures Norless keeps, for anyone with the id: they never change.
  app.get<{ Params: { id: string } }>(
    "/api/images/:id",
    async (request, reply) => {
      const row = db
        .prepare("SELECT content_type AS type, data FROM images WHERE id = ?")
        .get(request.params.id) as { type: string; data: Buffer } | undefined;
      if (!row) return reply.code(404).send({ error: "Not found" });
      return reply
        .header("content-type", row.type)
        .header("cache-control", "public, max-age=31536000, immutable")
        .send(row.data);
    },
  );
}
