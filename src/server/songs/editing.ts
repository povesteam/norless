import {
  EDIT_LOCK_MS,
  type EditingMessage,
  type SectionEdit,
} from "../../shared/live.js";
import type { Db } from "../db/db.js";
import type { Client, Live } from "../live/live.js";
import { allows, isMember, memberRoles } from "../auth/members.js";

/**
 * Who edits a song, and which section with their draft, on `editing:<song id>` for
 * members. One person per song: their other devices too, nobody else
 * until they're done or 5 minutes without typing. Kept in memory, so a restart frees it.
 */
export function attachEditing(live: Live, db: Db, now = () => Date.now()) {
  const edits = new Map<string, Map<Client, SectionEdit>>();
  const communityOf = (songId: string) =>
    db
      .prepare(
        "SELECT community_id FROM songs WHERE id = ? AND deleted_at IS NULL",
      )
      .pluck()
      .get(songId) as string | undefined;
  const rolesFor = (client: Client, songId: string) => {
    const communityId = communityOf(songId);
    return client.user && communityId
      ? memberRoles(db, communityId, client.user.id)
      : [];
  };
  const list = (songId: string) => [...(edits.get(songId)?.values() ?? [])];
  const publish = (songId: string) =>
    live.publish(`editing:${songId}`, list(songId));

  live.onSubscribe("editing:", (topic, client) => {
    const songId = topic.slice("editing:".length);
    const communityId = communityOf(songId);
    if (
      !client.user ||
      !communityId ||
      !isMember(db, communityId, client.user.id)
    )
      return false;
    client.send({ type: "event", topic, data: list(songId) });
    return true;
  });

  live.onMessage("editing", (client, message) => {
    const { song, language, section, draft } = message as EditingMessage;
    if (
      typeof song !== "string" ||
      typeof language !== "string" ||
      !Number.isInteger(section) ||
      (draft !== null && typeof draft !== "string") ||
      !client.user ||
      // Editors edit songs; the team edits their chords.
      !["editor", "team"].some((role) =>
        allows(rolesFor(client, song), role as "editor" | "team"),
      )
    )
      return;
    const songEdits = edits.get(song) ?? new Map<Client, SectionEdit>();
    if (draft === null) {
      songEdits.delete(client);
    } else {
      const holder = [...songEdits].find(
        ([other, e]) => other !== client && e.userId !== client.user?.id,
      );
      if (holder && now() - Date.parse(holder[1].typedAt) < EDIT_LOCK_MS) {
        // Taken: tell this client who has it.
        client.send({
          type: "event",
          topic: `editing:${song}`,
          data: list(song),
        });
        return;
      }
      if (holder) songEdits.delete(holder[0]);
      songEdits.set(client, {
        userId: client.user.id,
        name: client.user.displayName,
        language,
        section,
        draft,
        typedAt: new Date(now()).toISOString(),
      });
    }
    if (songEdits.size > 0) edits.set(song, songEdits);
    else edits.delete(song);
    publish(song);
  });

  live.onClose((client) => {
    for (const [song, songEdits] of edits) {
      if (!songEdits.delete(client)) continue;
      if (songEdits.size === 0) edits.delete(song);
      publish(song);
    }
  });
}
