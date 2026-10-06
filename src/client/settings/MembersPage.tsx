import { Trash2, UserMinus, UserPlus } from "lucide-react";
import { RowMenu } from "../ui/RowMenu";
import {
  Alert,
  Chip,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
} from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MemberRow, Role } from "../../server/auth/members";
import { useCommunity } from "../data/community";
import { send, useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import {
  ActionButton,
  ErrorNotice,
  Placeholder,
  usePending,
} from "../ui/states";

const roles: Role[] = ["owner", "editor", "team"];

/** Owners manage members and invitations, and review the accounts imported from the old app. */
export function MembersPage() {
  const { t, i18n } = useTranslation();
  const { slug } = useCommunity();
  const url = `/api/communities/${slug}/members`;
  const [version, setVersion] = useState(0);
  const {
    data: members,
    failed,
    retry,
  } = useJson<MemberRow[]>(url, version + useChanges(slug, "members"));
  const [lastOwner, setLastOwner] = useState(false);
  const [failedChange, setFailedChange] = useState<Change | null>(null);
  // After an invitation: whether its email went out, and to whom.
  const [invited, setInvited] = useState<{
    email: string;
    emailed: boolean;
  } | null>(null);
  const inviteAs = (email: string, roles: Role[]) =>
    act(async () => {
      const response = await send("POST", url, {
        email,
        roles,
        language: i18n.language,
      });
      if (response?.ok) {
        const { emailed } = (await response.clone().json()) as {
          emailed: boolean;
        };
        setInvited({ email, emailed });
      }
      return response;
    });

  /** Sends a change, then loads the members again. A change that didn't go through can be tried again. */
  const act = async (change: Change) => {
    const response = await change();
    const didntGoThrough = !response || response.status >= 500;
    setFailedChange(() => (didntGoThrough ? change : null));
    setLastOwner(response?.status === 409);
    setVersion((n) => n + 1);
  };
  const date = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(
          new Date(iso),
        )
      : "–";

  if (members === undefined)
    return failed ? (
      <ErrorNotice message={t("states.loadFailed")} onRetry={retry} />
    ) : (
      <Placeholder lines={8} />
    );
  if (members === null) return <p>{t("members.ownersOnly")}</p>;
  const current = members.filter((m) => m.status !== "imported");
  const imported = members.filter((m) => m.status === "imported");

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xl font-semibold">{t("members.title")}</h3>
      {lastOwner && (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t("members.lastOwner")}</Alert.Title>
          </Alert.Content>
        </Alert>
      )}
      {failedChange && (
        <ErrorNotice
          message={t("states.actionFailed")}
          onRetry={() => void act(failedChange)}
        />
      )}
      {invited && (
        <Alert status={invited.emailed ? "success" : "default"}>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>
              {t(invited.emailed ? "members.emailed" : "members.notEmailed", {
                email: invited.email,
                login: `${location.origin}/login`,
              })}
            </Alert.Title>
          </Alert.Content>
        </Alert>
      )}
      <InviteForm onInvite={inviteAs} />

      <div className="overflow-x-auto">
        <table className="w-full min-w-140">
          <tbody className={rows}>
            {current.map((m) => (
              <CurrentRow
                key={m.id}
                member={m}
                onRoles={(value) =>
                  act(() => send("PATCH", `${url}/${m.id}`, { roles: value }))
                }
                onRemove={() => act(() => send("DELETE", `${url}/${m.id}`))}
              />
            ))}
          </tbody>
        </table>
      </div>

      {imported.length > 0 && (
        <>
          <h3 className="text-xl font-semibold">{t("members.imported")}</h3>
          <p className="text-sm text-muted">{t("members.importedHelp")}</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-160">
              <thead>
                <tr className="text-start text-sm text-muted">
                  <th className={`${cell} text-start font-medium`}>
                    {t("members.person")}
                  </th>
                  <th className={`${cell} text-start font-medium`}>
                    {t("members.created")}
                  </th>
                  <th className={`${cell} text-start font-medium`}>
                    {t("members.lastActive")}
                  </th>
                  <th />
                </tr>
              </thead>
              <tbody className={rows}>
                {imported.map((m) => (
                  <ImportedRow
                    key={m.id}
                    member={m}
                    date={date}
                    onInvite={(r) => inviteAs(m.email ?? "", r)}
                    onDelete={() => act(() => send("DELETE", `${url}/${m.id}`))}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

type Change = () => Promise<Response | null>;

const rows = "divide-y divide-separator border-y border-separator";
const cell = "py-2 pe-4 align-middle";

function CurrentRow({
  member,
  onRoles,
  onRemove,
}: {
  member: MemberRow;
  onRoles: (roles: Role[]) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [changeRoles] = usePending(onRoles);
  const [remove, removing] = usePending(onRemove);
  return (
    <tr>
      <td className={cell}>
        <PersonName member={member} />
      </td>
      <td className={cell}>
        {member.status === "invited" && (
          <Chip size="sm" color="accent" variant="soft">
            {t("members.invited")}
          </Chip>
        )}
      </td>
      <td className={`${cell} min-w-60`}>
        <RolePicker
          label={t("members.roles", { name: member.name })}
          value={member.roles}
          onChange={(value) => value.length > 0 && void changeRoles(value)}
        />
      </td>
      <td className={`${cell} text-end`}>
        <RowMenu
          label={t("members.actions", { name: member.name })}
          isPending={removing}
          actions={[
            {
              id: "remove",
              icon: <UserMinus />,
              label: t("members.remove"),
              confirm: t("members.confirmRemove", { name: member.name }),
              onAction: () => void remove(),
            },
          ]}
        />
      </td>
    </tr>
  );
}

function PersonName({ member }: { member: MemberRow }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex items-center gap-2">
        {member.name}
        {member.wasAdmin && (
          <Chip size="sm" variant="secondary">
            {t("members.wasAdmin")}
          </Chip>
        )}
      </div>
      <div className="text-xs text-muted">{member.email}</div>
    </>
  );
}

/** One or more roles; `label` is shown with `showLabel`, and otherwise only read out. */
function RolePicker({
  label,
  showLabel = false,
  value,
  onChange,
}: {
  label: string;
  showLabel?: boolean;
  value: Role[];
  onChange: (roles: Role[]) => void;
}) {
  const { t } = useTranslation();
  return (
    <Select
      aria-label={showLabel ? undefined : label}
      selectionMode="multiple"
      value={value}
      onChange={(keys) => onChange(keys as Role[])}
      placeholder={t("members.noRoles")}
      className="w-48"
    >
      {showLabel && <Label>{label}</Label>}
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox selectionMode="multiple">
          {roles.map((role) => (
            <ListBox.Item key={role} id={role} textValue={t(`roles.${role}`)}>
              {t(`roles.${role}`)}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function InviteForm({
  onInvite,
}: {
  onInvite: (email: string, roles: Role[]) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [chosen, setChosen] = useState<Role[]>([]);
  const [invite, inviting] = usePending(async () => {
    await onInvite(email, chosen);
    setEmail("");
    setChosen([]);
  });
  return (
    <form
      className="flex flex-wrap items-end gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void invite();
      }}
    >
      <TextField type="email" isRequired value={email} onChange={setEmail}>
        <Label>{t("members.inviteEmail")}</Label>
        <Input />
      </TextField>
      <RolePicker
        label={t("members.inviteRoles")}
        showLabel
        value={chosen}
        onChange={setChosen}
      />
      <ActionButton
        type="submit"
        isDisabled={chosen.length === 0}
        isPending={inviting}
      >
        <UserPlus />
        {t("members.invite")}
      </ActionButton>
    </form>
  );
}

function ImportedRow({
  member,
  date,
  onInvite,
  onDelete,
}: {
  member: MemberRow;
  date: (iso: string | null) => string;
  onInvite: (roles: Role[]) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [chosen, setChosen] = useState<Role[]>([]);
  const [invite, inviting] = usePending(onInvite);
  const [remove, removing] = usePending(onDelete);
  return (
    <tr>
      <td className={cell}>
        <PersonName member={member} />
      </td>
      <td className={cell}>{date(member.createdAt)}</td>
      <td className={cell}>{date(member.lastActiveAt)}</td>
      <td className={cell}>
        <div className="flex items-center gap-2">
          <RolePicker
            label={t("members.roles", { name: member.name })}
            value={chosen}
            onChange={setChosen}
          />
          <ActionButton
            size="sm"
            isDisabled={chosen.length === 0}
            isPending={inviting}
            onPress={() => void invite(chosen)}
          >
            <UserPlus />
            {t("members.invite")}
          </ActionButton>
          <RowMenu
            label={t("members.actions", { name: member.name })}
            isPending={removing}
            actions={[
              {
                id: "delete",
                icon: <Trash2 />,
                label: t("members.delete"),
                confirm: t("members.confirmDelete", { name: member.name }),
                onAction: () => void remove(),
              },
            ]}
          />
        </div>
      </td>
    </tr>
  );
}
