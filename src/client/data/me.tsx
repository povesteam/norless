import { createContext, use, useCallback, useEffect, useState } from "react";
import type { Preferences } from "../../shared/preferences";
import { send } from "./fetch";

export type Me = {
  user: {
    id: string;
    displayName: string;
    email: string | null;
    /** Their photo, an image id. */
    avatar: string | null;
    /** Where it came from; null before any (Google's photo comes at its next login). */
    avatarSource: "google" | "own" | "initials" | null;
    /** A laptop or a guest's phone logged in from a member's phone. */
    device: "laptop" | "guest" | null;
  } | null;
  memberships: { community: string; roles: string[] }[];
  /** For the logged-in person; visitors keep theirs on the device. */
  preferences: Preferences;
  /** On the Norless app team, who read the ideas sent to it. */
  appTeam?: boolean;
};

const MeContext = createContext<{
  me: Me | undefined;
  refresh: () => void;
  savePreferences: (preferences: Preferences) => void;
}>({ me: undefined, refresh: () => {}, savePreferences: () => {} });

/** Who is logged in (undefined while loading), and a way to reload it after a login or logout. */
export const useMe = () => use(MeContext);

export function MeProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me>();
  const refresh = useCallback(() => {
    fetch("/api/me")
      .then(async (response) => setMe((await response.json()) as Me))
      .catch(() => {});
  }, []);
  useEffect(refresh, [refresh]);
  // Shown at once, then saved with the account.
  // ponytail: a failed save shows only after the next reload.
  const savePreferences = useCallback((preferences: Preferences) => {
    setMe((current) => current && { ...current, preferences });
    void send("PUT", "/api/me/preferences", preferences);
  }, []);

  return (
    <MeContext value={{ me, refresh, savePreferences }}>{children}</MeContext>
  );
}

/** The logged-in person's roles in a community; none for visitors. */
export const useRoles = (slug: string) =>
  useMe().me?.memberships.find((m) => m.community === slug)?.roles ?? [];

/** Whether the logged-in person is a member of the community, with or without roles. */
export const useIsMember = (slug: string) =>
  useMe().me?.memberships.some((m) => m.community === slug) ?? false;

/** Whether the roles allow an action; owners may do everything. */
export const hasRole = (roles: string[], role: string) =>
  roles.includes(role) || roles.includes("owner");
