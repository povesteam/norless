import { Check, HandHelping, Trash2, X } from "lucide-react";
import { RowMenu } from "../ui/RowMenu";
import { Button, Chip, ListBox, Select } from "@heroui/react";
import { useTranslation } from "react-i18next";
import type { Role, ScheduleDate, Slot } from "../../server/schedule/team-data";
import type { TeamSchedule } from "../../server/schedule/team-schedule";
import { useCommunity } from "../data/community";
import { slotUrl } from "./schedule";

/** A slot: its role, who, and what this person may do with it. */
export function SlotRow({
  date,
  slot,
  role,
  schedule,
  team,
  me,
  signUps,
  act,
}: {
  date: ScheduleDate;
  slot: Slot;
  role: Role | undefined;
  schedule: TeamSchedule;
  team: boolean;
  me: string | null;
  signUps: boolean;
  act: (
    url: string,
    body?: object,
    method?: "POST" | "DELETE",
  ) => Promise<Response | null>;
}) {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const url = slotUrl(slug, date, slot.key);
  const person = schedule.people.find((p) => p.id === slot.userId);
  const away = (id: string) =>
    schedule.people
      .find((p) => p.id === id)
      ?.away.some((a) => a.first <= date.date && date.date <= a.last) ?? false;
  // Two roles the same date: allowed, with a note.
  const twice =
    slot.userId !== null &&
    date.slots.filter((s) => s.userId === slot.userId).length > 1;
  const marked = !!me && !!role?.people.includes(me);
  return (
    <li className="flex flex-wrap items-center gap-2">
      {/* The role and who on one row, also on a phone; the rest wraps under them
          (fix-ui-review-rest). */}
      <span className="flex min-w-0 items-center gap-2 max-sm:w-full">
        <span className="w-32 shrink-0 font-medium max-sm:w-24 max-sm:truncate">
          {role?.name ?? ""}
        </span>
        {team ? (
          <PersonPicker
            label={t("team.who", { role: role?.name ?? "" })}
            value={slot.userId}
            schedule={schedule}
            role={role}
            away={away}
            onChange={(userId) => void act(`${url}/assign`, { userId })}
          />
        ) : (
          <span className={person ? "" : "text-muted"}>
            {person?.name ?? t("team.open")}
          </span>
        )}
      </span>
      {slot.status === "asked" && <Chip size="sm">{t("team.asked")}</Chip>}
      {slot.status === "offered" && (
        <Chip size="sm" color="warning">
          {t("team.offered")}
        </Chip>
      )}
      {slot.userId && away(slot.userId) && (
        <Chip size="sm" color="danger">
          {t("team.away")}
        </Chip>
      )}
      {twice && <Chip size="sm">{t("team.twice")}</Chip>}
      {team && slot.status === "offered" && (
        <>
          <Button
            size="sm"
            onPress={() => void act(`${url}/confirm`, { yes: true })}
          >
            <Check />
            {t("team.confirm")}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onPress={() => void act(`${url}/confirm`, { yes: false })}
          >
            <X />
            {t("team.turnDown")}
          </Button>
        </>
      )}
      {signUps && slot.status === "open" && me && (
        <Button
          size="sm"
          variant="secondary"
          onPress={() => void act(`${url}/take`)}
        >
          <HandHelping />
          {marked ? t("team.take") : t("team.offer")}
        </Button>
      )}
      {team && (
        <RowMenu
          label={t("team.slotActions", { role: role?.name ?? "" })}
          actions={[
            {
              id: "remove",
              icon: <Trash2 />,
              label: t("team.removeSlot", { role: role?.name ?? "" }),
              confirm: t("team.confirmRemoveSlot", { role: role?.name ?? "" }),
              onAction: () => void act(url, undefined, "DELETE"),
            },
          ]}
        />
      )}
    </li>
  );
}

/** The picker's option for nobody: the slot open. */
const OPEN = "open";

/** For the team: who's in a slot, those marked for its role first; away ones say so. */
function PersonPicker({
  label,
  value,
  schedule,
  role,
  away,
  onChange,
}: {
  label: string;
  value: string | null;
  schedule: TeamSchedule;
  role: Role | undefined;
  away: (id: string) => boolean;
  onChange: (userId: string | null) => void;
}) {
  const { t } = useTranslation();
  const people = [
    ...schedule.people.filter((p) => role?.people.includes(p.id)),
    ...schedule.people.filter((p) => !role?.people.includes(p.id)),
  ];
  const options = [
    { id: OPEN, label: t("team.open") },
    ...people.map((p) => ({
      id: p.id,
      label: away(p.id) ? t("team.personAway", { name: p.name }) : p.name,
    })),
  ];
  return (
    <Select
      aria-label={label}
      value={value ?? OPEN}
      onChange={(id) => {
        const next = String(id) === OPEN ? null : String(id);
        if (next !== value) onChange(next);
      }}
      className="w-56 max-sm:w-auto max-sm:min-w-0 max-sm:flex-1"
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
              {o.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
