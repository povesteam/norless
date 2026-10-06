import type { FastifyInstance } from "fastify";

/**
 * Trying the app locally as on a real network, so placeholders,
 * spinners, error notices and the reconnect status can be seen. `slow` delays every API
 * answer and live update by 300 to 1500 ms; `flaky` fails about 1 in 10 API calls and
 * drops each live connection after 1 to 2 minutes.
 */
export type Simulation = { slow: boolean; flaky: boolean };

/** SLOW=1 and FLAKY=1, never in production. */
export function simulationFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Simulation | undefined {
  const slow = env.SLOW === "1";
  const flaky = env.FLAKY === "1";
  if (!slow && !flaky) return undefined;
  if (env.NODE_ENV === "production") {
    console.warn("SLOW and FLAKY are ignored in production.");
    return undefined;
  }
  return { slow, flaky };
}

/** How long one answer or update is held back. */
export const delayMs = () => 300 + Math.random() * 1200;

export function attachSimulation(app: FastifyInstance, simulation: Simulation) {
  app.addHook("onRequest", async (request, reply) => {
    // The health check stays honest, for the deploy script.
    if (!request.url.startsWith("/api/") || request.url === "/api/health")
      return;
    if (simulation.slow)
      await new Promise((resolve) => setTimeout(resolve, delayMs()));
    if (simulation.flaky && Math.random() < 0.1)
      return reply.code(503).send({ error: "A simulated failure (FLAKY=1)" });
  });
}

/**
 * A live connection's send, held back by a delay each time but never reordered, as
 * on a slow network.
 */
export function slowSend(send: (data: string) => void) {
  let last = 0;
  return (data: string) => {
    last = Math.max(Date.now() + delayMs(), last);
    setTimeout(() => send(data), last - Date.now());
  };
}
