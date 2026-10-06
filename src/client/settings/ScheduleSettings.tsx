import {
  CalendarPlus,
  CalendarX,
  Pencil,
  RefreshCw,
  Repeat,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { Button, Chip, Input, Label, Modal, TextField } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RowMenu } from "../ui/RowMenu";
import type {
  EventInput,
  EventOutput,
} from "../../server/schedule/schedule-routes";
import { useCommunity } from "../data/community";
import { send, useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import {
  ActionButton,
  Empty,
  ErrorNotice,
  Placeholder,
  usePending,
} from "../ui/states";
import { Choice } from "../ui/choice";

type Editing = { kind: EventInput["kind"]; event: EventOutput | null } | null;

export function Schedule() {
  const { t, i18n } = useTranslation();
  const { slug } = useCommunity();
  const url = `/api/communities/${slug}/schedule`;
  const [version, setVersion] = useState(0);
  const { data, failed, retry } = useJson<{ events: EventOutput[] }>(
    url,
    version + useChanges(slug, "schedule_events"),
  );
  const [editing, setEditing] = useState<Editing>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const save = async (input: EventInput, id?: string) => {
    const response = await (id
      ? send("PUT", `${url}/${id}`, input)
      : send("POST", url, input));
    if (response?.status === 400) {
      setProblem(t("schedule.invalid"));
      return false;
    }
    setProblem(response?.ok ? null : t("states.actionFailed"));
    if (response?.ok) setVersion((n) => n + 1);
    return !!response?.ok;
  };
  const remove = async (id: string) => {
    const response = await send("DELETE", `${url}/${id}`);
    setProblem(response?.ok ? null : t("states.actionFailed"));
    setVersion((n) => n + 1);
  };

  if (data === undefined)
    return failed ? (
      <ErrorNotice message={t("states.loadFailed")} onRetry={retry} />
    ) : (
      <Placeholder lines={6} />
    );
  if (data === null) return null;
  const events = data.events;
  const recurring = events.filter((e) => e.kind === "recurring");
  const oneOff = events.filter((e) => e.kind === "one_off");
  const cancelled = events.filter((e) => e.kind === "cancellation");
  const weekday = (n: number) =>
    new Intl.DateTimeFormat(i18n.language, { weekday: "long" }).format(
      new Date(Date.UTC(2024, 0, n)), // 1 January 2024 was a Monday
    );
  const date = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(`${iso}T00:00:00Z`));
  const period = (e: EventOutput) =>
    e.firstDate && e.lastDate
      ? t("schedule.between", { from: date(e.firstDate), to: date(e.lastDate) })
      : e.firstDate
        ? t("schedule.since", { from: date(e.firstDate) })
        : e.lastDate
          ? t("schedule.until", { to: date(e.lastDate) })
          : "";

  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-xl font-semibold">{t("schedule.title")}</h3>
      <p className="text-sm text-muted">{t("schedule.help")}</p>
      {problem && <ErrorNotice message={problem} />}
      <div className="flex flex-wrap gap-2">
        <Button onPress={() => setEditing({ kind: "recurring", event: null })}>
          <Repeat />
          {t("schedule.addRecurring")}
        </Button>
        <Button
          variant="secondary"
          onPress={() => setEditing({ kind: "one_off", event: null })}
        >
          <CalendarPlus />
          {t("schedule.addOneOff")}
        </Button>
        {recurring.length > 0 && (
          <Button
            variant="secondary"
            onPress={() => setEditing({ kind: "cancellation", event: null })}
          >
            <CalendarX />
            {t("schedule.cancelDay")}
          </Button>
        )}
      </div>
      {events.length === 0 && (
        <Empty
          title={t("schedule.empty")}
          description={t("schedule.emptyHelp")}
        />
      )}
      <EventTable
        title={t("schedule.recurring")}
        events={recurring}
        describe={(e) => [
          `${weekday(e.weekday ?? 1)}, ${e.startTime}–${e.endTime}`,
          period(e),
        ]}
        onEdit={(e) => setEditing({ kind: "recurring", event: e })}
        onDelete={remove}
      />
      <EventTable
        title={t("schedule.oneOff")}
        events={oneOff}
        describe={(e) => [
          `${date(e.date ?? "")}, ${e.startTime}–${e.endTime}`,
          "",
        ]}
        onEdit={(e) => setEditing({ kind: "one_off", event: e })}
        onDelete={remove}
      />
      <EventTable
        title={t("schedule.cancelled")}
        events={cancelled}
        describe={(e) => [date(e.date ?? ""), ""]}
        onEdit={(e) => setEditing({ kind: "cancellation", event: e })}
        onDelete={remove}
      />
      <ClassifyPlays />
      {editing && (
        <EventEditor
          kind={editing.kind}
          event={editing.event}
          recurring={recurring}
          onSave={(input) => save(input, editing.event?.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function EventTable({
  title,
  events,
  describe,
  onEdit,
  onDelete,
}: {
  title: string;
  events: EventOutput[];
  /** When the event happens, and the period it applies to. */
  describe: (event: EventOutput) => [string, string];
  onEdit: (event: EventOutput) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  if (events.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <h4 className="font-semibold">{title}</h4>
      <ul className="divide-y divide-separator border-y border-separator">
        {events.map((event) => {
          const [when, period] = describe(event);
          return (
            <li
              key={event.id}
              aria-label={event.name}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
            >
              <span className="font-medium">{event.name}</span>
              <span>{when}</span>
              {period && <span className="text-sm text-muted">{period}</span>}
              <Chip
                size="sm"
                variant="soft"
                color={event.type === "service" ? "accent" : "default"}
              >
                {t(`schedule.${event.type}`)}
              </Chip>
              <span className="ms-auto flex gap-1">
                <Button size="sm" variant="ghost" onPress={() => onEdit(event)}>
                  <Pencil />
                  {t("playlist.edit")}
                </Button>
                {/* Deleting in ⋯, as Members and the team schedule do. */}
                <RowMenu
                  label={t("schedule.actions", { name: event.name })}
                  actions={[
                    {
                      id: "delete",
                      icon: <Trash2 />,
                      label: t("members.delete"),
                      confirm: t("schedule.confirmDelete", {
                        name: event.name,
                      }),
                      onAction: () => void onDelete(event.id),
                    },
                  ]}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Adds or changes one event; the fields depend on its kind. */
function EventEditor({
  kind,
  event,
  recurring,
  onSave,
  onClose,
}: {
  kind: EventInput["kind"];
  event: EventOutput | null;
  recurring: EventOutput[];
  onSave: (input: EventInput) => Promise<boolean>;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [name, setName] = useState(event?.name ?? "");
  const [type, setType] = useState(event?.type ?? "service");
  const [weekday, setWeekday] = useState(event?.weekday ?? 7);
  const [startTime, setStartTime] = useState(event?.startTime ?? "10:00");
  const [endTime, setEndTime] = useState(event?.endTime ?? "12:00");
  const [firstDate, setFirstDate] = useState(event?.firstDate ?? "");
  const [lastDate, setLastDate] = useState(event?.lastDate ?? "");
  const [date, setDate] = useState(event?.date ?? "");
  const [cancels, setCancels] = useState(
    event?.cancelsEventId ?? recurring[0]?.id ?? "",
  );
  const input = (): EventInput =>
    kind === "cancellation"
      ? { kind, cancelsEventId: cancels, date }
      : kind === "one_off"
        ? { kind, name, type, date, startTime, endTime }
        : {
            kind,
            name,
            type,
            weekday,
            startTime,
            endTime,
            firstDate: firstDate || null,
            lastDate: lastDate || null,
          };
  const [save, saving] = usePending(async () => {
    if (await onSave(input())) onClose();
  });
  const weekdays = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
    id: n,
    name: new Intl.DateTimeFormat(i18n.language, { weekday: "long" }).format(
      new Date(Date.UTC(2024, 0, n)),
    ),
  }));

  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>
              {t(
                kind === "recurring"
                  ? "schedule.addRecurring"
                  : kind === "one_off"
                    ? "schedule.addOneOff"
                    : "schedule.cancelDay",
              )}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            {kind === "cancellation" ? (
              <Choice
                label={t("schedule.event")}
                value={cancels}
                onChange={setCancels}
                options={recurring.map((e) => ({ id: e.id, name: e.name }))}
              />
            ) : (
              <>
                <TextField value={name} onChange={setName} isRequired autoFocus>
                  <Label>{t("schedule.name")}</Label>
                  <Input />
                </TextField>
                <Choice
                  label={t("schedule.type")}
                  value={type}
                  onChange={(v) => setType(v as typeof type)}
                  options={["service", "rehearsal"].map((id) => ({
                    id,
                    name: t(`schedule.${id}`),
                  }))}
                />
              </>
            )}
            {kind === "recurring" ? (
              <Choice
                label={t("schedule.weekday")}
                value={String(weekday)}
                onChange={(v) => setWeekday(Number(v))}
                options={weekdays.map((d) => ({
                  id: String(d.id),
                  name: d.name,
                }))}
              />
            ) : (
              <TextField type="date" value={date} onChange={setDate} isRequired>
                <Label>{t("schedule.date")}</Label>
                <Input />
              </TextField>
            )}
            {kind !== "cancellation" && (
              <div className="grid grid-cols-2 gap-4">
                <TextField
                  type="time"
                  value={startTime}
                  onChange={setStartTime}
                >
                  <Label>{t("schedule.start")}</Label>
                  <Input />
                </TextField>
                <TextField type="time" value={endTime} onChange={setEndTime}>
                  <Label>{t("schedule.end")}</Label>
                  <Input />
                </TextField>
              </div>
            )}
            {kind === "recurring" && (
              <div className="grid grid-cols-2 gap-4">
                <TextField
                  type="date"
                  value={firstDate}
                  onChange={setFirstDate}
                >
                  <Label>{t("schedule.firstDate")}</Label>
                  <Input />
                </TextField>
                <TextField type="date" value={lastDate} onChange={setLastDate}>
                  <Label>{t("schedule.lastDate")}</Label>
                  <Input />
                </TextField>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={onClose}>
              <X />
              {t("editor.close")}
            </Button>
            <ActionButton isPending={saving} onPress={() => void save()}>
              <Save />
              {t("editor.save")}
            </ActionButton>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** Classifies the imported plays again with the schedule as it is now. */
function ClassifyPlays() {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const [result, setResult] = useState<{
    service: number;
    rehearsal: number;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const [classify, classifying] = usePending(async () => {
    const response = await send(
      "POST",
      `/api/communities/${slug}/schedule/classify`,
    );
    setFailed(!response?.ok);
    if (response?.ok)
      setResult(
        (await response.json()) as { service: number; rehearsal: number },
      );
  });
  return (
    <div className="flex flex-col items-start gap-2 border-t border-separator pt-4">
      <h4 className="font-semibold">{t("schedule.classifyTitle")}</h4>
      <p className="text-sm text-muted">{t("schedule.classifyHelp")}</p>
      <ActionButton
        variant="secondary"
        isPending={classifying}
        onPress={() =>
          window.confirm(t("schedule.confirmClassify")) && void classify()
        }
      >
        <RefreshCw />
        {t("schedule.classify")}
      </ActionButton>
      {result && (
        <p role="status">
          {t("schedule.classified", {
            service: result.service,
            rehearsal: result.rehearsal,
          })}
        </p>
      )}
      {failed && <ErrorNotice message={t("states.actionFailed")} />}
    </div>
  );
}
