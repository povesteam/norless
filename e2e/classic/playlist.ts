import { type Page } from "@playwright/test";
import { api } from "../helpers";

// The "clasic" community stays at step 1, Classic: the old Norless's flow.

export const base = "/api/communities/clasic/playlists";
/** A playlist of its own for a test that changes one: Lumina lumii, a divider, Doar harul Tău. */
export async function newPlaylist(page: Page, title: string) {
  const { body } = await api(page, "POST", base, { title });
  const id = (body as { id: string }).id;
  await api(page, "POST", `${base}/${id}/entries`, {
    kind: "song",
    songId: "lumina",
  });
  await api(page, "POST", `${base}/${id}/entries`, {
    kind: "divider",
    text: "Rugăciune",
  });
  await api(page, "POST", `${base}/${id}/entries`, {
    kind: "song",
    songId: "harul",
  });
  return id;
}
export const rows = (page: Page) =>
  page.getByRole("grid", { name: "Entries" }).getByRole("row");
export const slides = (page: Page) =>
  page.getByRole("list", { name: "Slides" });
