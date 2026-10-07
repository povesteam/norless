import { buttonVariants } from "@heroui/react";
import { ArrowLeft, House } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

/** A page that doesn't exist: back where the person came from first, the start page second. */
export function NotFound() {
  const { t } = useTranslation();
  // Opened straight from a link, there's nowhere to go back to.
  const back = history.length > 1;
  return (
    <div className="flex flex-col items-start gap-3">
      <p>{t("notFound.message")}</p>
      {back && (
        <button
          type="button"
          className={buttonVariants()}
          onClick={() => history.back()}
        >
          <ArrowLeft />
          {t("notFound.back")}
        </button>
      )}
      {/* ~ leaves the nested community route */}
      <Link href="~/" className="link">
        <House />
        {t("notFound.home")}
      </Link>
    </div>
  );
}
