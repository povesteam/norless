import { buttonVariants } from "@heroui/react";
import { Bell, BellDot } from "lucide-react";
import { Focusable } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import type { MySchedule } from "../../server/schedule/my-schedule";
import { useChanges } from "../data/changes";
import { useCommunity, useShows } from "../data/community";
import { useJson } from "../data/fetch";
import { useIsMember } from "../data/me";
import { Tip } from "../ui/tip";
import { tables } from "./schedule";

/**
 * In every bar of a community, for members while the team schedule is on: a bell that
 * opens the Notifications page, with how many are new. Always there, so nothing moves
 * when one arrives.
 */
export function NotificationsBell() {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const shows = useShows();
  const on = useIsMember(slug) && shows("serviceRoles");
  const unread =
    useJson<MySchedule>(
      on ? `/api/communities/${slug}/my-schedule` : null,
      useChanges(slug, ...tables),
    ).data?.unread ?? 0;
  if (!on) return null;
  const label =
    unread > 0
      ? t("team.unreadNotifications", { count: unread })
      : t("team.notifications");
  return (
    <Tip label={label}>
      {/* Focusable gives the tooltip the link's place, as a button would. */}
      <Focusable>
        <Link
          href="/notifications"
          aria-label={label}
          className={`${buttonVariants({ isIconOnly: true, variant: "ghost" })} relative overflow-visible rounded-full`}
        >
          {unread > 0 ? <BellDot /> : <Bell />}
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute -end-1 -top-1 min-w-4 rounded-full bg-danger px-1 text-center text-[0.625rem] leading-4 font-semibold text-danger-foreground"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
      </Focusable>
    </Tip>
  );
}
