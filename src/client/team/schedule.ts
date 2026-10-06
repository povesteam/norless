import { useTranslation } from "react-i18next";

/** The tables a schedule view follows (live-updates spec). */
export const tables = [
  "slots",
  "schedule_dates",
  "service_roles",
  "slot_templates",
  "role_people",
  "away_dates",
  "notifications",
  "members",
  "schedule_events",
] as const;

/** A service's day and time, in the reader's language. */
export function useWhen() {
  const { i18n } = useTranslation();
  return (start: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(start));
}

export const slotUrl = (
  slug: string,
  d: { eventId: string; date: string },
  key: string,
) =>
  `/api/communities/${slug}/team-schedule/${d.eventId}/${d.date}/slots/${encodeURIComponent(key)}`;
