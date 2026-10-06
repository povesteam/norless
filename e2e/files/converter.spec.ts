// The converter's own tests, against its container on 3901, which the
// e2e run starts (playwright.config.ts). Files are made here, so no tool is needed
// outside the container.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { png, wav } from "./make";

const converter = "http://127.0.0.1:3901";

/** A JPEG's width and height, from its frame header. */
function jpegSize(jpeg: Buffer) {
  const at = jpeg.indexOf(Buffer.from([0xff, 0xc0]));
  return [jpeg.readUInt16BE(at + 7), jpeg.readUInt16BE(at + 5)];
}

/** An m4a's duration in seconds, from its movie header. */
function m4aSeconds(m4a: Buffer) {
  const at = m4a.indexOf("mvhd");
  return m4a.readUInt32BE(at + 20) / m4a.readUInt32BE(at + 16);
}

test("a picture is made small, or a square from its middle", async ({
  request,
}) => {
  const picture = png(600, 400);
  const small = await request.post(`${converter}/v1/pictures?type=image/png`, {
    data: picture,
  });
  expect(small.headers()["content-type"]).toBe("image/jpeg");
  expect(jpegSize(await small.body())).toEqual([320, 214]);
  const square = await request.post(
    `${converter}/v1/pictures?type=image/png&square=256`,
    { data: picture },
  );
  expect(jpegSize(await square.body())).toEqual([256, 256]);
});

test("what isn't a picture of its type, or is too big, is refused", async ({
  request,
}) => {
  for (const [type, data] of [
    ["text/html", Buffer.from("<html>")],
    ["image/png", Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>")],
  ] as const)
    expect(
      (
        await request.post(`${converter}/v1/pictures?type=${type}`, { data })
      ).status(),
    ).toBe(422);
  expect(
    (
      await request.post(`${converter}/v1/pictures?type=image/png`, {
        data: Buffer.alloc(21e6),
      })
    ).status(),
  ).toBe(413);
});

test("a recording is cut into its stretches, a file each", async ({
  request,
}) => {
  const response = await request.post(
    `${converter}/v1/recordings?ext=wav&stretches=0-2000,2000-`,
    { data: wav(6) },
  );
  expect(response.ok()).toBe(true);
  const form = await new Response(new Uint8Array(await response.body()), {
    headers: { "content-type": response.headers()["content-type"] ?? "" },
  }).formData();
  const files = await Promise.all(
    form
      .getAll("file")
      .map(async (file) => Buffer.from(await (file as Blob).arrayBuffer())),
  );
  expect(files).toHaveLength(2);
  expect(m4aSeconds(files[0] ?? Buffer.alloc(0))).toBeCloseTo(2, 0);
  expect(m4aSeconds(files[1] ?? Buffer.alloc(0))).toBeCloseTo(4, 0);
  // Garbage isn't a recording.
  expect(
    (
      await request.post(`${converter}/v1/recordings?ext=webm&stretches=0-`, {
        data: Buffer.from("not audio"),
      })
    ).status(),
  ).toBe(422);
});

/** A multipart answer's parts, by name. */
async function partsOf(response: {
  body: () => Promise<Buffer>;
  headers: () => Record<string, string>;
}) {
  const form = await new Response(new Uint8Array(await response.body()), {
    headers: { "content-type": response.headers()["content-type"] ?? "" },
  }).formData();
  return new Map(
    await Promise.all(
      [...form].map(
        async ([name, part]) =>
          [name, Buffer.from(await (part as Blob).arrayBuffer())] as const,
      ),
    ),
  );
}

test("a PDF is counted and drawn page by page at each width; presentations aren't read", async ({
  request,
}) => {
  const pdf = readFileSync("e2e/files/slides.pdf");
  const info = await request.post(`${converter}/v1/documents/info?type=pdf`, {
    data: pdf,
  });
  expect(await info.json()).toEqual({ pages: 2 });
  const pages = await partsOf(
    await request.post(`${converter}/v1/documents/pages?type=pdf&from=1&to=2`, {
      data: pdf,
    }),
  );
  expect([...pages.keys()].sort()).toEqual(
    ["1-1280", "1-320", "1-3840", "2-1280", "2-320", "2-3840"].sort(),
  );
  expect(jpegSize(pages.get("2-3840") ?? Buffer.alloc(0))[0]).toBe(3840);
  expect(jpegSize(pages.get("1-320") ?? Buffer.alloc(0))[0]).toBe(320);
  // Presentations are added as a PDF exported from them.
  const presentation = await request.post(
    `${converter}/v1/documents/pdf?type=pptx`,
    { data: Buffer.from("PK") },
  );
  expect(presentation.status()).toBe(404);
});

test("a picture is fitted to each width, never enlarged; a broken PDF is refused", async ({
  request,
}) => {
  const pages = await partsOf(
    await request.post(`${converter}/v1/documents/picture?type=image/png`, {
      data: png(800, 600),
    }),
  );
  expect(jpegSize(pages.get("1-3840") ?? Buffer.alloc(0))).toEqual([800, 600]);
  expect(jpegSize(pages.get("1-320") ?? Buffer.alloc(0))).toEqual([320, 240]);
  const broken = await request.post(`${converter}/v1/documents/info?type=pdf`, {
    data: Buffer.from("%PDF-1.4 broken"),
  });
  expect(broken.status()).toBe(422);
  expect(await broken.text()).toBe("The file couldn't be opened");
});
