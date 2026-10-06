import { House } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

export function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-start gap-2">
      <p>{t("notFound.message")}</p>
      {/* ~ leaves the nested community route */}
      <Link href="~/" className="link">
        <House />
        {t("notFound.home")}
      </Link>
    </div>
  );
}
