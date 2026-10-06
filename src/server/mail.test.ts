import { afterEach, expect, test, vi } from "vitest";
import { mailgun } from "./mail.js";

afterEach(() => vi.unstubAllGlobals());

test("Mailgun gets the message through its HTTP API, only when configured", async () => {
  expect(mailgun({})).toBeNull();
  const fetch = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  const send = mailgun({
    MAILGUN_API_KEY: "key-1",
    MAILGUN_DOMAIN: "mg.norless.com",
    MAIL_FROM: "Norless <login@norless.com>",
    MAILGUN_API_URL: "https://api.eu.mailgun.net",
    MAIL_REPLY_TO: "pavel@example.com",
  });
  expect(
    await send?.({ to: "ana@example.com", subject: "Hi", text: "Link" }),
  ).toBe(true);
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("https://api.eu.mailgun.net/v3/mg.norless.com/messages");
  expect((init.headers as Record<string, string>).authorization).toBe(
    `Basic ${Buffer.from("api:key-1").toString("base64")}`,
  );
  expect(String(init.body)).toContain("to=ana%40example.com");
  expect(String(init.body)).toContain("h%3AReply-To=pavel%40example.com");
});

test("a message's own Reply-To wins over MAIL_REPLY_TO", async () => {
  const fetch = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  const send = mailgun({
    MAILGUN_API_KEY: "key-1",
    MAILGUN_DOMAIN: "mg.norless.com",
    MAIL_FROM: "Norless <login@norless.com>",
    MAIL_REPLY_TO: "pavel@example.com",
  });
  await send?.({
    to: "pavel@example.com",
    subject: "Idea",
    text: "…",
    replyTo: "ana@example.com",
  });
  const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(String(init.body)).toContain("h%3AReply-To=ana%40example.com");
});
