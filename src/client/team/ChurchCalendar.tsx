import { CalendarSync, Save } from "lucide-react";
import {
  Description,
  FieldError,
  Input,
  Label,
  TextField,
} from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Calendar } from "../../server/schedule/calendar";
import { useChanges } from "../data/changes";
import { useCommunity, useShows } from "../data/community";
import { send, useJson } from "../data/fetch";
import { ActionButton, ErrorNotice } from "../ui/states";

/**
 * What's coming in the church's calendar, for members: a list by
 * day, on My schedule and the team schedule. Nothing without a calendar.
 */
export function ChurchCalendar() {
  const { t, i18n } = useTranslation();
  const { slug } = useCommunity();
  const shows = useShows();
  const calendar = useJson<Calendar>(
    shows("churchCalendar") ? `/api/communities/${slug}/calendar` : null,
    useChanges(slug, "communities"),
  ).data;
  if (!calendar || (!calendar.events.length && !calendar.failed)) return null;
  const day = new Intl.DateTimeFormat(i18n.language, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const time = new Intl.DateTimeFormat(i18n.language, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  // Whole days are dates (at noon, a day in every time zone); the rest are moments.
  const dayOf = (e: Calendar["events"][number]) =>
    e.allDay
      ? day.format(new Date(`${e.start}T12:00:00Z`))
      : day.format(new Date(e.start));
  const days = [...new Set(calendar.events.map(dayOf))];
  return (
    <section aria-labelledby="calendar-title" className="flex flex-col gap-2">
      <h3
        id="calendar-title"
        className="flex items-center gap-2 text-xl font-semibold"
      >
        <CalendarSync />
        {t("calendar.title")}
      </h3>
      {calendar.failed && (
        <p className="text-sm text-muted">{t("calendar.failed")}</p>
      )}
      <ul className="flex flex-col gap-3">
        {days.map((d) => (
          <li key={d} className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-muted first-letter:uppercase">
              {d}
            </span>
            <ul className="flex flex-col gap-1">
              {calendar.events
                .filter((e) => dayOf(e) === d)
                .map((e, i) => (
                  <li key={i} className="flex flex-wrap gap-x-3">
                    <span className="w-24 shrink-0 tabular-nums">
                      {e.allDay
                        ? t("calendar.allDay")
                        : `${time.format(new Date(e.start))}–${time.format(new Date(e.end))}`}
                    </span>
                    <span className="font-medium">{e.title}</span>
                    {e.location && (
                      <span className="text-muted">{e.location}</span>
                    )}
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The Schedule tab's calendar address, for owners; it may be a secret one. */
export function CalendarSettings() {
  const { t, i18n } = useTranslation();
  const { slug } = useCommunity();
  const loaded = useJson<Calendar>(`/api/communities/${slug}/calendar`).data;
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"invalid" | "failed" | null>(null);
  const [saved, setSaved] = useState<Calendar | null>(null);
  const shown = saved ?? loaded;
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const response = await send("PUT", `/api/communities/${slug}/calendar`, {
      url: (url ?? shown?.url ?? "").trim() || null,
    });
    setSaving(false);
    setState(
      response?.ok ? null : response?.status === 400 ? "invalid" : "failed",
    );
    if (!response?.ok) return;
    // The address as saved: webcal:// read over https.
    setSaved((await response.json()) as Calendar);
    setUrl(null);
  };
  const at = shown?.readAt
    ? new Intl.DateTimeFormat(i18n.language, {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(shown.readAt))
    : null;
  return (
    <section
      aria-labelledby="calendar-settings"
      className="flex flex-col gap-4"
    >
      <h3 id="calendar-settings" className="text-xl font-semibold">
        {t("calendar.settingsTitle")}
      </h3>
      <p className="text-sm text-muted">{t("calendar.settingsHelp")}</p>
      {state === "failed" && <ErrorNotice message={t("states.actionFailed")} />}
      <div className="flex flex-wrap items-end gap-4">
        <TextField
          value={url ?? shown?.url ?? ""}
          onChange={(value) => {
            setUrl(value);
            setState(null);
          }}
          isInvalid={state === "invalid"}
          className="w-96 max-w-full"
        >
          <Label>{t("calendar.address")}</Label>
          <Input placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" />
          <Description>{t("calendar.addressHelp")}</Description>
          <FieldError>{t("calendar.invalid")}</FieldError>
        </TextField>
        <ActionButton isPending={saving} onPress={() => void save()}>
          <Save />
          {t("editor.save")}
        </ActionButton>
      </div>
      {/* Steady: the line is there before there's anything to say. */}
      <p className="min-h-5 text-sm text-muted" aria-live="polite">
        {shown?.url
          ? shown.failed
            ? t("calendar.notRead")
            : at
              ? t("calendar.read", { count: shown.events.length, at })
              : ""
          : ""}
      </p>
    </section>
  );
}
