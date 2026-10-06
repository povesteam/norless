import {
  CalendarDays,
  ClipboardList,
  Plus,
  Save,
  Users,
  X,
} from "lucide-react";
import { ChurchCalendar } from "./ChurchCalendar";
import {
  Button,
  Checkbox,
  CheckboxGroup,
  Label,
  Modal,
  NumberField,
} from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import type { Role, ScheduleDate } from "../../server/schedule/team-data";
import type { TeamSchedule } from "../../server/schedule/team-schedule";
import { useChanges } from "../data/changes";
import { useCommunity } from "../data/community";
import { send, useJson } from "../data/fetch";
import { hasRole, useMe, useRoles } from "../data/me";
import {
  ActionButton,
  Empty,
  ErrorNotice,
  Placeholder,
  usePending,
} from "../ui/states";
import { tables, useWhen } from "./schedule";
import { SlotRow } from "./SlotRow";

/**
 * /<community>/team-schedule: who does what in the coming services
 * and rehearsals, for every member; the team fills the slots, adds and removes them, sets
 * what each weekly event's dates start with and who's marked for each role.
 */
export function TeamSchedulePage() {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const roles = useRoles(slug);
  const team = hasRole(roles, "team");
  const { me } = useMe();
  const { data, failed, retry } = useJson<TeamSchedule>(
    `/api/communities/${slug}/team-schedule`,
    useChanges(slug, ...tables),
  );
  if (data === undefined)
    return failed ? (
      <ErrorNotice message={t("states.loadFailed")} onRetry={retry} />
    ) : (
      <Placeholder lines={10} />
    );
  if (!data) return <p>{t("team.membersOnly")}</p>;
  return (
    <div className="flex flex-col gap-6">
      <h2 className="flex items-center gap-2 text-2xl font-semibold">
        <ClipboardList />
        {t("team.title")}
      </h2>
      <p className="text-sm text-muted">{t("team.help")}</p>
      {data.events.length === 0 ? (
        <Empty title={t("team.noEvents")} description={t("team.noEventsHelp")}>
          {hasRole(roles, "owner") && (
            <Link href="/settings/schedule" className="link">
              <CalendarDays />
              {t("team.toSettings")}
            </Link>
          )}
        </Empty>
      ) : data.dates.length === 0 ? (
        <Empty title={t("team.noDates")} description={t("team.noDatesHelp")} />
      ) : (
        data.dates.map((d) => (
          <DateCard
            key={`${d.eventId}:${d.date}`}
            date={d}
            schedule={data}
            team={team}
            me={me?.user?.id ?? null}
          />
        ))
      )}
      {team && data.events.length > 0 && <Templates schedule={data} />}
      {team && <RolePeople schedule={data} />}
      {/* Last, so what's above doesn't move when it arrives. */}
      <ChurchCalendar />
    </div>
  );
}

/** One date: its slots by role, and for the team what to change. */
function DateCard({
  date,
  schedule,
  team,
  me,
}: {
  date: ScheduleDate;
  schedule: TeamSchedule;
  team: boolean;
  me: string | null;
}) {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const when = useWhen();
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const act = async (
    url: string,
    body?: object,
    method: "POST" | "DELETE" = "POST",
  ) => {
    const response = await send(method, url, body);
    setFailed(!response?.ok);
    return response;
  };
  const roleOf = (id: string) => schedule.roles.find((r) => r.id === id);
  return (
    <section
      aria-label={`${date.name}, ${when(date.start)}`}
      className="flex flex-col gap-3 rounded-xl border border-separator p-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">
          {date.name} · {when(date.start)}
        </h3>
        {team && (
          <Button size="sm" variant="ghost" onPress={() => setAdding(true)}>
            <Plus />
            {t("team.addSlot")}
          </Button>
        )}
      </div>
      {failed && <ErrorNotice message={t("states.actionFailed")} />}
      {date.slots.length === 0 ? (
        <p className="text-sm text-muted">
          {t(team ? "team.noSlotsTeam" : "team.noSlots")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {date.slots.map((slot) => (
            <SlotRow
              key={slot.key}
              date={date}
              slot={slot}
              role={roleOf(slot.roleId)}
              schedule={schedule}
              team={team}
              me={me}
              act={act}
            />
          ))}
        </ul>
      )}
      {adding && (
        <Modal.Backdrop
          isOpen
          onOpenChange={(open) => !open && setAdding(false)}
        >
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{t("team.addSlot")}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-wrap gap-2">
                {schedule.roles.map((r) => (
                  <Button
                    key={r.id}
                    variant="secondary"
                    onPress={() =>
                      void act(
                        `/api/communities/${slug}/team-schedule/${date.eventId}/${date.date}/slots`,
                        { roleId: r.id },
                      ).then(() => setAdding(false))
                    }
                  >
                    <Plus />
                    {r.name}
                  </Button>
                ))}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onPress={() => setAdding(false)}>
                  <X />
                  {t("feedback.close")}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}
    </section>
  );
}

/** For the team: the slots each weekly event's dates start with. */
function Templates({ schedule }: { schedule: TeamSchedule }) {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  return (
    <section aria-labelledby="templates-title" className="flex flex-col gap-3">
      <h3 id="templates-title" className="text-xl font-semibold">
        {t("team.templates")}
      </h3>
      <p className="text-sm text-muted">{t("team.templatesHelp")}</p>
      {schedule.events.map((e) => (
        <Template key={e.id} slug={slug} event={e} roles={schedule.roles} />
      ))}
    </section>
  );
}

function Template({
  slug,
  event,
  roles,
}: {
  slug: string;
  event: TeamSchedule["events"][number];
  roles: Role[];
}) {
  const { t } = useTranslation();
  const counts = (template: typeof event.template) =>
    Object.fromEntries(
      roles.map((r) => [
        r.id,
        template.find((x) => x.roleId === r.id)?.count ?? 0,
      ]),
    );
  // Starts from what's saved, and keeps what's typed.
  const [draft, setDraft] = useState(() => counts(event.template));
  const [failed, setFailed] = useState(false);
  const [save, saving] = usePending(async () => {
    const response = await send(
      "PUT",
      `/api/communities/${slug}/slot-templates/${event.id}`,
      {
        template: Object.entries(draft)
          .filter(([, count]) => count > 0)
          .map(([roleId, count]) => ({ roleId, count })),
      },
    );
    setFailed(!response?.ok);
  });
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-separator p-3">
      <h4 className="font-semibold">{event.name}</h4>
      <div className="flex flex-wrap gap-3">
        {roles.map((r) => (
          <NumberField
            key={r.id}
            value={draft[r.id] ?? 0}
            minValue={0}
            maxValue={20}
            onChange={(value) =>
              setDraft({ ...draft, [r.id]: Number.isNaN(value) ? 0 : value })
            }
            className="w-36"
          >
            <Label>{r.name}</Label>
            <NumberField.Group>
              <NumberField.DecrementButton />
              <NumberField.Input />
              <NumberField.IncrementButton />
            </NumberField.Group>
          </NumberField>
        ))}
      </div>
      {failed && <ErrorNotice message={t("states.actionFailed")} />}
      <ActionButton
        size="sm"
        className="self-start"
        isPending={saving}
        onPress={() => void save()}
      >
        <Save />
        {t("team.saveTemplate", { name: event.name })}
      </ActionButton>
    </div>
  );
}

/** For the team: who's marked for each role; instruments mark their players. */
function RolePeople({ schedule }: { schedule: TeamSchedule }) {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const [editing, setEditing] = useState<Role | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const name = (id: string) =>
    schedule.people.find((p) => p.id === id)?.name ?? "";
  return (
    <section aria-labelledby="people-title" className="flex flex-col gap-3">
      <h3 id="people-title" className="text-xl font-semibold">
        {t("team.people")}
      </h3>
      <p className="text-sm text-muted">{t("team.peopleHelp")}</p>
      <ul className="flex flex-col gap-2">
        {schedule.roles.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2">
            <span className="w-32 shrink-0 font-medium">{r.name}</span>
            <span className="min-w-0 flex-1 text-sm">
              {r.people.map(name).join(", ") || t("team.nobody")}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onPress={() => {
                setChosen(r.people);
                setEditing(r);
              }}
            >
              <Users />
              {t("team.choosePeople")}
            </Button>
          </li>
        ))}
      </ul>
      {editing && (
        <Modal.Backdrop
          isOpen
          onOpenChange={(open) => !open && setEditing(null)}
        >
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>
                  {t("team.peopleFor", { role: editing.name })}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                {editing.instrument && (
                  <p className="text-sm text-muted">{t("team.byInstrument")}</p>
                )}
                <CheckboxGroup
                  aria-label={t("team.peopleFor", { role: editing.name })}
                  value={chosen}
                  onChange={setChosen}
                >
                  {schedule.people.map((p) => (
                    <Checkbox key={p.id} value={p.id}>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <Checkbox.Content>
                        <Label>{p.name}</Label>
                      </Checkbox.Content>
                    </Checkbox>
                  ))}
                </CheckboxGroup>
                {failed && <ErrorNotice message={t("states.actionFailed")} />}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onPress={() => setEditing(null)}>
                  <X />
                  {t("feedback.close")}
                </Button>
                <Button
                  onPress={() =>
                    void send(
                      "PUT",
                      `/api/communities/${slug}/service-roles/${editing.id}/people`,
                      { people: chosen },
                    ).then((response) => {
                      setFailed(!response?.ok);
                      if (response?.ok) setEditing(null);
                    })
                  }
                >
                  <Save />
                  {t("editor.save")}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}
    </section>
  );
}
