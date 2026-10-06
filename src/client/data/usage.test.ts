import { expect, test, vi } from "vitest";
import type { UsageBatch } from "../../shared/usage";
import { createUsage } from "./usage";

// No live connection in these tests: the community's live updates are never started.
vi.mock("./connection", () => ({ live: {} }));

test("queues events with their community and layout, and sends them in batches of 100 with how long ago they happened", () => {
  const sent: UsageBatch[] = [];
  let now = 1_000;
  const usage = createUsage((batch) => sent.push(batch), {
    now: () => now,
    deviceType: () => "phone",
  });

  usage.flush();
  expect(sent).toEqual([]);

  usage.track("error.shown", { page: "/login" });
  usage.context.community = "unu-unu";
  usage.context.layout = "classic";
  now = 4_000;
  usage.track("live.go", { via: "double-click" });
  for (let i = 0; i < 99; i++) usage.track("live.next", { via: "clicker" });
  now = 9_000;
  usage.flush();

  expect(sent.map((b) => b.events.length)).toEqual([100, 1]);
  expect(sent[0]?.deviceType).toBe("phone");
  expect(sent[0]?.events.slice(0, 2)).toEqual([
    { feature: "error.shown", ago: 8_000, detail: { page: "/login" } },
    {
      feature: "live.go",
      community: "unu-unu",
      layout: "classic",
      ago: 5_000,
      detail: { via: "double-click" },
    },
  ]);

  // Sent once.
  usage.flush();
  expect(sent).toHaveLength(2);
});

test("keeps at most 500 events while they can't be sent", () => {
  const sent: UsageBatch[] = [];
  const usage = createUsage((batch) => sent.push(batch));
  for (let i = 0; i < 600; i++) usage.track("layout.shown");
  usage.flush();
  expect(sent.flatMap((b) => b.events)).toHaveLength(500);
});
