import { Bell, CalendarDays, ChevronRight } from "lucide-react";
import { useEffect, useEffectEvent } from "react";
import { type TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import type {
  MySchedule,
  Notification,
} from "../../server/schedule/my-schedule";
import type { PushResult } from "../../server/schedule/team-notifications";
import { useChanges } from "../data/changes";
import { useCommunity, useShows } from "../data/community";
import { send, useJson } from "../data/fetch";
import { Empty, ErrorNotice, Placeholder } from "../ui/states";
import { relativeTime } from "../ui/time";
import { PushSwitch } from "./PushSwitch";
import { tables } from "./schedule";

/** How a notification went by push: per device, or why to none. */
function pushLine(t: TFunction, push: PushResult) {
  if ("none" in push)
    return push.none === "keys" ? t("team.pushKeys") : t("team.pushDevices");
  return [
    push.sent > 0 && t("team.pushSent", { count: push.sent }),
    push.failed > 0 && t("team.pushFailed", { count: push.failed }),
    push.gone > 0 && t("team.pushGone", { count: push.gone }),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** What the app told someone, in their language. */
function told(t: TFunction, kind: string, data: Record<string, string>) {
  return t(`team.told.${kind}`, { ...data, defaultValue: kind });
}

/** Where a notification leads, as its push does: the playlist, else My schedule. */
const pageOf = (n: Notification) =>
  n.data.playlistId ? `/playlists/${n.data.playlistId}` : "/my-schedule";

/**
 * /<community>/notifications, from the bell in the bar: what the app told the member,
 * newest first, the unread ones bold until seen here, each leading to what it's about;
 * and notifications on this device.
 */
export function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const { slug } = useCommunity();
  const shows = useShows();
  const { data, failed, retry } = useJson<MySchedule>(
    `/api/communities/${slug}/my-schedule`,
    useChanges(slug, ...tables),
  );
  // Seen: what was told is read.
  const unread = data?.unread ?? 0;
  const markRead = useEffectEvent(() => {
    if (unread > 0)
      void send("POST", `/api/communities/${slug}/notifications/read`);
  });
  useEffect(() => markRead(), [unread]);
  if (data === undefined)
    return failed ? (
      <ErrorNotice message={t("states.loadFailed")} onRetry={retry} />
    ) : (
      <Placeholder lines={6} />
    );
  if (!data) return <p>{t("team.membersOnly")}</p>;
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h2 className="flex items-center gap-2 text-2xl font-semibold">
        <Bell />
        {t("team.notifications")}
      </h2>
      {data.notifications.length === 0 ? (
        <Empty
          title={t("team.noNotifications")}
          description={t("team.noNotificationsHelp")}
        />
      ) : (
        <ul className="flex flex-col">
          {data.notifications.map((n) => (
            <li key={n.id}>
              <Link
                href={pageOf(n)}
                className="flex items-center gap-3 rounded-xl px-2 py-2 outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={n.readAt ? "" : "font-semibold"}>
                    {told(t, n.kind, n.data)}
                    {n.data.reason ? ` (${n.data.reason})` : ""}
                  </span>
                  <span className="text-xs text-muted">
                    {relativeTime(n.createdAt, new Date(), i18n.language)}
                    {n.push && ` · ${pushLine(t, n.push)}`}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {shows("pushNotifications") && <PushSwitch />}
      <Link href="/my-schedule" className="link self-start">
        <CalendarDays />
        {t("team.mine")}
      </Link>
    </div>
  );
}
