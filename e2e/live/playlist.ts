import type { Page } from "@playwright/test";
import { api } from "../helpers";

export const base = "/api/communities/unu-unu/playlists";

/** A playlist with "Har minunat", a divider, "Isus e Domn" and John 3:16. */
export async function servicePlaylist(page: Page) {
  const { body } = await api(page, "POST", base, { title: "Serviciu live" });
  const id = (body as { id: string }).id;
  for (const entry of [
    { kind: "song", songId: "grace" },
    { kind: "divider", text: "Predica" },
    { kind: "song", songId: "isus" },
    { kind: "bible", bible: { book: 43, chapter: 3, from: 16, to: 16 } },
  ])
    await api(page, "POST", `${base}/${id}/entries`, entry);
  return id;
}

export const rows = (page: Page) =>
  page.getByRole("grid", { name: "Entries" }).getByRole("row");
