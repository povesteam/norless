import { ComboBox, Label, ListBox, Tag, TagGroup } from "@heroui/react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ComboBoxInput,
  FirstOptionSelected,
  useOptionsFrame,
} from "../ui/combobox";

/** The song's tags, each removable, and a box that adds a known tag or a new one. */
export function TagsField({
  tags,
  known,
  onChange,
}: {
  tags: string[];
  known: string[];
  onChange: (tags: string[]) => void;
}) {
  const { t } = useTranslation();
  const labelId = useId();
  const [query, setQuery] = useState("");
  const frame = useOptionsFrame();
  const typed = query.trim();
  const matches = known
    .filter(
      (tag) =>
        !tags.includes(tag) &&
        tag.toLocaleLowerCase().includes(typed.toLocaleLowerCase()),
    )
    .sort((a, b) => Number(b === typed) - Number(a === typed));
  // A new tag comes first, so Enter adds what was typed.
  const options = [
    ...(typed && !known.includes(typed) && !tags.includes(typed)
      ? [{ id: typed, label: t("editor.newTag", { tag: typed }) }]
      : []),
    ...matches.map((tag) => ({ id: tag, label: tag })),
  ];

  // The chosen tags come first, then the box: its list opens below and never covers them.
  return (
    <div className="flex flex-col gap-2">
      <Label id={labelId}>{t("editor.tags")}</Label>
      {tags.length > 0 && (
        <TagGroup
          aria-labelledby={labelId}
          onRemove={(keys) => onChange(tags.filter((tag) => !keys.has(tag)))}
        >
          <TagGroup.List items={tags.map((tag) => ({ id: tag }))}>
            {(item) => <Tag id={item.id}>{item.id}</Tag>}
          </TagGroup.List>
        </TagGroup>
      )}
      <ComboBox
        aria-labelledby={labelId}
        items={options}
        inputValue={query}
        onInputChange={setQuery}
        value={null}
        onChange={(id) => {
          if (id === null) return;
          onChange([...tags, String(id)]);
          setQuery("");
        }}
        menuTrigger="focus"
      >
        <ComboBox.InputGroup>
          <ComboBoxInput placeholder={t("editor.addTag")} {...frame.input} />
        </ComboBox.InputGroup>
        <ComboBox.Popover placement="bottom start" shouldFlip={false}>
          <ListBox {...frame.list}>
            {(option: { id: string; label: string }) => (
              <ListBox.Item id={option.id} textValue={option.label}>
                {option.label}
              </ListBox.Item>
            )}
          </ListBox>
        </ComboBox.Popover>
        <FirstOptionSelected options={typed} />
      </ComboBox>
    </div>
  );
}
