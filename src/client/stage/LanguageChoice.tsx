import { Button, Dropdown, Label } from "@heroui/react";
import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageFlag, LanguageMark, languageCode } from "../ui/icons";
import { Tip } from "../ui/tip";

/**
 * The languages shown: one button with the chosen language's flag, or a globe for all,
 * that opens the choice, so the toolbar keeps its room on a phone.
 */
export function LanguageChoice({
  languages,
  choice,
  onChoose,
}: {
  languages: string[];
  choice: string;
  onChoose: (choice: string) => void;
}) {
  const { t } = useTranslation();
  const label = t("vocalists.languages");
  return (
    <Dropdown>
      <Tip label={label}>
        <Button isIconOnly size="sm" variant="secondary" aria-label={label}>
          {choice === "all" ? <Globe /> : <LanguageFlag language={choice} />}
        </Button>
      </Tip>
      <Dropdown.Popover placement="bottom start">
        <Dropdown.Menu
          aria-label={label}
          selectionMode="single"
          selectedKeys={[choice]}
          onSelectionChange={(keys) => {
            const [key] = keys === "all" ? [] : keys;
            if (key !== undefined) onChoose(String(key));
          }}
        >
          {[...languages, "all"].map((l) => (
            <Dropdown.Item
              key={l}
              id={l}
              textValue={l === "all" ? t("vocalists.all") : languageCode(l)}
            >
              <Dropdown.ItemIndicator type="dot" />
              {l === "all" ? (
                <>
                  <Globe />
                  <Label>{t("vocalists.all")}</Label>
                </>
              ) : (
                <Label>
                  <LanguageMark language={l} />
                </Label>
              )}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
