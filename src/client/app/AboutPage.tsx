import { useTranslation } from "react-i18next";
import { useJson } from "../data/fetch";
import { ErrorNotice, Placeholder } from "../ui/states";

/** /about: what Norless is, its license, and the running version's source code. */
export function AboutPage() {
  const { t } = useTranslation();
  const { data, failed, retry } = useJson<{ source: string | null }>(
    "/api/about",
  );
  return (
    <article className="flex max-w-2xl flex-col gap-3">
      <h2 className="text-2xl font-semibold">{t("about.title")}</h2>
      <p>{t("about.what")}</p>
      <p>{t("about.license")}</p>
      <p>
        <a
          className="link"
          href="https://www.gnu.org/licenses/agpl-3.0.html"
          rel="license"
        >
          {t("about.licenseLink")}
        </a>
      </p>
      <p>{t("about.sounds")}</p>
      <p>
        <a
          className="link"
          href="https://creativecommons.org/licenses/by/3.0/"
          rel="license"
        >
          {t("about.soundsLicense")}
        </a>
      </p>
      {data === undefined ? (
        failed ? (
          <ErrorNotice message={t("states.loadFailed")} onRetry={retry} />
        ) : (
          <Placeholder lines={1} />
        )
      ) : data?.source ? (
        <p>
          <a className="link" href={data.source}>
            {t("about.source")}
          </a>
        </p>
      ) : (
        <p className="text-muted">{t("about.noSource")}</p>
      )}
    </article>
  );
}
