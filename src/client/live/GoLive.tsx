import { Button } from "@heroui/react";
import { Play, Radio } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCommunity } from "../data/community";
import { useIsMember } from "../data/me";
import { useLiveView } from "../data/room";
import { NameAvatar } from "../ui/NameAvatar";

/**
 * Go live, or the Live mark once it is: both in one cell, the other hidden, so going live
 * moves nothing (Classic's selected entry, and the parts of the Phone and Operator layouts).
 */
export function GoLive({
  isLive,
  onGo,
}: {
  isLive: boolean;
  onGo: () => void;
}) {
  const { t } = useTranslation();
  // Who controls live, for members (visitors' live state has no names).
  const { slug } = useCommunity();
  const by = useLiveView(slug)?.changedBy;
  const member = useIsMember(slug);
  return (
    <span className="grid *:[grid-area:1/1]">
      <Button className={isLive ? "invisible" : undefined} onPress={onGo}>
        <Play />
        {t("classic.goLive")}
      </Button>
      {/* A status, not a button: no frame or fill. */}
      <span
        className={`inline-flex h-10 items-center justify-center gap-2 px-4 text-sm font-semibold md:h-9 ${
          isLive ? "" : "invisible"
        }`}
      >
        <Radio className="size-4 text-live" />
        {t("live.live")}
        {/* Its room kept for members, so nothing moves when it comes. */}
        {member && (
          <span className={`inline-flex size-8 ${by ? "" : "invisible"}`}>
            {by && (
              <NameAvatar
                name={by.name}
                avatar={by.avatar}
                label={t("live.controlledBy", { name: by.name })}
              />
            )}
          </span>
        )}
      </span>
    </span>
  );
}
