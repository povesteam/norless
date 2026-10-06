import { type WebSocketRoute } from "@playwright/test";
import { expect, test } from "./helpers";

test("shows reconnecting while the server is unreachable, then hides", async ({
  page,
}) => {
  let reachable = true;
  let current: WebSocketRoute | undefined;
  await page.routeWebSocket("/api/live", (ws) => {
    current = ws;
    if (reachable) ws.connectToServer();
    else void ws.close();
  });
  const status = page.getByRole("status");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Norless" })).toBeVisible();
  expect(await status.count()).toBe(0); // no flash while connecting
  // Connected: nothing shows, even after the delay.
  await page.waitForTimeout(1500);
  await expect(status).toBeHidden();

  reachable = false;
  await current?.close();
  await expect(status).toHaveText("Reconnecting…");

  reachable = true;
  // Retries back off up to 5 seconds.
  await expect(status).toBeHidden({ timeout: 10_000 });
});

test("shows offline when the network is down", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Norless" })).toBeVisible();

  await context.setOffline(true);
  await expect(page.getByRole("status")).toHaveText("Offline");

  await context.setOffline(false);
  await expect(page.getByRole("status")).toBeHidden();
});
