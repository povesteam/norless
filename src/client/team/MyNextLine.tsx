import { CalendarDays, Check } from "lucide-react";
import { Button, Chip } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import type { MySchedule } from "../../server/schedule/my-schedule";
import { useChanges } from "../data/changes";
import { useCommunity } from "../data/community";
import { send, useJson } from "../data/fetch";
import { tables, useWhen, slotUrl } from "./schedule";

/**
 * At the top of the community's pages: the member's next slot within a week, with Accept
 * while it waits for an answer, and a link to their schedule. What's new is the bell's,
 * in the bar.
 */
export function MyNextLine() {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const when = useWhen();
  const data = useJson<MySchedule>(
    `/api/communities/${slug}/my-schedule`,
    useChanges(slug, ...tables),
  ).data;
  const next = data?.slots.find(
    (s) => new Date(s.start).getTime() - Date.now() < 7 * 86_400_000,
  );
  if (!next) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-accent-soft px-3 py-2 text-sm">
      <CalendarDays className="size-4" />
      <span>
        {t("team.next", {
          role: next.role,
          when: `${next.name} · ${when(next.start)}`,
        })}
      </span>
      {next.status === "asked" && (
        <Button
          size="sm"
          onPress={() =>
            void send("POST", `${slotUrl(slug, next, next.key)}/answer`, {
              accept: true,
            })
          }
        >
          <Check />
          {t("team.accept")}
        </Button>
      )}
      <Link href="/my-schedule" className="link">
        <CalendarDays />
        {t("team.mine")}
      </Link>
    </div>
  );
}

/** On the stage views: the roles a member has today, if any. */
export function TodayBadge({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const data = useJson<MySchedule>(
    `/api/communities/${slug}/my-schedule`,
    useChanges(slug, ...tables),
  ).data;
  const today = new Date().toDateString();
  const roles = data?.slots
    .filter((s) => new Date(s.start).toDateString() === today)
    .map((s) => s.role);
  if (!roles?.length) return null;
  return (
    <Chip size="sm" color="accent">
      {t("team.today", { roles: roles.join(", ") })}
    </Chip>
  );
}
