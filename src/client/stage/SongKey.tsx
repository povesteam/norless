import { Button } from "@heroui/react";
import { KeyRound } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { LiveView } from "../../server/live/live-view";
import type { Entry } from "../../server/playlists/playlists";
import { ServiceKeyDialog } from "../songs/KeyDialog";

/** A song's key with its icon instead of "Key:", read out as "Key D". */
export function KeyMark({ shown }: { shown: string }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <KeyRound
        role="img"
        aria-label={t("keys.forThisService")}
        className="size-[0.9em]"
      />
      {shown}
    </span>
  );
}

/**
 * The key the live song is played in, in the stage views; for the team, a tap opens the
 * key for this service of its playlist entry.
 */
export function SongKey({
  slug,
  view,
  shown,
  canChange,
}: {
  slug: string;
  view: LiveView | undefined;
  shown: string;
  canChange: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const entry = view?.entry;
  const mark = (
    <span className="text-lg font-semibold">
      <KeyMark shown={shown} />
    </span>
  );
  if (!canChange || !view?.playlistId || !entry?.song) return mark;
  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        aria-label={`${t("keys.forService")}: ${shown}`}
        onPress={() => setOpen(true)}
      >
        {mark}
      </Button>
      {open && (
        <ServiceKeyDialog
          slug={slug}
          playlistId={view.playlistId}
          entry={entry as Entry & { song: NonNullable<Entry["song"]> }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
