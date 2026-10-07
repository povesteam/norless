import { Checkbox, Chip } from "@heroui/react";
import { NameAvatar } from "../ui/NameAvatar";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import type { PlaylistSummary } from "../../server/playlists/playlists";
import { useCommunity } from "../data/community";
import { live } from "../data/connection";
import { useJson } from "../data/fetch";
import { hasRole, useRoles } from "../data/me";
import { ActionButton, ErrorNotice, Placeholder } from "../ui/states";
import { NoPlaylists, NewPlaylistButton } from "./NewPlaylist";
import { PlaylistName } from "./PlaylistName";

const PAGE = 50;

/** /playlists: every playlist, newest first, 50 more at a time; or the archived ones. */
export function PlaylistsPage() {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const canChange = hasRole(useRoles(slug), "team");
  const [archived, setArchived] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold">{t("playlists.title")}</h2>
        <span className="flex-1" />
        <ShowArchived isSelected={archived} onChange={setArchived} />
        {canChange && <NewPlaylistButton />}
      </div>
      <PlaylistList archived={archived} />
    </div>
  );
}

/** The switch between the playlists and the archived ones. */
export function ShowArchived({
  isSelected,
  onChange,
}: {
  isSelected: boolean;
  onChange: (selected: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Checkbox isSelected={isSelected} onChange={onChange}>
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        {t("playlists.showArchived")}
      </Checkbox.Content>
    </Checkbox>
  );
}

/**
 * The playlists, newest first, `pageSize` more at a time, each with its date, or with
 * `creators` who created it (names only reach members); `current` is marked. With
 * `query`, those whose title has it; with `archived`, the archived ones.
 */
export function PlaylistList({
  current,
  creators = false,
  pageSize = PAGE,
  query = "",
  archived = false,
}: {
  current?: string;
  creators?: boolean;
  pageSize?: number;
  query?: string;
  archived?: boolean;
}) {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const [pages, setPages] = useState(1);
  const [version, setVersion] = useState(0);
  useEffect(
    () => live.subscribe(`playlists:${slug}`, () => setVersion((n) => n + 1)),
    [slug],
  );
  const { data, failed, retry } = useJson<{
    playlists: PlaylistSummary[];
    more: boolean;
    next: string | null;
  }>(
    `/api/communities/${slug}/playlists?limit=${pages * pageSize}&q=${encodeURIComponent(query.trim())}${archived ? "&archived=true" : ""}`,
    version,
  );

  if (data === undefined)
    return failed ? (
      <ErrorNotice message={t("states.loadFailed")} onRetry={retry} />
    ) : (
      <Placeholder lines={10} />
    );
  if (data === null) return null;
  if (data.playlists.length === 0)
    return archived ? (
      <p className="text-sm text-muted">{t("playlists.noArchived")}</p>
    ) : query.trim() ? (
      <p className="text-sm text-muted">{t("playlists.noMatch")}</p>
    ) : (
      <NoPlaylists />
    );
  // The playlist of the service under way or next.
  const { next } = data;

  return (
    <>
      <ul className="divide-y divide-separator">
        {data.playlists.map((playlist) => (
          <li key={playlist.id}>
            {/* The whole row opens it, not only the title. */}
            <Link
              href={`/playlists/${playlist.id}`}
              className="-mx-2 flex items-baseline justify-between gap-4 rounded-lg px-2 py-2 outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
              aria-current={playlist.id === current ? "page" : undefined}
            >
              <span
                className={`link flex min-w-0 items-baseline gap-2 ${playlist.id === current ? "font-semibold" : ""}`}
              >
                <PlaylistName playlist={playlist} />
              </span>
              {/* Each date says what it is. */}
              <span className="flex shrink-0 items-baseline gap-3 text-sm text-muted">
                {playlist.id === next && (
                  <Chip size="sm" color="accent" variant="soft">
                    {t("playlists.nextService")}
                  </Chip>
                )}
                {!creators && playlist.songs !== undefined && (
                  <span>{t("playlists.songs", { count: playlist.songs })}</span>
                )}
                {/* Who made it, by name in the menu's list, else as their photo; its
                    date is in its name. */}
                {creators
                  ? playlist.createdBy && <span>{playlist.createdBy}</span>
                  : playlist.createdBy && (
                      <span className="self-center">
                        <NameAvatar
                          name={playlist.createdBy}
                          avatar={playlist.createdByAvatar}
                          label={t("playlists.createdBy", {
                            name: playlist.createdBy,
                          })}
                        />
                      </span>
                    )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {data.more && (
        <ActionButton
          variant="secondary"
          className="self-center"
          onPress={() => setPages((n) => n + 1)}
        >
          <ChevronDown />
          {t("playlists.more")}
        </ActionButton>
      )}
    </>
  );
}
