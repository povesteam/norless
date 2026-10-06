import { Check, Laptop, X } from "lucide-react";
import { Button } from "@heroui/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import type { NearbyLogin } from "../../server/auth/device-login";
import { useShows } from "../data/community";
import { live } from "../data/connection";
import { useJson } from "../data/fetch";
import { hasRole, useMe } from "../data/me";

/**
 * For the team, on every page: a laptop on the same internet connection (the church
 * wifi) waiting on its login page, to review without scanning.
 */
export function NearbyLogins() {
  const { t } = useTranslation();
  const { me } = useMe();
  const [location, navigate] = useLocation();
  const [offers, setOffers] = useState<
    Record<string, (NearbyLogin & { community: string })[]>
  >({});
  const [dismissed, setDismissed] = useState<string[]>([]);
  // Always on, in Classic's set: operators log in this way from the first Sunday.
  const visible = useShows()("deviceLogin");
  const teams =
    me?.user && !me.user.device
      ? me.memberships
          .filter((m) => hasRole(m.roles, "team"))
          .map((m) => m.community)
      : [];
  const key = teams.join();
  useEffect(() => {
    if (!key) return;
    const offs = key.split(",").map((community) =>
      live.subscribe(`device-logins:${community}`, (data) =>
        setOffers((all) => ({
          ...all,
          [community]: (data as NearbyLogin[]).map((o) => ({
            ...o,
            community,
          })),
        })),
      ),
    );
    return () => {
      for (const off of offs) off();
    };
  }, [key]);
  const offer = Object.values(offers)
    .flat()
    .find((o) => !dismissed.includes(o.code));
  const names = useJson<{ slug: string; name: string }[]>(
    offer ? "/api/communities" : null,
  ).data;
  // Not over the approve screen it leads to.
  if (!offer || !visible || location.startsWith("/login/device")) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md flex-wrap items-center gap-2 rounded-2xl border border-separator bg-overlay p-3 shadow-lg"
    >
      <Laptop className="shrink-0" />
      <p className="min-w-0 flex-1">
        {t("deviceLogin.nearby", {
          community:
            names?.find((c) => c.slug === offer.community)?.name ??
            offer.community,
        })}
      </p>
      <Button
        size="sm"
        onPress={() => {
          setDismissed((d) => [...d, offer.code]);
          navigate(`~/login/device/${offer.code}`);
        }}
      >
        <Check />
        {t("deviceLogin.review")}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onPress={() => setDismissed((d) => [...d, offer.code])}
      >
        <X />
        {t("deviceLogin.notNow")}
      </Button>
    </div>
  );
}
