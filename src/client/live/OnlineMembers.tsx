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

/** On a phone's menu: who else is online, each with their devices and stage views. */
export function OnlineList({ others }: { others: OnlineMember[] }) {
  const { t } = useTranslation();
  if (!others.length) return null;
  return (
    <section
      aria-label={t("presence.online")}
      className="flex flex-col gap-2 border-b border-separator pb-3"
    >
      <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
        {t("presence.online")}
      </h2>
      {others.map((person) => (
        <p key={person.userId} className="flex items-center gap-2">
          <PersonAvatar name={person.name} avatar={person.avatar} />
          <span className="min-w-0 flex-1 truncate">{person.name}</span>
          <span className="text-sm text-muted">
            {[
              ...person.devices.map((d) => t(`presence.${d}`)),
              ...person.views.map((v) => t(`${v.view}.title`)),
            ].join(", ")}
          </span>
        </p>
      ))}
    </section>
  );
}
