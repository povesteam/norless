import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * A converter for unit tests: answers each job with made-up bytes that
 * say what was asked, keeps the jobs it got, and can be away (503). Its address becomes
 * `CONVERTER_URL`. The real jobs are tested against the container (`e2e/converter`).
 */
export async function stubConverter() {
  const jobs: { path: string; query: URLSearchParams; bytes: number }[] = [];
  let away = false;
  const server = createServer(async (request, reply) => {
    const url = new URL(request.url ?? "/", "http://stub");
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks);
    if (away) {
      reply.statusCode = 503;
      return void reply.end();
    }
    if (url.pathname === "/health") return void reply.end("ok");
    jobs.push({
      path: url.pathname,
      query: url.searchParams,
      bytes: body.length,
    });
    // A picture is what starts like a PNG or a JPEG.
    const picture =
      body.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) ||
      body.subarray(0, 2).equals(Buffer.from([0xff, 0xd8]));
    if (url.pathname === "/v1/pictures" && picture) {
      reply.setHeader("content-type", "image/jpeg");
      return void reply.end(
        `small picture ${url.searchParams.get("square") ?? 320}`,
      );
    }
    if (url.pathname === "/v1/recordings" && body.length > 0) {
      const form = new FormData();
      for (const [i, stretch] of (url.searchParams.get("stretches") ?? "")
        .split(",")
        .entries())
        form.append(
          "file",
          new Blob([`part ${stretch}\n${".".repeat(200)}`]),
          `${i + 1}.m4a`,
        );
      const response = new Response(form);
      reply.setHeader(
        "content-type",
        response.headers.get("content-type") ?? "",
      );
      return void reply.end(Buffer.from(await response.arrayBuffer()));
    }
    // Documents: a "PDF" says how many pages it has ("%PDF 3"), and a
    // locked one can't be opened.
    const pages = Number(/^%PDF (\d+)/.exec(body.toString())?.[1] ?? 0);
    const many = (from: number, to: number) => {
      const form = new FormData();
      for (let page = from; page <= to; page++)
        for (const width of [3840, 1280, 320])
          form.append(
            `${page}-${width}`,
            new Blob([`page ${page} at ${width}`]),
            `${page}-${width}.jpg`,
          );
      return new Response(form);
    };
    const answer = async (response: Response) => {
      reply.writeHead(response.status, Object.fromEntries(response.headers));
      reply.end(Buffer.from(await response.arrayBuffer()));
    };
    if (url.pathname === "/v1/documents/info" && pages)
      return void (await answer(Response.json({ pages })));
    if (url.pathname === "/v1/documents/pages" && pages)
      return void (await answer(
        many(
          Number(url.searchParams.get("from")),
          Number(url.searchParams.get("to")),
        ),
      ));
    if (url.pathname === "/v1/documents/picture" && picture)
      return void (await answer(many(1, 1)));
    reply.statusCode = 422;
    reply.end(
      url.pathname.startsWith("/v1/documents")
        ? "The file couldn't be opened"
        : "",
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.CONVERTER_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    jobs,
    away: (now: boolean) => {
      away = now;
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/** The first bytes of a PNG, which the stub converter takes for a picture. */
export const fakePng = () =>
  `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]).toString("base64")}`;
