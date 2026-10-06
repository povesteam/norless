import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useCommunity } from "../data/community";
import { send } from "../data/fetch";
import { hasRole, useRoles } from "../data/me";
import { ActionButton, Empty, ErrorNotice, usePending } from "../ui/states";

/** Nothing planned yet, and for the team the first playlist. */
export function NoPlaylists() {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const canChange = hasRole(useRoles(slug), "team");
  return (
    <Empty title={t("playlists.empty")} description={t("playlists.emptyHelp")}>
      {canChange && <NewPlaylistButton label={t("playlists.createFirst")} />}
    </Empty>
  );
}

/** Creates a playlist without a title, which its date names, and opens it. */
export function NewPlaylistButton({ label }: { label?: string }) {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const [, navigate] = useLocation();
  const [failed, setFailed] = useState(false);
  const [create, creating] = usePending(async () => {
    const response = await send(
      "POST",
      `/api/communities/${slug}/playlists`,
      {},
    );
    setFailed(!response?.ok);
    if (!response?.ok) return;
    const { id } = (await response.json()) as { id: string };
    navigate(`/playlists/${id}`);
  });
  return (
    <div className="flex flex-col items-start gap-2">
      <ActionButton isPending={creating} onPress={() => void create()}>
        <Plus />
        {label ?? t("playlists.new")}
      </ActionButton>
      {failed && <ErrorNotice message={t("states.actionFailed")} />}
    </div>
  );
}
