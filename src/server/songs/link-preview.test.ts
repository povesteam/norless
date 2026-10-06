import { describe, expect, test } from "vitest";
import { fetchPublic, isPublic, pageInfo } from "./link-preview.js";

describe("link previews", () => {
  test("a page's Open Graph tags, else its title", () => {
    const html = `<html><head>
      <title>Ignored</title>
      <meta content="Har minunat &amp; altele" property="og:title">
      <meta property='og:site_name' content='Cântări'>
      <meta property="og:image" content="/pictures/har.jpg" />
    </head></html>`;
    expect(pageInfo(html, "https://example.org/songs/har")).toEqual({
      title: "Har minunat & altele",
      site: "Cântări",
      image: "https://example.org/pictures/har.jpg",
    });
    expect(
      pageInfo("<title>\n  Doar &#x219;i titlu </title>", "https://a.org/"),
    ).toEqual({ title: "Doar și titlu", site: "", image: null });
  });

  test("only public addresses", () => {
    for (const address of ["8.8.8.8", "2a00:1450:4001::200e"])
      expect(isPublic(address)).toBe(true);
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.20.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.100.1.1",
      "::1",
      "::",
      "::ffff:127.0.0.1",
      "fd00::1",
      "fe80::1",
      "not an address",
    ])
      expect(isPublic(address), address).toBe(false);
  });

  test("refuses what isn't a public https page, without connecting", async () => {
    for (const address of [
      "http://example.org/",
      "https://127.0.0.1/",
      "https://[::1]/",
      "https://169.254.169.254/latest/meta-data",
      "file:///etc/passwd",
      "not a link",
    ])
      expect(await fetchPublic(address), address).toBeNull();
    // A name that leads nowhere (or, on a local network, somewhere private).
    expect(await fetchPublic("https://localhost/")).toBeNull();
  });
});
