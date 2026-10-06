import Fastify from "fastify";
import { afterEach, expect, test, vi } from "vitest";
import { attachSimulation, simulationFromEnv, slowSend } from "./simulate.js";

afterEach(() => vi.restoreAllMocks());

test("SLOW and FLAKY switch it on, never in production", () => {
  expect(simulationFromEnv({})).toBeUndefined();
  expect(simulationFromEnv({ SLOW: "1" })).toEqual({
    slow: true,
    flaky: false,
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(
    simulationFromEnv({ SLOW: "1", FLAKY: "1", NODE_ENV: "production" }),
  ).toBeUndefined();
});

test("slow API answers wait; flaky ones fail now and then, but not the health check", async () => {
  const app = Fastify();
  attachSimulation(app, { slow: true, flaky: true });
  app.get("/api/thing", async () => ({ ok: true }));
  app.get("/api/health", async () => ({ status: "ok" }));
  // The shortest delay, then a roll that fails.
  vi.spyOn(Math, "random").mockReturnValue(0);
  const started = Date.now();
  expect((await app.inject({ url: "/api/thing" })).statusCode).toBe(503);
  expect(Date.now() - started).toBeGreaterThanOrEqual(290);
  expect((await app.inject({ url: "/api/health" })).statusCode).toBe(200);
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  expect((await app.inject({ url: "/api/thing" })).statusCode).toBe(200);
});

test("slow live updates keep their order", () => {
  vi.useFakeTimers();
  const sent: string[] = [];
  const send = slowSend((data) => sent.push(data));
  const rolls = [0.9, 0];
  vi.spyOn(Math, "random").mockImplementation(() => rolls.shift() ?? 0);
  send("first"); // held back about 1.4 s
  send("second"); // would be 0.3 s, but waits for the first
  vi.advanceTimersByTime(2000);
  expect(sent).toEqual(["first", "second"]);
  vi.useRealTimers();
});
