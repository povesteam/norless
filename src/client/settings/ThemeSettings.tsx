import { ImageOff, RotateCcw, Save } from "lucide-react";
import { Button, Input, Label, TextField } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ThemeStyle,
  useCommunity,
  useReloadCommunity,
} from "../data/community";
import { type Theme, themeProblems } from "../../shared/theme";
import { send } from "../data/fetch";
import { ActionButton, ErrorNotice, usePending } from "../ui/states";

/** The community's colors, font and logo, shown as they're chosen; low contrast can't be saved. */
export function ThemeSettings() {
  const { t } = useTranslation();
  const community = useCommunity();
  const reload = useReloadCommunity();
  const [draft, setDraft] = useState<Theme>(community.theme ?? {});
  const [state, setState] = useState<
    "saved" | "failed" | "bigLogo" | "bigFont" | null
  >(null);
  const set = (change: Partial<Theme>) => {
    setDraft({ ...draft, ...change });
    setState(null);
  };
  const problems = themeProblems(draft);
  const [save, saving] = usePending(async () => {
    const body = Object.fromEntries(
      Object.entries(draft).filter(([, value]) => value),
    );
    const response = await send(
      "PUT",
      `/api/communities/${community.slug}/theme`,
      body,
    );
    setState(response?.ok ? "saved" : "failed");
    if (response?.ok) reload();
  });
  // A font file as a data URL with its font type, whatever the browser calls the file.
  const pickFont = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 300_000) return setState("bigFont");
    const type = file.name.toLowerCase().endsWith(".woff") ? "woff" : "woff2";
    const reader = new FileReader();
    reader.onload = () =>
      set({
        fontFile: String(reader.result).replace(
          /^data:[^;]*;base64,/,
          `data:font/${type};base64,`,
        ),
        fontFileUrl: undefined,
      });
    reader.readAsDataURL(file);
  };
  const pickLogo = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 200_000) return setState("bigLogo");
    const reader = new FileReader();
    reader.onload = () => set({ logo: String(reader.result) });
    reader.readAsDataURL(file);
  };
  const color = (field: "color" | "tint") => (
    <div className="flex items-center gap-2 text-sm">
      <input
        type="color"
        aria-label={t(`theme.${field}`)}
        value={draft[field] ?? (field === "color" ? "#3b82f6" : "#f7f7f7")}
        onChange={(event) => set({ [field]: event.currentTarget.value })}
        className="h-8 w-12 cursor-pointer rounded border border-separator"
      />
      <span>{t(`theme.${field}`)}</span>
      {draft[field] && (
        <Button
          size="sm"
          variant="ghost"
          onPress={() => set({ [field]: undefined })}
        >
          <RotateCcw />
          {t("theme.reset")}
        </Button>
      )}
    </div>
  );

  return (
    <section aria-labelledby="theme-title" className="flex flex-col gap-4">
      {/* The page shows the theme as it's chosen. */}
      <ThemeStyle theme={draft} />
      <h3 id="theme-title" className="text-xl font-semibold">
        {t("theme.title")}
      </h3>
      <p className="text-sm text-muted">{t("theme.help")}</p>
      <div className="flex flex-wrap gap-6">
        {color("color")}
        {color("tint")}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField value={draft.font ?? ""} onChange={(font) => set({ font })}>
          <Label>{t("theme.font")}</Label>
          <Input />
        </TextField>
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          <span>{t("theme.fontFile")}</span>
          <input
            type="file"
            accept=".woff2,.woff,font/woff2,font/woff"
            className="max-w-full"
            onChange={(event) => pickFont(event.currentTarget.files?.[0])}
          />
          <span className="text-muted">
            {draft.fontFile || draft.fontFileUrl
              ? t("theme.fontFileSet")
              : t("theme.fontFileHelp")}
          </span>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {draft.logo && (
          <img src={draft.logo} alt={t("theme.logo")} className="h-12 w-auto" />
        )}
        <label className="flex min-w-0 flex-col gap-1">
          {t("theme.logo")}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="max-w-full"
            onChange={(event) => pickLogo(event.currentTarget.files?.[0])}
          />
        </label>
        {draft.logo && (
          <Button
            size="sm"
            variant="ghost"
            onPress={() => set({ logo: undefined })}
          >
            <ImageOff />
            {t("theme.removeLogo")}
          </Button>
        )}
      </div>
      {problems.map((problem) => (
        <p key={problem} role="alert" className="text-sm text-danger">
          {t(`theme.problems.${problem}`)}
        </p>
      ))}
      {(state === "bigLogo" || state === "bigFont") && (
        <p role="alert" className="text-sm text-danger">
          {t(`theme.problems.${state}`)}
        </p>
      )}
      {state === "failed" && <ErrorNotice message={t("states.actionFailed")} />}
      <div className="flex items-center gap-3">
        <ActionButton
          isPending={saving}
          isDisabled={problems.length > 0}
          onPress={() => void save()}
        >
          <Save />
          {t("theme.save")}
        </ActionButton>
        <span className="text-sm text-muted" aria-live="polite">
          {state === "saved" ? t("editor.saved") : ""}
        </span>
      </div>
    </section>
  );
}
