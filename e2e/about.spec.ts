import { expect, logInAs, openSteadyPage, test } from "./helpers";

test("every page links to About from its menu, with the license; screens don't", async ({
  page,
}) => {
  // A visitor: in the ⋯ menu beside Log in, and no footer, like an app.
  await openSteadyPage(page);
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: "About Norless" }).click();
  await expect(page).toHaveURL("/about");
  await expect(
    page.getByText(/GNU Affero General Public License/),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "The license (GNU AGPL 3.0)" }),
  ).toHaveAttribute("href", "https://www.gnu.org/licenses/agpl-3.0.html");

  await page.goto("/unu-unu/projector/ro");
  await expect(page.getByRole("link", { name: "About Norless" })).toHaveCount(
    0,
  );
});

test("the privacy page names who answers for the data, as the owner set it", async ({
  page,
}) => {
  await logInAs(page, "ana@example.com");
  await page.goto("/unu-unu/settings/privacy");
  const form = page.getByRole("region", { name: "Privacy notice" });
  await form.getByLabel("Who answers for the data").fill("Biserica UnuUnu");
  await form
    .getByLabel("Email for questions about personal data")
    .fill("contact@example.com");
  await form.getByRole("button", { name: "Save the contact" }).click();
  await expect(form.getByText("Saved")).toBeVisible();

  // A member: in My account's About tab.
  await page.getByRole("link", { name: "Ana", exact: true }).click();
  await page.getByRole("tab", { name: "About" }).click();
  await page.getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL("/privacy");
  await expect(
    page.getByRole("listitem").filter({ hasText: "Biserica UnuUnu" }),
  ).toContainText("contact@example.com");
  await expect(
    page.getByText(/Norless sets only the cookies it needs/),
  ).toBeVisible();
  await expect(page.getByText(/ANSPDCP/)).toBeVisible();
});
