import { useEffect, useState } from "react";
import type { PlaylistActivity } from "../../shared/live";
import { useCommunity, useShows } from "../data/community";
import { live } from "../data/connection";
import { useIsMember, useMe } from "../data/me";

/** Members see who else has it open, and others' drags as they happen. */
export function usePlaylistActivity(id: string) {
  const community = useCommunity();
  const shows = useShows();
  const isMember = useIsMember(community.slug);
  const me = useMe().me?.user?.id;
  const [activity, setActivity] = useState<PlaylistActivity>();
  const presence = isMember && shows("presence");
  useEffect(
    () =>
      presence
        ? live.subscribe(`activity:${id}`, (data) =>
            setActivity(data as PlaylistActivity),
          )
        : undefined,
    [id, presence],
  );
  return {
    viewers: activity?.viewers.filter((v) => v.userId !== me),
    drags: activity?.drags.filter((d) => d.userId !== me) ?? [],
  };
}
