import { Tooltip } from "@heroui/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { OnlineMember } from "../../shared/live";
import { useCommunity, useShows } from "../data/community";
import { live } from "../data/connection";
import { useIsMember, useMe } from "../data/me";
import { PersonAvatar } from "../ui/NameAvatar";
import { Tip } from "../ui/tip";
import { useLiveView } from "../data/room";

/** The other members online in this community, for members; never oneself. */
export function useOthersOnline() {
  const { slug } = useCommunity();
  const isMember = useIsMember(slug);
  const self = useMe().me?.user?.id;
  const [online, setOnline] = useState<OnlineMember[]>([]);
  useEffect(
    () =>
      isMember
        ? live.subscribe(`presence:${slug}`, (data) =>
            setOnline(data as OnlineMember[]),
          )
        : undefined,
    [slug, isMember],
  );
  return isMember ? online.filter((person) => person.userId !== self) : [];
}

/**
 * Members online right now, each as their photo or initials, with their devices in a
 * tooltip; the one who made the last live change has a ring. Following it makes you
 * online too.
 */
export function OnlineMembers() {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const isMember = useIsMember(slug);
  const lastChange = useLiveView(isMember ? slug : null)?.changedBy?.userId;
  const shows = useShows();
  const online = useOthersOnline();

  if (!isMember) return null;
  return (
    <div
      role="group"
      aria-label={t("presence.online")}
      // An avatar's height while the list arrives, so the page below doesn't move.
      className="flex min-h-8 flex-wrap items-center gap-1.5"
    >
      {online.map((person) => {
        const last = person.userId === lastChange && shows("presence");
        // Avatars only; devices and the last change in the tooltip.
        const label = [
          person.name,
          person.devices.map((d) => t(`presence.${d}`)).join(", "),
          last && t("presence.lastChange"),
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <Tip key={person.userId} label={label}>
            <Tooltip.Trigger
              aria-label={label}
              className={`rounded-full ring-2 ${last ? "ring-accent" : "ring-transparent"}`}
            >
              <PersonAvatar name={person.name} avatar={person.avatar} />
            </Tooltip.Trigger>
          </Tip>
        );
      })}
    </div>
  );
}
