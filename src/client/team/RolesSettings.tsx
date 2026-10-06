import { Plus, Save, Trash2 } from "lucide-react";
import {
  Button,
  Checkbox,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
} from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Role } from "../../server/schedule/team-data";
import type { TeamSchedule } from "../../server/schedule/team-schedule";
import { instruments } from "../../shared/preferences";
import { Shown, useCommunity } from "../data/community";
import { send, useJson } from "../data/fetch";
import {
  ActionButton,
  ErrorNotice,
  Placeholder,
  usePending,
} from "../ui/states";

/** Settings → Roles: the community's roles, for owners to rename, add, remove and order. */
export function RolesSettings() {
  const { slug } = useCommunity();
  const loaded = useJson<TeamSchedule>(
    `/api/communities/${slug}/team-schedule`,
  ).data;
  if (loaded === undefined) return <Placeholder lines={6} />;
  if (!loaded) return null;
  return <RolesForm slug={slug} roles={loaded.roles} />;
}

function RolesForm({ slug, roles }: { slug: string; roles: Role[] }) {
  const { t } = useTranslation();
  // Starts from the saved roles once, and keeps what's typed.
  const [draft, setDraft] = useState<
    {
      id?: string;
      name: string;
      instrument: Role["instrument"];
      leads: boolean;
    }[]
  >(() =>
    roles.map(({ id, name, instrument, leads }) => ({
      id,
      name,
      instrument,
      leads,
    })),
  );
  const [state, setState] = useState<"saved" | "failed" | null>(null);
  const [save, saving] = usePending(async () => {
    const response = await send(
      "PUT",
      `/api/communities/${slug}/service-roles`,
      {
        roles: draft.filter((r) => r.name.trim()),
      },
    );
    setState(response?.ok ? "saved" : "failed");
  });
  const change = (i: number, patch: Partial<(typeof draft)[number]>) =>
    setDraft(draft.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <section aria-labelledby="roles-title" className="flex flex-col gap-4">
      <h3 id="roles-title" className="text-xl font-semibold">
        {t("team.roles")}
      </h3>
      <p className="text-sm text-muted">{t("team.rolesHelp")}</p>
      <ul className="flex flex-col gap-2">
        {draft.map((r, i) => (
          <li
            key={r.id ?? `new${i}`}
            className="flex flex-wrap items-end gap-2"
          >
            <TextField value={r.name} onChange={(name) => change(i, { name })}>
              <Label>{t("team.roleName")}</Label>
              <Input maxLength={60} />
            </TextField>
            <Select
              value={r.instrument ?? "none"}
              onChange={(value) =>
                change(i, {
                  instrument:
                    value === "none" ? null : (value as Role["instrument"]),
                })
              }
              className="w-44"
            >
              <Label>{t("team.instrument")}</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {["none", ...instruments].map((id) => (
                    <ListBox.Item
                      key={id}
                      id={id}
                      textValue={
                        id === "none"
                          ? t("team.noInstrument")
                          : t(`instruments.names.${id}`)
                      }
                    >
                      {id === "none"
                        ? t("team.noInstrument")
                        : t(`instruments.names.${id}`)}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            {/* Its people lead the songs of their services. */}
            <Shown feature="ledBy">
              <Checkbox
                isSelected={r.leads}
                onChange={(leads) => change(i, { leads })}
                className="self-center"
              >
                <Checkbox.Content>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  {t("team.leadsSongs")}
                </Checkbox.Content>
              </Checkbox>
            </Shown>
            <Button
              variant="ghost"
              isIconOnly
              aria-label={t("team.removeRole", { role: r.name })}
              onPress={() => setDraft(draft.filter((_, j) => j !== i))}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          onPress={() =>
            setDraft([...draft, { name: "", instrument: null, leads: false }])
          }
        >
          <Plus />
          {t("team.addRole")}
        </Button>
        <ActionButton isPending={saving} onPress={() => void save()}>
          <Save />
          {t("editor.save")}
        </ActionButton>
        <span className="text-sm text-muted" aria-live="polite">
          {state === "saved" ? t("editor.saved") : ""}
        </span>
      </div>
      {state === "failed" && <ErrorNotice message={t("states.actionFailed")} />}
    </section>
  );
}
