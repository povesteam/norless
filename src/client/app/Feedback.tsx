import { Archive, ArchiveRestore } from "lucide-react";
import { Button, Checkbox } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Feedback } from "../../server/community/feedback";
import { useCommunity } from "../data/community";
import { RequestedFeatures } from "./FeatureTree";
import { send, useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import { hasRole, useMe, useRoles } from "../data/me";
import { Empty, ErrorNotice, Placeholder } from "../ui/states";
import { FeedbackButton } from "./FeedbackDialog";

/** /ideas: what members sent, newest first, for owners, who archive what they handled. */
export function IdeasPage() {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  if (!hasRole(useRoles(slug), "owner"))
    return <p>{t("feedback.ownersOnly")}</p>;
  return (
    <div className="flex flex-col gap-8">
      <Ideas
        title={t("feedback.title")}
        slug={slug}
        url={`/api/communities/${slug}/feedback`}
        actions={<FeedbackButton onIdeasPage />}
      />
      <RequestedFeatures />
    </div>
  );
}

/** /app-ideas: what members of every community sent to the Norless app team. */
export function AppIdeasPage() {
  const { t } = useTranslation();
  const { me } = useMe();
  if (!me) return <Placeholder lines={4} />;
  if (!me.appTeam) return <p>{t("feedback.appOnly")}</p>;
  return <Ideas title={t("feedback.appTitle")} url="/api/app-feedback" />;
}

/** A list of ideas, newest first, the handled ones archived; `actions` beside its title. */
function Ideas({
  title,
  slug,
  url,
  actions,
}: {
  title: string;
  /** A community's ideas, which load again when one comes in. */
  slug?: string;
  url: string;
  actions?: React.ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const [archived, setArchived] = useState(false);
  const [version, setVersion] = useState(0);
  const { data, failed, retry } = useJson<Feedback[]>(
    `${url}${archived ? "?archived=true" : ""}`,
    version + useChanges(slug, "feedback"),
  );
  const [failedChange, setFailedChange] = useState(false);
  const archive = async (id: string, value: boolean) => {
    const response = await send("PATCH", `${url}/${id}`, { archived: value });
    setFailedChange(!response?.ok);
    setVersion((n) => n + 1);
  };
  const when = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
  });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold">{title}</h2>
        <span className="flex-1" />
        {actions}
        <Checkbox isSelected={archived} onChange={setArchived}>
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            {t("feedback.showArchived")}
          </Checkbox.Content>
        </Checkbox>
      </div>
      {failedChange && <ErrorNotice message={t("states.actionFailed")} />}
      {data === undefined ? (
        failed ? (
          <ErrorNotice message={t("states.loadFailed")} onRetry={retry} />
        ) : (
          <Placeholder lines={6} />
        )
      ) : !data?.length ? (
        <Empty
          title={t(archived ? "feedback.noArchived" : "feedback.empty")}
          description={t("feedback.emptyHelp")}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 rounded-xl border border-separator p-3"
            >
              <p className="whitespace-pre-wrap">{item.text}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <span>{item.from ?? t("feedback.someone")}</span>
                {item.community && <span>{item.community}</span>}
                <span>{when.format(new Date(item.createdAt))}</span>
                <span>
                  {item.page} · {t(`device.${item.deviceType}`)}
                </span>
                <span className="flex-1" />
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => void archive(item.id, !item.archivedAt)}
                >
                  {item.archivedAt ? <ArchiveRestore /> : <Archive />}
                  {t(item.archivedAt ? "feedback.restore" : "feedback.archive")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
