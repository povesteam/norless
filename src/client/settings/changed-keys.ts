/** A JSON object stored in a text column, else null. */
export function objectOf(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string" || !value.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * The keys whose values differ between two stored objects, with both values
 * (`undefined` where a side lacks the key), in the order they first appear.
 */
export function changedKeys(
  from: Record<string, unknown> | null,
  to: Record<string, unknown> | null,
): [string, unknown, unknown][] {
  const keys = new Set([...Object.keys(from ?? {}), ...Object.keys(to ?? {})]);
  return [...keys]
    .map((key): [string, unknown, unknown] => [key, from?.[key], to?.[key]])
    .filter(([, a, b]) => JSON.stringify(a) !== JSON.stringify(b));
}

/**
 * A JSON list stored in a text column, as short labels: a text's first line, an
 * object's title, name or address (owners saw the raw JSON).
 */
export function listOf(value: unknown): string[] | null {
  if (typeof value !== "string" || !value.startsWith("[")) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.map((item: unknown) => {
      if (typeof item === "string")
        return (item.split("\n")[0] ?? "").replace(/^#+\s*/, "");
      if (item && typeof item === "object") {
        const { title, name, url } = item as Record<string, unknown>;
        return String(title ?? name ?? url ?? "");
      }
      return String(item);
    });
  } catch {
    return null;
  }
}

type Folded = {
  at: string;
  user: { id: string } | null;
  table: string;
  rowId: string;
  action: string;
  changed: Record<string, [unknown, unknown]> | null;
};

/**
 * One person's updates of one record within a minute of each other, newest first, as
 * one: from the oldest's values to the newest's, and gone when they cancel out, such as
 * a feature switched on and off again.
 */
export function foldChanges<C extends Folded>(changes: C[]): C[] {
  const folded: C[] = [];
  for (const older of changes) {
    const newer = folded.at(-1);
    if (
      !newer ||
      newer.action !== "update" ||
      older.action !== "update" ||
      newer.table !== older.table ||
      newer.rowId !== older.rowId ||
      newer.user?.id !== older.user?.id ||
      Date.parse(newer.at) - Date.parse(older.at) > 60_000
    ) {
      folded.push(older);
      continue;
    }
    const columns = new Set([
      ...Object.keys(older.changed ?? {}),
      ...Object.keys(newer.changed ?? {}),
    ]);
    const changed = Object.fromEntries(
      [...columns]
        .map((column): [string, [unknown, unknown]] => [
          column,
          [
            (older.changed?.[column] ?? newer.changed?.[column])?.[0],
            (newer.changed?.[column] ?? older.changed?.[column])?.[1],
          ],
        ])
        .filter(
          ([, [from, to]]) => JSON.stringify(from) !== JSON.stringify(to),
        ),
    );
    folded.pop();
    if (Object.keys(changed).length > 0) folded.push({ ...newer, changed });
  }
  return folded;
}
