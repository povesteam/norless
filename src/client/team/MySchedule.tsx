import {
  CalendarDays,
  CalendarX,
  Check,
  HandHelping,
  Plus,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { ChurchCalendar } from "./ChurchCalendar";
import {
  Button,
  Chip,
  Input,
  Label,
  Modal,
  TextArea,
  TextField,
} from "@heroui/react";
import { useEffect, useEffectEvent, useState } from "react";
import { type TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { MySchedule } from "../../server/schedule/my-schedule";
import type { PushResult } from "../../server/schedule/team-notifications";
import { useChanges } from "../data/changes";
import { useCommunity, useShows } from "../data/community";
import { send, useJson } from "../data/fetch";
import {
  ActionButton,
  ErrorNotice,
  Placeholder,
  usePending,
} from "../ui/states";
import { tables, useWhen, slotUrl } from "./schedule";
import { PushSwitch } from "./PushSwitch";

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

/**
 * /<community>/my-schedule: a member's own services with Accept and
 * Decline, open slots for them, away dates, what they were told, and notifications on
 * this device.
 */
export function MySchedulePage() {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const shows = useShows();
  const when = useWhen();
  const { data, failed, retry } = useJson<MySchedule>(
    `/api/communities/${slug}/my-schedule`,
    useChanges(slug, ...tables),
  );
  const [declining, setDeclining] = useState<
    MySchedule["slots"][number] | null
  >(null);
  const [actFailed, setActFailed] = useState(false);
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
      <Placeholder lines={8} />
    );
  if (!data) return <p>{t("team.membersOnly")}</p>;
  const act = async (url: string, body?: object) => {
    const response = await send("POST", url, body);
    setActFailed(!response?.ok);
  };
  return (
    <div className="flex flex-col gap-6">
      <h2 className="flex items-center gap-2 text-2xl font-semibold">
        <CalendarDays />
        {t("team.mine")}
      </h2>
      {actFailed && <ErrorNotice message={t("states.actionFailed")} />}
      <section aria-labelledby="mine-title" className="flex flex-col gap-2">
        <h3 id="mine-title" className="text-xl font-semibold">
          {t("team.yours")}
        </h3>
        {data.slots.length === 0 ? (
          <p className="text-sm text-muted">{t("team.noneYours")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.slots.map((s) => (
              <li
                key={`${s.eventId}${s.date}${s.key}`}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-separator p-3"
              >
                <span className="font-medium">{s.role}</span>
                <span>
                  {s.name} · {when(s.start)}
                </span>
                {s.also.length > 0 && (
                  <Chip size="sm">
                    {t("team.also", { roles: s.also.join(", ") })}
                  </Chip>
                )}
                {s.status === "offered" && (
                  <Chip size="sm">{t("team.offered")}</Chip>
                )}
                <span className="ms-auto flex gap-2">
                  {s.status === "asked" && (
                    <Button
                      size="sm"
                      onPress={() =>
                        void act(`${slotUrl(slug, s, s.key)}/answer`, {
                          accept: true,
                        })
                      }
                    >
                      <Check />
                      {t("team.accept")}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => setDeclining(s)}
                  >
                    <Undo2 />
                    {t("team.decline")}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ChurchCalendar />
      {data.open.length > 0 && (
        <section aria-labelledby="open-title" className="flex flex-col gap-2">
          <h3 id="open-title" className="text-xl font-semibold">
            {t("team.openForYou")}
          </h3>
          <ul className="flex flex-col gap-2">
            {data.open.map((o) => (
              <li
                key={`${o.eventId}${o.date}${o.key}`}
                className="flex flex-wrap items-center gap-2"
              >
                <span className="font-medium">{o.role}</span>
                <span>
                  {o.name} · {when(o.start)}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => void act(`${slotUrl(slug, o, o.key)}/take`)}
                >
                  <HandHelping />
                  {t("team.take")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <AwayDates slug={slug} away={data.away} />
      {shows("pushNotifications") && <PushSwitch />}
      <section aria-labelledby="told-title" className="flex flex-col gap-2">
        <h3 id="told-title" className="text-xl font-semibold">
          {t("team.notifications")}
        </h3>
        {data.notifications.length === 0 ? (
          <p className="text-sm text-muted">{t("team.noNotifications")}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {data.notifications.map((n) => (
              <li key={n.id} className={n.readAt ? "" : "font-semibold"}>
                {told(t, n.kind, n.data)}
                {n.data.reason ? ` (${n.data.reason})` : ""}
                {n.push && (
                  <span className="block text-xs font-normal text-muted">
                    {pushLine(t, n.push)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {declining && (
        <DeclineDialog
          role={declining.role}
          onDecline={async (reason) => {
            await act(`${slotUrl(slug, declining, declining.key)}/answer`, {
              accept: false,
              reason,
            });
            setDeclining(null);
          }}
          onClose={() => setDeclining(null)}
        />
      )}
    </div>
  );
}

/** Declining a slot, saying why if one likes: it opens again for others. */
function DeclineDialog({
  role,
  onDecline,
  onClose,
}: {
  role: string;
  onDecline: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [decline, declining] = usePending(() => onDecline(reason));
  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{t("team.declineTitle", { role })}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <TextField value={reason} onChange={setReason}>
              <Label>{t("team.why")}</Label>
              <TextArea rows={2} maxLength={300} />
            </TextField>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={onClose}>
              <X />
              {t("feedback.close")}
            </Button>
            <ActionButton isPending={declining} onPress={() => void decline()}>
              <Undo2 />
              {t("team.decline")}
            </ActionButton>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** A member's away dates: added with two days and a note, removed one by one. */
function AwayDates({ slug, away }: { slug: string; away: MySchedule["away"] }) {
  const { t, i18n } = useTranslation();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [note, setNote] = useState("");
  const [failed, setFailed] = useState(false);
  const day = (date: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      day: "numeric",
      month: "long",
    }).format(new Date(`${date}T12:00:00`));
  const [add, adding] = usePending(async () => {
    const response = await send("POST", `/api/communities/${slug}/away-dates`, {
      first,
      last: last || first,
      note,
    });
    setFailed(!response?.ok);
    if (response?.ok) {
      setFirst("");
      setLast("");
      setNote("");
    }
  });
  return (
    <section aria-labelledby="away-title" className="flex flex-col gap-2">
      <h3 id="away-title" className="text-xl font-semibold">
        {t("team.awayTitle")}
      </h3>
      <p className="text-sm text-muted">{t("team.awayHelp")}</p>
      <ul className="flex flex-col gap-1">
        {away.map((a) => (
          <li key={a.id} className="flex items-center gap-2">
            <CalendarX className="size-4" />
            {a.first === a.last
              ? day(a.first)
              : `${day(a.first)} – ${day(a.last)}`}
            {a.note && <span className="text-muted">· {a.note}</span>}
            <Button
              size="sm"
              variant="ghost"
              isIconOnly
              aria-label={t("team.removeAway")}
              onPress={() =>
                void send(
                  "DELETE",
                  `/api/communities/${slug}/away-dates/${a.id}`,
                )
              }
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (first) void add();
        }}
      >
        <TextField value={first} onChange={setFirst} isRequired>
          <Label>{t("team.from")}</Label>
          <Input type="date" />
        </TextField>
        <TextField value={last} onChange={setLast}>
          <Label>{t("team.to")}</Label>
          <Input type="date" min={first} />
        </TextField>
        <TextField value={note} onChange={setNote}>
          <Label>{t("team.note")}</Label>
          <Input maxLength={200} />
        </TextField>
        <ActionButton
          type="submit"
          variant="secondary"
          isPending={adding}
          isDisabled={!first}
        >
          <Plus />
          {t("team.addAway")}
        </ActionButton>
      </form>
      {failed && <ErrorNotice message={t("states.actionFailed")} />}
    </section>
  );
}
