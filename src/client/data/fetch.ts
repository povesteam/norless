import { useCallback, useEffect, useState } from "react";

/**
 * GETs JSON from the API. `data` is undefined before the first answer, and null when the
 * thing doesn't exist or isn't the person's to see (404, 401, 403). While another URL loads,
 * it keeps the last answer. `failed` is set when the server didn't answer or answered
 * with an error, until `retry` or another load succeeds. `fresh` is whether `data` is
 * the answer for this URL. A null URL fetches nothing, and a new `version` fetches the
 * same URL again.
 */
export function useJson<T>(url: string | null, version = 0) {
  const [data, setData] = useState<T | null>();
  const [answered, setAnswered] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (url === null) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (response.ok) setData((await response.json()) as T);
        else if ([401, 403, 404].includes(response.status)) setData(null);
        else throw new Error(`HTTP ${response.status}`);
        setAnswered(url);
        setFailed(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [url, version, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, failed, retry, fresh: answered === url };
}

/** Sends JSON to the API and returns the response, or null when the server didn't answer. */
export const send = (
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  body?: unknown,
) =>
  fetch(url, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
