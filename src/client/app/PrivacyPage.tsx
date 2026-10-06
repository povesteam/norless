import { useTranslation } from "react-i18next";
import type { PrivacyContact } from "../../server/community/privacy";
import { useJson } from "../data/fetch";
import { ErrorNotice, Placeholder } from "../ui/states";

type Privacy = {
  operator: string | null;
  services: string[];
  communities: { name: string; slug: string; contact: PrivacyContact }[];
};

const kept = [
  "account",
  "google",
  "history",
  "sessions",
  "links",
  "preferences",
  "usage",
  "online",
  "logs",
  "recordings",
  "backups",
] as const;

/** /privacy: what Norless keeps about people, why, for how long, and who answers for it. */
export function PrivacyPage() {
  const { t } = useTranslation();
  const { data, failed, retry } = useJson<Privacy>("/api/privacy");
  if (data === undefined)
    return failed ? (
      <ErrorNotice message={t("states.loadFailed")} onRetry={retry} />
    ) : (
      <Placeholder lines={8} />
    );
  if (data === null) return null;
  return (
    <article className="flex max-w-2xl flex-col gap-4">
      <h2 className="text-2xl font-semibold">{t("privacy.title")}</h2>
      <p>{t("privacy.intro")}</p>

      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">
          {t("privacy.responsibleTitle")}
        </h3>
        <p>{t("privacy.responsible")}</p>
        <ul className="flex flex-col gap-1">
          {data.communities.map(({ slug, name, contact }) => (
            <li key={slug}>
              <span className="font-medium">{contact.name ?? name}</span>
              {contact.address && <>, {contact.address}</>}
              {contact.email ? (
                <>
                  {" "}
                  (
                  <a className="link" href={`mailto:${contact.email}`}>
                    {contact.email}
                  </a>
                  )
                </>
              ) : (
                <span className="text-muted"> ({t("privacy.noContact")})</span>
              )}
            </li>
          ))}
        </ul>
        {data.operator && (
          <p>{t("privacy.operator", { operator: data.operator })}</p>
        )}
        {data.services.length > 0 && (
          <>
            <p>{t("privacy.services")}</p>
            <ul className="list-disc ps-6">
              {data.services.map((service) => (
                <li key={service}>{service}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">{t("privacy.keptTitle")}</h3>
        <ul className="list-disc ps-6">
          {kept.map((item) => (
            <li key={item}>{t(`privacy.kept.${item}`)}</li>
          ))}
        </ul>
        <p>{t("privacy.why")}</p>
        <p>{t("privacy.visitors")}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">{t("privacy.cookiesTitle")}</h3>
        <p>{t("privacy.cookies")}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">{t("privacy.rightsTitle")}</h3>
        <p>{t("privacy.rights")}</p>
        <p>{t("privacy.delete")}</p>
      </section>
    </article>
  );
}
