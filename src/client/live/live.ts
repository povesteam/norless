import type { ClientMessage, ServerMessage } from "../../shared/live";

/** `connecting` is only the first attempt, before anything failed. */
export type LiveStatus =
  "connecting" | "connected" | "reconnecting" | "offline";

type Handler = (data: unknown) => void;

/**
 * The tab's live connection. It reconnects by itself, with backoff, and subscribes
 * again to every topic that still has a handler.
 */
export function createLive(
  url: string,
  { timeoutMs = 60_000, maxDelayMs = 5_000 } = {},
) {
  const handlers = new Map<string, Set<Handler>>();
  // Each topic's last event: the server sends a topic's state once, when the tab first
  // subscribes, so a second handler of the same topic starts from this.
  const last = new Map<string, unknown>();
  const listeners = new Set<() => void>();
  let status: LiveStatus = "connecting";
  let socket: WebSocket | null = null;
  let delay = 500;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const setStatus = (next: LiveStatus) => {
    if (status === next) return;
    status = next;
    for (const listener of listeners) listener();
  };
  const send = (message: object) => {
    if (socket?.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify(message));
  };

  /** Gives up on this socket and schedules the next attempt. */
  const drop = (ws: WebSocket) => {
    if (socket !== ws) return;
    socket = null;
    clearTimeout(watchdog);
    ws.close();
    if (stopped) return;
    setStatus(navigator.onLine === false ? "offline" : "reconnecting");
    // Jitter, so clients don't all come back at the same moment after a restart.
    retry = setTimeout(connect, delay / 2 + (Math.random() * delay) / 2);
    delay = Math.min(delay * 2, maxDelayMs);
  };

  function connect() {
    clearTimeout(retry);
    const ws = new WebSocket(url);
    socket = ws;
    // The server pings every 25 seconds; silence means the connection is gone.
    const alive = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => drop(ws), timeoutMs);
    };
    ws.onopen = () => {
      delay = 500;
      alive();
      setStatus("connected");
      for (const topic of handlers.keys()) send({ type: "subscribe", topic });
    };
    ws.onmessage = (event) => {
      alive();
      const message = JSON.parse(String(event.data)) as ServerMessage;
      if (message.type === "ping") send({ type: "pong" });
      else {
        if (handlers.has(message.topic)) last.set(message.topic, message.data);
        for (const handler of handlers.get(message.topic) ?? [])
          handler(message.data);
      }
    };
    ws.onclose = () => drop(ws);
  }

  /** Tries again right away, e.g. when the network or the page comes back. */
  const retryNow = () => {
    if (stopped || status === "connected") return;
    if (socket) drop(socket);
    clearTimeout(retry);
    delay = 500;
    connect();
  };

  if (typeof window !== "undefined") {
    window.addEventListener("online", retryNow);
    window.addEventListener("offline", () => setStatus("offline"));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") retryNow();
    });
  }
  connect();

  return {
    status: () => status,
    /** Calls the listener on every status change; returns the unsubscribe function. */
    onStatus(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    /** Calls the handler with each event of the topic; returns the unsubscribe function. */
    subscribe(topic: string, handler: Handler) {
      const set = handlers.get(topic) ?? new Set();
      if (set.size === 0) send({ type: "subscribe", topic });
      else if (last.has(topic)) {
        const data = last.get(topic);
        queueMicrotask(() => {
          if (set.has(handler)) handler(data);
        });
      }
      handlers.set(topic, set.add(handler));
      return () => {
        set.delete(handler);
        if (set.size > 0) return;
        handlers.delete(topic);
        last.delete(topic);
        send({ type: "unsubscribe", topic });
      };
    },
    /** Sends a message if connected; others are dropped, so send state again on change. */
    send: (message: ClientMessage) => send(message),
    close() {
      stopped = true;
      clearTimeout(retry);
      if (socket) drop(socket);
    },
  };
}

export type LiveConnection = ReturnType<typeof createLive>;
