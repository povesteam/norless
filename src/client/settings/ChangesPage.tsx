import { FileClock } from "lucide-react";
import { Button, Chip } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Change } from "../../server/changes";
import { changeKinds } from "../../shared/changes";
import { useCommunity } from "../data/community";
import { useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import { TextDiff } from "../songs/SongHistory";
import { changedKeys, foldChanges, listOf, objectOf } from "./changed-keys";
import { Choice } from "../songs/Statistics";
import { Empty, ErrorNotice, Placeholder } from "../ui/states";
import { clock } from "../ui/time";

type Page = { changes: Change[]; more: boolean };

/**
 * /<community>/changes, for owners: who changed what and when, newest
 * first, by person and kind, with each change's before and after.
 */
export function ChangesPage() {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const [person, setPerson] = useState("all");
  const [kind, setKind] = useState("all");
  // Each "Older" adds a page that starts where the last one ended.
  const [pages, setPages] = useState<(string | null)[]>([null]);
  const people = useJson<{ id: string; name: string }[]>(
    `/api/communities/${slug}/changes/people`,
    useChanges(slug, "changes"),
  ).data;
  const filter = (next: () => void) => {
    next();
    setPages([null]);
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 text-2xl font-semibold">
        <FileClock />
        {t("changes.title")}
      </h2>
      <p className="text-sm text-muted">{t("changes.help")}</p>
      <div className="flex flex-wrap items-end gap-3">
        <Choice
          label={t("changes.person")}
          value={person}
          onChange={(id) => filter(() => setPerson(id))}
          options={[
            ["all", t("changes.everyone")],
            ...(people ?? []).map((p): [string, string] => [
              p.id,
              p.name || t("changes.deleted"),
            ]),
          ]}
        />
        <Choice
          label={t("changes.kind")}
          value={kind}
          onChange={(id) => filter(() => setKind(id))}
          options={[
            ["all", t("changes.kinds.all")],
            ...changeKinds.map((k): [string, string] => [
              k,
              t(`changes.kinds.${k}`),
            ]),
          ]}
        />
      </div>
      {pages.map((before, i) => (
        <ChangesPart
          key={before ?? "first"}
          slug={slug}
          person={person}
          kind={kind}
          before={before}
          onOlder={
            i === pages.length - 1
              ? (at) => setPages([...pages, at])
              : undefined
          }
        />
      ))}
    </div>
  );
}

/** One page of changes, and Older under the last one. */
function ChangesPart({
  slug,
  person,
  kind,
  before,
  onOlder,
}: {
  slug: string;
  person: string;
  kind: string;
  before: string | null;
  onOlder?: (at: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const query = new URLSearchParams();
  if (person !== "all") query.set("user", person);
  if (kind !== "all") query.set("kind", kind);
  if (before) query.set("before", before);
  const { data, failed, retry } = useJson<Page>(
    `/api/communities/${slug}/changes?${query}`,
    useChanges(slug, "changes"),
  );
  if (data === null) return <p>{t("changes.ownersOnly")}</p>;
  if (!data)
    return failed ? (
      <ErrorNotice message={t("states.loadFailed")} onRetry={retry} />
    ) : (
      <Placeholder lines={8} />
    );
  if (!data.changes.length && !before)
    return (
      <Empty
        title={t("changes.empty")}
        description={t(
          person === "all" && kind === "all"
            ? "changes.emptyHelp"
            : "changes.emptyFiltered",
        )}
      />
    );
  const day = (at: string) =>
    new Date(at).toLocaleDateString(i18n.language, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  const last = data.changes.at(-1);
  const changes = foldChanges(data.changes);
  return (
    <>
      <ol className="flex flex-col gap-2">
        {changes.map((change, i) => (
          <li key={change.id} className="flex flex-col gap-2">
            {day(change.at) !== day(changes[i - 1]?.at ?? before ?? "") && (
              <h3 className="mt-2 font-semibold first-letter:uppercase">
                {day(change.at)}
              </h3>
            )}
            <ChangeRow change={change} />
          </li>
        ))}
      </ol>
      {data.more && last && onOlder && (
        <Button variant="secondary" onPress={() => onOlder(last.at)}>
          {t("changes.older")}
        </Button>
      )}
    </>
  );
}

/** What a change did: removing and restoring are updates of `deleted_at`. */
const actionOf = (change: Change) => {
  const removed = change.changed?.deleted_at;
  if (removed) return removed[1] ? "remove" : "restore";
  return change.action === "delete" ? "remove" : change.action;
};

// Columns the row's sentence already says, or that only mean "moved".
const said = new Set(["deleted_at", "position"]);

function ChangeRow({ change }: { change: Change }) {
  const { t, i18n } = useTranslation();
  const action = actionOf(change);
  const fields = Object.entries(change.changed ?? {}).filter(
    ([column]) => !said.has(column),
  );
  const moved = !!change.changed?.position;
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-separator p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted tabular-nums">
          {clock(change.at, i18n.language)}
        </span>
        <span className="font-semibold">
          {change.user
            ? change.user.name || t("changes.deleted")
            : t("changes.norless")}
        </span>
        <Chip
          size="sm"
          variant="soft"
          color={
            action === "remove"
              ? "danger"
              : action === "insert"
                ? "success"
                : "default"
          }
        >
          {t(`changes.actions.${action}`)}
        </Chip>
        <span>
          {t(`changes.tables.${change.table}`, {
            defaultValue: change.table,
          })}
          {change.label && <> · {change.label}</>}
        </span>
        {moved && (
          <span className="text-sm text-muted">{t("changes.moved")}</span>
        )}
      </div>
      {fields.length > 0 && (
        <dl className="flex flex-col gap-1 text-sm">
          {fields.map(([column, [from, to]]) => (
            <div key={column} className="flex flex-col gap-1">
              <dt className="text-muted">
                {t(`changes.fields.${column}`, {
                  defaultValue: column.replace(/_/g, " "),
                })}
              </dt>
              <dd>
                <Value column={column} from={from} to={to} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/**
 * A changed value: a stored object as its changed keys, long text as a diff, lists
 * joined, the rest as before → after.
 */
function Value({
  column,
  from,
  to,
}: {
  column: string;
  from: unknown;
  to: unknown;
}) {
  const { t } = useTranslation();
  const objects = [objectOf(from), objectOf(to)] as const;
  if (objects.some(Boolean) && [from, to].every((v, i) => !v || objects[i]))
    return <KeyChanges column={column} from={objects[0]} to={objects[1]} />;
  // A list by its items' names: what went and what came.
  const lists = [listOf(from), listOf(to)] as const;
  if (lists.some(Boolean) && [from, to].every((v, i) => !v || lists[i])) {
    const [before = [], after = []] = lists.map((l) => l ?? []);
    const gone = before.filter((item) => !after.includes(item));
    const came = after.filter((item) => !before.includes(item));
    return (
      <ul className="flex flex-col">
        {gone.map((item, i) => (
          <li key={`-${i}`} className="text-muted line-through">
            − {item}
          </li>
        ))}
        {came.map((item, i) => (
          <li key={`+${i}`}>+ {item}</li>
        ))}
        {gone.length + came.length === 0 && <li>{t("changes.reordered")}</li>}
      </ul>
    );
  }
  if (
    (typeof from === "string" || typeof to === "string") &&
    [from, to].some(
      (v) => typeof v === "string" && (v.includes("\n") || v.length > 80),
    )
  )
    return <TextDiff from={String(from ?? "")} to={String(to ?? "")} />;
  const show = (value: unknown): string => {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "string" && /^[[{]/.test(value)) {
      try {
        const parsed = JSON.parse(value) as unknown;
        if (Array.isArray(parsed)) return parsed.join(", ") || "—";
        return t("changes.edited");
      } catch {
        return value;
      }
    }
    return String(value);
  };
  return (
    <span>
      {show(from)} → {show(to)}
    </span>
  );
}

/**
 * A stored object's changed keys, one line each (the whole JSON
 * was too noisy). Feature switches go by their features' names.
 */
function KeyChanges({
  column,
  from,
  to,
}: {
  column: string;
  from: Record<string, unknown> | null;
  to: Record<string, unknown> | null;
}) {
  const { t } = useTranslation();
  const changed = changedKeys(from, to);
  // Switches by what they became: a feature not listed is off.
  if (column === "switches")
    return (
      <ul className="flex flex-col gap-1">
        {([true, false] as const).map((on) => {
          const names = changed
            .filter(([, , b]) => !!b === on)
            .map(([key]) => t(`features.${key}.name`, { defaultValue: key }));
          return (
            names.length > 0 && (
              <li key={String(on)}>
                <span className="text-muted">
                  {t(on ? "changes.switchedOn" : "changes.switchedOff")}
                </span>{" "}
                {names.join(", ")}
              </li>
            )
          );
        })}
      </ul>
    );
  const name = (key: string) =>
    key
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .replace(/^./, (c) => c.toUpperCase());
  const show = (value: unknown) => {
    if (value === undefined || value === null || value === "") return "—";
    if (typeof value === "boolean")
      return t(value ? "changes.on" : "changes.off");
    if (Array.isArray(value)) return value.join(", ") || "—";
    if (typeof value === "object") return t("changes.edited");
    return String(value);
  };
  return (
    <ul className="flex flex-col">
      {changed.map(([key, a, b]) => (
        <li key={key}>
          <span className="text-muted">{name(key)}:</span> {show(a)} → {show(b)}
        </li>
      ))}
    </ul>
  );
}
