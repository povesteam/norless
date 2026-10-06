import { Plus } from "lucide-react";
import {
  Button,
  Dropdown,
  Input,
  Label,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCommunity } from "../data/community";
import { SmallSlides, UnclosedRepeats } from "../data/editing";
import type { Draft } from "./SongEditor";

/**
 * The member's language on the left and another on the right, each whole text in one
 * text area. The right side has a tab per other language the song has, and "+" for one
 * it hasn't.
 */
export function SideBySide({
  versions,
  saved,
  onChange,
}: {
  versions: Draft["versions"];
  /** The languages the song has saved versions in. */
  saved: string[];
  onChange: (language: string, field: "title" | "text", value: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { languages } = useCommunity();
  const names = new Intl.DisplayNames([i18n.language], { type: "language" });
  const nameOf = (code: string) => {
    const name = names.of(code) ?? code;
    return name.charAt(0).toLocaleUpperCase(i18n.language) + name.slice(1);
  };
  const first = languages.includes(i18n.language)
    ? i18n.language
    : (languages[0] ?? "ro");
  const [added, setAdded] = useState<string[]>([]);
  const has = (l: string) =>
    saved.includes(l) ||
    added.includes(l) ||
    !!versions[l]?.title ||
    !!versions[l]?.text;
  const others = languages.filter((l) => l !== first);
  const tabs = others.filter(has);
  const missing = others.filter((l) => !has(l));
  const [chosen, setChosen] = useState<string>();
  const second = chosen && tabs.includes(chosen) ? chosen : tabs[0];
  const text = (l: string | undefined) => (l ? (versions[l]?.text ?? "") : "");
  const title = (language: string) => (
    <TextField
      value={versions[language]?.title ?? ""}
      onChange={(value) => onChange(language, "title", value)}
    >
      <Label>
        {t("editor.titleIn", { language: names.of(language) ?? language })}
      </Label>
      <Input />
    </TextField>
  );
  const whole = (language: string) => (
    <TextField
      value={text(language)}
      onChange={(value) => onChange(language, "text", value)}
      aria-label={t("editor.textIn", {
        language: names.of(language) ?? language,
      })}
    >
      {/* Chords sit over lyrics by column, so the text is monospace. */}
      {/* Room for two verses when empty; it grows with the text. */}
      <TextArea className="min-h-[14lh] field-sizing-content font-mono" />
    </TextField>
  );

  return (
    <div className="grid grid-cols-2 items-start gap-x-4 gap-y-2">
      <span className="flex h-8 items-center text-sm font-semibold">
        {nameOf(first)}
      </span>
      <div className="flex h-8 items-center gap-2">
        {tabs.length > 0 && (
          <ToggleButtonGroup
            aria-label={t("editor.secondLanguage")}
            selectionMode="single"
            disallowEmptySelection
            size="sm"
            selectedKeys={second ? [second] : []}
            onSelectionChange={(keys) => {
              const [key] = keys;
              if (key !== undefined) setChosen(String(key));
            }}
          >
            {tabs.map((l, i) => (
              <ToggleButton key={l} id={l}>
                {i > 0 && <ToggleButtonGroup.Separator />}
                {nameOf(l)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}
        {missing.length > 0 && (
          <Dropdown>
            <Button
              size="sm"
              variant="secondary"
              isIconOnly
              aria-label={t("editor.addLanguage")}
            >
              <Plus />
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu
                onAction={(key) => {
                  setAdded([...added, String(key)]);
                  setChosen(String(key));
                }}
              >
                {missing.map((l) => (
                  <Dropdown.Item key={l} id={l} textValue={nameOf(l)}>
                    <Label>{nameOf(l)}</Label>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        )}
      </div>
      {title(first)}
      {second ? title(second) : <div />}
      {whole(first)}
      {second ? whole(second) : <div />}
      <div className="flex flex-col gap-2">
        <UnclosedRepeats text={text(first)} />
        <SmallSlides text={text(first)} />
      </div>
      <div className="flex flex-col gap-2">
        <UnclosedRepeats text={text(second)} />
        <SmallSlides text={text(second)} />
      </div>
    </div>
  );
}
