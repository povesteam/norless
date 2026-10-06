import type { FastifyInstance } from "fastify";
import { type WebSocket, WebSocketServer } from "ws";
import { type Simulation, slowSend } from "./simulate.js";
import type { ClientMessage, ServerMessage } from "../../shared/live.js";
import { type SessionUser, sameOrigin, userFromCookie } from "../auth/auth.js";
import type { Db } from "../db/db.js";

/** One open connection, and who opened it. */
export type Client = {
  user: SessionUser | null;
  /** The browser's User-Agent, e.g. to tell phones from computers. */
  userAgent: string;
  /** The internet address it connects from, e.g. to tell devices on the same wifi. */
  address: string;
  send(message: ServerMessage): void;
};

export type Live = {
  publish(topic: string, data: unknown): void;
  /**
   * Runs when a client subscribes to a topic starting with `prefix`: it may send the
   * client the topic's current state, and returns whether the client may follow it.
   */
  onSubscribe(
    prefix: string,
    handler: (topic: string, client: Client) => boolean,
  ): void;
  /** Handles client messages of a type other than subscribe, unsubscribe and pong. */
  onMessage(
    type: string,
    handler: (client: Client, message: ClientMessage) => void,
  ): void;
  /**
   * Runs when a client stops following a topic starting with `prefix`: it unsubscribed,
   * or it disconnected.
   */
  onUnsubscribe(
    prefix: string,
    handler: (topic: string, client: Client) => void,
  ): void;
  onClose(handler: (client: Client) => void): void;
};

const MAX_TOPICS = 100;
const MAX_TOPIC_LENGTH = 200;

/**
 * The live connection at /api/live: clients subscribe to topics, and the server
 * pushes events to every subscriber. Topics live in memory (one server process).
 * Connections from other sites are refused, and each knows its session's user.
 */
export function attachLive(
  app: FastifyInstance,
  {
    db,
    heartbeatMs = 25_000,
    timeoutMs = 60_000,
    simulation,
    trustProxy = false,
  }: {
    db: Db;
    /** Behind a proxy (Caddy) that sets X-Forwarded-For. */
    trustProxy?: boolean;
    heartbeatMs?: number;
    timeoutMs?: number;
    /** A slow or bad network, locally. */
    simulation?: Simulation;
  },
): Live {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  const subscribers = new Map<string, Set<Client>>();
  const sockets = new Map<Client, { ws: WebSocket; lastSeen: number }>();
  const subscribeHandlers: [
    string,
    (topic: string, client: Client) => boolean,
  ][] = [];
  const handlers = new Map<
    string,
    (client: Client, message: ClientMessage) => void
  >();
  const closeHandlers: ((client: Client) => void)[] = [];
  const unsubscribeHandlers: [
    string,
    (topic: string, client: Client) => void,
  ][] = [];
  const unsubscribe = (client: Client, topic: string) => {
    const set = subscribers.get(topic);
    if (!set?.delete(client)) return;
    if (set.size === 0) subscribers.delete(topic);
    for (const [prefix, handler] of unsubscribeHandlers)
      if (topic.startsWith(prefix)) handler(topic, client);
  };

  app.server.on("upgrade", (request, socket, head) => {
    if (new URL(request.url ?? "/", "http://host").pathname !== "/api/live")
      return socket.destroy();
    if (!sameOrigin(request.headers)) {
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }
    const user = userFromCookie(db, request.headers.cookie);
    wss.handleUpgrade(request, socket, head, (ws) => {
      const raw = (data: string) => ws.send(data);
      const deliver = simulation?.slow ? slowSend(raw) : raw;
      const client: Client = {
        user,
        userAgent: request.headers["user-agent"] ?? "",
        address:
          (trustProxy &&
            String(request.headers["x-forwarded-for"] ?? "")
              .split(",")[0]
              ?.trim()) ||
          request.socket.remoteAddress ||
          "",
        send: (message) => deliver(JSON.stringify(message)),
      };
      if (simulation?.flaky) {
        const drop = setTimeout(
          () => ws.terminate(),
          60_000 + Math.random() * 60_000,
        );
        ws.on("close", () => clearTimeout(drop));
      }
      const topics = new Set<string>();
      sockets.set(client, { ws, lastSeen: Date.now() });

      ws.on("message", (raw) => {
        const entry = sockets.get(client);
        if (entry) entry.lastSeen = Date.now();
        let message: ClientMessage | null;
        try {
          message = JSON.parse(String(raw)) as ClientMessage | null;
        } catch {
          return;
        }
        if (message?.type !== "subscribe" && message?.type !== "unsubscribe") {
          if (typeof message?.type === "string")
            handlers.get(message.type)?.(client, message);
          return;
        }
        const { topic } = message;
        if (typeof topic !== "string" || topic.length > MAX_TOPIC_LENGTH)
          return;
        if (message.type === "unsubscribe") {
          topics.delete(topic);
          return unsubscribe(client, topic);
        }
        const handler = subscribeHandlers.find(([prefix]) =>
          topic.startsWith(prefix),
        );
        if (
          topics.size >= MAX_TOPICS ||
          (handler && !handler[1](topic, client))
        )
          return;
        topics.add(topic);
        subscribers.set(
          topic,
          (subscribers.get(topic) ?? new Set()).add(client),
        );
      });

      // Oversized or malformed frames; ws closes the socket after this.
      ws.on("error", () => ws.terminate());

      ws.on("close", () => {
        sockets.delete(client);
        for (const topic of topics) unsubscribe(client, topic);
        for (const handler of closeHandlers) handler(client);
      });
    });
  });

  // Browsers don't expose ping frames, so both sides watch for messages instead.
  const heartbeat = setInterval(() => {
    const now = Date.now();
    for (const [client, { ws, lastSeen }] of sockets) {
      if (now - lastSeen > timeoutMs) ws.terminate();
      else client.send({ type: "ping" });
    }
  }, heartbeatMs);
  heartbeat.unref();

  // Open sockets would keep the HTTP server from closing; clients reconnect.
  app.addHook("preClose", async () => {
    clearInterval(heartbeat);
    for (const { ws } of sockets.values()) ws.terminate();
  });

  return {
    publish(topic, data) {
      for (const client of subscribers.get(topic) ?? [])
        client.send({ type: "event", topic, data });
    },
    onSubscribe: (prefix, handler) =>
      void subscribeHandlers.push([prefix, handler]),
    onMessage: (type, handler) => void handlers.set(type, handler),
    onUnsubscribe: (prefix, handler) =>
      void unsubscribeHandlers.push([prefix, handler]),
    onClose: (handler) => void closeHandlers.push(handler),
  };
}
