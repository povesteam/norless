import { Check, Link2 } from "lucide-react";
import { Button } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCommunity } from "../data/community";
import { send } from "../data/fetch";
import { Tip } from "../ui/tip";

/**
 * Copies a short link to a playlist or song (norless.com/x9Kp4w), for chats. Where the
 * browser won't copy, the link shows instead, to copy by hand.
 */
export function ShareLink({
  kind,
  id,
  compact = false,
}: {
  kind: "playlist" | "song";
  id: string;
  /** Its icon alone, e.g. in a phone's row. */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { share, state } = useShareLink(kind, id);
  const label = state === "copied" ? t("share.copied") : t("share.copy");
  const icon = state === "copied" ? <Check /> : <Link2 />;
  return (
    <span className="flex items-center gap-2 text-sm">
      {compact ? (
        <Tip label={label}>
          <Button
            size="sm"
            variant="ghost"
            isIconOnly
            aria-label={label}
            onPress={() => void share()}
          >
            {icon}
          </Button>
        </Tip>
      ) : (
        <Button size="sm" variant="ghost" onPress={() => void share()}>
          {icon}
          {label}
        </Button>
      )}
      <ShareResult state={state} />
    </span>
  );
}

/** Making and copying the short link; `state` says how it went, or is the link to copy. */
export function useShareLink(kind: "playlist" | "song", id: string) {
  const { slug } = useCommunity();
  const [state, setState] = useState<"copied" | "failed" | string | null>(null);
  const share = async () => {
    const response = await send(
      "POST",
      `/api/communities/${slug}/short-codes`,
      {
        kind,
        id,
      },
    );
    if (!response?.ok) return setState("failed");
    const { code } = (await response.json()) as { code: string };
    const link = `${location.origin}/${code}`;
    try {
      await navigator.clipboard.writeText(link);
      setState("copied");
    } catch {
      setState(link);
    }
  };
  return { share, state };
}

/** What became of a copy: failed, or the link to copy by hand. */
export function ShareResult({ state }: { state: string | null }) {
  const { t } = useTranslation();
  return (
    <>
      {state === "failed" && (
        <span role="alert" className="text-sm text-danger">
          {t("states.actionFailed")}
        </span>
      )}
      {state && state !== "copied" && state !== "failed" && (
        <output className="text-sm select-all font-mono">{state}</output>
      )}
    </>
  );
}
