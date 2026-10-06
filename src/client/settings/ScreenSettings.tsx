import {
  Copy,
  ExternalLink,
  KeyRound,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  Button,
  buttonVariants,
  Checkbox,
  Chip,
  Input,
  Label,
  Modal,
  TextField,
} from "@heroui/react";
import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type Screen,
  type ScreenSettings,
  type ScreenType,
  screenTypes,
} from "../../shared/screens";
import type { SectionType } from "../../shared/song-text";
import { useCommunity } from "../data/community";
import { LanguageMark, ScreenIcon } from "../ui/icons";
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
import { RowMenu } from "../ui/RowMenu";

/** The room's screens: each opens at its own secret link, which can be renewed. */
export function Screens() {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const url = `/api/communities/${slug}/screens`;
  const [version, setVersion] = useState(0);
  const {
    data: screens,
    failed,
    retry,
  } = useJson<Screen[]>(url, version + useChanges(slug, "screens"));
  const [editing, setEditing] = useState<Screen | "new" | null>(null);
  const [problem, setProblem] = useState(false);
  const reload = () => setVersion((n) => n + 1);
  const change = async (request: Promise<Response | null>) => {
    const response = await request;
    setProblem(!response?.ok);
    reload();
    return !!response?.ok;
  };

  if (screens === undefined)
    return failed ? (
      <ErrorNotice message={t("states.loadFailed")} onRetry={retry} />
    ) : (
      <Placeholder lines={3} />
    );
  if (screens === null) return null;
  // Its short link, the same to open and to copy.
  const link = (screen: Screen) =>
    `${location.origin}/${screen.code ?? `s/${screen.secret}`}`;

  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-xl font-semibold">{t("screens.title")}</h3>
      <p className="text-sm text-muted">{t("screens.help")}</p>
      {problem && <ErrorNotice message={t("states.actionFailed")} />}
      <div>
        <Button onPress={() => setEditing("new")}>
          <Plus />
          {t("screens.add")}
        </Button>
      </div>
      {screens.length === 0 ? (
        <Empty
          title={t("screens.empty")}
          description={t("screens.emptyHelp")}
        />
      ) : (
        <ul className="divide-y divide-separator border-y border-separator">
          {screens.map((screen) => (
            <li
              key={screen.id}
              aria-label={screen.name}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
            >
              <ScreenIcon type={screen.type} className="text-muted" />
              <span className="font-medium">{screen.name}</span>
              <Chip size="sm" variant="soft">
                {t(`screens.types.${screen.type}`)}
              </Chip>
              <span className="inline-flex items-center gap-1 text-sm text-muted">
                {screen.languages.map((l, i) => (
                  <Fragment key={l}>
                    {i > 0 && " + "}
                    <LanguageMark language={l} />
                  </Fragment>
                ))}
              </span>
              <span className="ms-auto flex flex-wrap gap-1">
                {/* A link that looks like the buttons beside it. */}
                <a
                  className={buttonVariants({ size: "sm", variant: "ghost" })}
                  href={link(screen)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink />
                  {t("screens.open")}
                </a>
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() =>
                    void navigator.clipboard.writeText(link(screen))
                  }
                >
                  <Copy />
                  {t("screens.copy")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => setEditing(screen)}
                >
                  <Pencil />
                  {t("playlist.edit")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() =>
                    window.confirm(
                      t("screens.confirmSecret", { name: screen.name }),
                    ) && void change(send("POST", `${url}/${screen.id}/secret`))
                  }
                >
                  <KeyRound />
                  {t("screens.newLink")}
                </Button>
                {/* Deleting in ⋯, as on the other settings' rows. */}
                <RowMenu
                  label={t("schedule.actions", { name: screen.name })}
                  actions={[
                    {
                      id: "delete",
                      icon: <Trash2 />,
                      label: t("members.delete"),
                      confirm: t("screens.confirmDelete", {
                        name: screen.name,
                      }),
                      onAction: () =>
                        void change(send("DELETE", `${url}/${screen.id}`)),
                    },
                  ]}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <ScreenEditor
          screen={editing === "new" ? null : editing}
          onSave={(input) =>
            change(
              editing === "new"
                ? send("POST", url, input)
                : send("PUT", `${url}/${editing.id}`, input),
            )
          }
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function ScreenEditor({
  screen,
  onSave,
  onClose,
}: {
  screen: Screen | null;
  onSave: (input: Omit<Screen, "id" | "secret">) => Promise<boolean>;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { languages } = useCommunity();
  const [name, setName] = useState(screen?.name ?? "");
  const [type, setType] = useState<ScreenType>(screen?.type ?? "projector");
  const [first, setFirst] = useState(
    screen?.languages[0] ?? languages[0] ?? "ro",
  );
  const [second, setSecond] = useState(screen?.languages[1] ?? "");
  const [split, setSplit] = useState(screen?.settings.split ?? "rows");
  const [overlayBackground, setOverlayBackground] = useState(
    screen?.settings.overlayBackground ?? "transparent",
  );
  const [look, setLook] = useState<ScreenSettings>(screen?.settings ?? {});
  const styled = (type: SectionType, style: "italic" | "bold") =>
    look.sectionStyles?.[type]?.[style] ??
    (style === "italic" && type === "refrain");
  const setStyled = (
    type: SectionType,
    style: "italic" | "bold",
    on: boolean,
  ) =>
    setLook({
      ...look,
      sectionStyles: {
        ...look.sectionStyles,
        [type]: { ...look.sectionStyles?.[type], [style]: on },
      },
    });
  const [save, saving] = usePending(async () => {
    const ok = await onSave({
      name,
      type,
      languages: second && second !== first ? [first, second] : [first],
      layout: screen?.layout ?? null,
      settings: {
        ...screen?.settings,
        ...look,
        backgroundImage: look.backgroundImage || undefined,
        font: look.font || undefined,
        split,
        ...(type === "overlay" ? { overlayBackground } : {}),
      },
    });
    if (ok) onClose();
  });
  const names = new Intl.DisplayNames([i18n.language], { type: "language" });
  const languageOptions = languages.map((id) => ({
    id,
    name: names.of(id) ?? id,
  }));

  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>
              {screen ? screen.name : t("screens.add")}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <TextField value={name} onChange={setName} isRequired autoFocus>
              <Label>{t("schedule.name")}</Label>
              <Input />
            </TextField>
            <Choice
              label={t("schedule.type")}
              value={type}
              onChange={(v) => setType(v as ScreenType)}
              options={screenTypes.map((id) => ({
                id,
                name: t(`screens.types.${id}`),
              }))}
            />
            <Choice
              label={t("screens.language")}
              value={first}
              onChange={setFirst}
              options={languageOptions}
            />
            <Choice
              label={t("screens.secondLanguage")}
              value={second || "none"}
              onChange={(v) => setSecond(v === "none" ? "" : v)}
              options={[
                { id: "none", name: t("screens.none") },
                ...languageOptions.filter((o) => o.id !== first),
              ]}
            />
            {type === "overlay" && (
              <Choice
                label={t("screens.overlayBackground")}
                value={overlayBackground}
                onChange={(v) =>
                  setOverlayBackground(v as typeof overlayBackground)
                }
                options={(["transparent", "green", "black"] as const).map(
                  (id) => ({ id, name: t(`screens.backgrounds.${id}`) }),
                )}
              />
            )}
            {type !== "musicians" && type !== "vocalists" && (
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-1 font-semibold">
                  {t("screens.look")}
                </legend>
                <div className="flex flex-wrap gap-4">
                  {(["background", "textColor"] as const).map((field) => (
                    <label
                      key={field}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="color"
                        value={
                          look[field] ??
                          (field === "background" ? "#000000" : "#ffffff")
                        }
                        onChange={(e) =>
                          setLook({ ...look, [field]: e.currentTarget.value })
                        }
                      />
                      {t(`screens.${field}`)}
                    </label>
                  ))}
                </div>
                <TextField
                  value={look.font ?? ""}
                  onChange={(font) => setLook({ ...look, font })}
                >
                  <Label>{t("screens.font")}</Label>
                  <Input placeholder="Inter, sans-serif" />
                </TextField>
                <TextField
                  type="url"
                  value={look.backgroundImage ?? ""}
                  onChange={(backgroundImage) =>
                    setLook({ ...look, backgroundImage })
                  }
                >
                  <Label>{t("screens.backgroundImage")}</Label>
                  <Input placeholder="https://" />
                </TextField>
                {look.backgroundImage && (
                  <label className="flex items-center gap-2 text-sm">
                    {t("screens.imageOpacity", {
                      percent: Math.round((look.imageOpacity ?? 0.4) * 100),
                    })}
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={look.imageOpacity ?? 0.4}
                      onChange={(e) =>
                        setLook({
                          ...look,
                          imageOpacity: Number(e.currentTarget.value),
                        })
                      }
                    />
                  </label>
                )}
                <Checkbox
                  isSelected={look.clock ?? false}
                  onChange={(clock) => setLook({ ...look, clock })}
                >
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    {t("screens.clock")}
                  </Checkbox.Content>
                </Checkbox>
                {type === "projector" && (
                  <table className="text-sm">
                    <thead>
                      <tr className="text-muted">
                        <th className="text-start font-medium">
                          {t("screens.sections")}
                        </th>
                        <th className="font-medium">{t("screens.italic")}</th>
                        <th className="font-medium">{t("screens.bold")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          "verse",
                          "refrain",
                          "bridge",
                          "pre-chorus",
                          "intro",
                          "ending",
                        ] as const
                      ).map((sectionType) => (
                        <tr key={sectionType}>
                          <td>{t(`live.types.${sectionType}`)}</td>
                          {(["italic", "bold"] as const).map((style) => (
                            <td key={style} className="text-center">
                              <input
                                type="checkbox"
                                aria-label={`${t(`live.types.${sectionType}`)}: ${t(`screens.${style}`)}`}
                                checked={styled(sectionType, style)}
                                onChange={(e) =>
                                  setStyled(
                                    sectionType,
                                    style,
                                    e.currentTarget.checked,
                                  )
                                }
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </fieldset>
            )}
            {second && type === "projector" && (
              <Choice
                label={t("screens.split")}
                value={split}
                onChange={(v) => setSplit(v as "rows" | "columns")}
                options={[
                  { id: "rows", name: t("screens.rows") },
                  { id: "columns", name: t("screens.columns") },
                ]}
              />
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={onClose}>
              <X />
              {t("editor.close")}
            </Button>
            <ActionButton
              isPending={saving}
              isDisabled={!name.trim()}
              onPress={() => void save()}
            >
              <Save />
              {t("editor.save")}
            </ActionButton>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
