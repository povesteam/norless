import { useTranslation } from "react-i18next";
import { chooseLanguage, languageChoice, uiLanguages } from "./i18n";

/** The interface language, each listed in its own name. A native select, so phones show their own picker. */
export function LanguagePicker() {
  const { t, i18n } = useTranslation();
  if (!languageChoice) return null;
  const ownName = (code: string) => {
    const name = new Intl.DisplayNames([code], { type: "language" }).of(code);
    return name ? name.charAt(0).toLocaleUpperCase(code) + name.slice(1) : code;
  };

  return (
    <select
      aria-label={t("language.label")}
      className="rounded-lg bg-field px-2 py-1 text-sm text-field-foreground"
      value={i18n.language}
      onChange={(event) => void chooseLanguage(event.currentTarget.value)}
    >
      {uiLanguages.map((code) => (
        <option key={code} value={code}>
          {ownName(code)}
        </option>
      ))}
    </select>
  );
}
