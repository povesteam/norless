import type { FastifyInstance } from "fastify";
import { noMusic } from "../../shared/music/chord-track.js";
import type { Db } from "../db/db.js";
import { isMember } from "../auth/members.js";
import { getPlaylist, type Playlist } from "../playlists/playlists.js";
import { type Song, textOf } from "../songs/songs.js";

/**
 * What a device keeps for projecting without internet: the
 * community's name and languages, every song as projectors read it, and the newest
 * playlists. Songs and playlists only: no names, no emails.
 */
export type Kept = {
  community: { name: string; languages: string[] };
  songs: Song[];
  playlists: Playlist[];
  keptAt: string;
};

/** How many of the newest playlists a device keeps. */
const PLAYLISTS = 5;

export function keptOf(db: Db, communityId: string, now = new Date()): Kept {
  const community = db
    .prepare("SELECT name, languages FROM communities WHERE id = ?")
    .get(communityId) as { name: string; languages: string };
  const songs = db
    .prepare(
      `SELECT id, key_signature AS keySignature, time_signature AS timeSignature,
         updated_at AS updatedAt
       FROM songs WHERE community_id = ? AND deleted_at IS NULL AND excluded_at IS NULL`,
    )
    .all(communityId) as Pick<
    Song,
    "id" | "keySignature" | "timeSignature" | "updatedAt"
  >[];
  const versions = new Map<
    string,
    { language: string; title: string; text: string; updatedAt: string }[]
  >();
  for (const v of db
    .prepare(
      `SELECT v.song_id AS songId, v.language, v.title, v.lyrics, s.music,
         v.updated_at AS updatedAt
       FROM song_versions v JOIN songs s ON s.id = v.song_id
       WHERE v.community_id = ? AND v.deleted_at IS NULL
       ORDER BY v.created_at`,
    )
    .all(communityId) as {
    songId: string;
    language: string;
    title: string;
    lyrics: string;
    music: string | null;
    updatedAt: string;
  }[])
    versions.set(v.songId, [
      ...(versions.get(v.songId) ?? []),
      { ...v, text: textOf(v.lyrics, v.music) },
    ]);
  // What projectors read of a song; the rest as an empty song has it.
  const kept = songs.map((s): Song => ({
    ...s,
    tags: [],
    bpm: null,
    referenceLinks: [],
    authors: "",
    copyright: "",
    sourceUrl: null,
    suggestedBpm: null,
    deletedAt: null,
    excluded: null,
    music: noMusic(),
    versions: (versions.get(s.id) ?? []).map(
      ({ language, title, text, updatedAt }) => ({
        language,
        title,
        text,
        lyrics: "",
        updatedAt,
      }),
    ),
  }));
  const ids = db
    .prepare(
      `SELECT id FROM playlists WHERE community_id = ? AND deleted_at IS NULL AND archived_at IS NULL
       ORDER BY created_at DESC LIMIT ?`,
    )
    .pluck()
    .all(communityId, PLAYLISTS) as string[];
  return {
    community: {
      name: community.name,
      languages: JSON.parse(community.languages) as string[],
    },
    songs: kept,
    playlists: ids.flatMap((id) => getPlaylist(db, communityId, id) ?? []),
    keptAt: now.toISOString(),
  };
}

/** GET /api/communities/:slug/offline, for members: what a device keeps. */
export function attachOffline(
  app: FastifyInstance,
  {
    db,
    findCommunity,
  }: { db: Db; findCommunity: (slug: string) => { id: string } | undefined },
) {
  app.get<{ Params: { slug: string } }>(
    "/api/communities/:slug/offline",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      if (!request.user || !isMember(db, community.id, request.user.id))
        return reply
          .code(request.user ? 403 : 401)
          .send({ error: "Members only" });
      return keptOf(db, community.id);
    },
  );
}
