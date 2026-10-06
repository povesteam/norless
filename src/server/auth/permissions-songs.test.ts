import { type Music, musicOfTexts } from "../../shared/music/chord-track.js";
import { describe, expect, test } from "vitest";
import { call, people, type Person, row } from "./test-helpers.js";

describe("read songs and playlists, search", () => {
  test.each(people)("%s", async (person) => {
    for (const path of ["", "/search?q=vers", "/songs/song", "/tags"])
      expect((await call(person, "GET", path)).statusCode).toBe(200);
  });
  test.todo("playlists, export, project locally, see what's live");
});
describe("copy a playlist's YouTube chapters", () => {
  const members: Person[] = ["member", "team", "editor", "owner"];
  const playlist = async () =>
    (await call("owner", "POST", "/playlists", { title: "Duminică" })).json<{
      id: string;
    }>().id;
  describe("its last service's entries", () =>
    row(members, async (as) =>
      call(as, "GET", `/playlists/${await playlist()}/chapters`),
    ));
  describe("its stream on the community's channel", () =>
    row(members, async (as) =>
      call(as, "GET", `/playlists/${await playlist()}/stream`),
    ));
});
describe("create, rename and delete playlists, change their entries", () => {
  const team: Person[] = ["team", "owner"];
  /** A playlist with one divider, made by the owner for each attempt. */
  const playlist = async () => {
    const { id } = (
      await call("owner", "POST", "/playlists", { title: "Duminică" })
    ).json<{ id: string }>();
    const entry = (
      await call("owner", "POST", `/playlists/${id}/entries`, {
        kind: "divider",
        text: "Predica",
      })
    ).json<{ id: string }>().id;
    return { id, entry };
  };
  test.each(people)("read: %s", async (person) => {
    const { id } = await playlist();
    expect((await call(person, "GET", "/playlists")).statusCode).toBe(200);
    expect((await call(person, "GET", `/playlists/${id}`)).statusCode).toBe(
      200,
    );
  });
  describe("create", () =>
    row(team, (as) => call(as, "POST", "/playlists", { title: "Nou" })));
  describe("rename", () =>
    row(team, async (as) => {
      const { id } = await playlist();
      return call(as, "PATCH", `/playlists/${id}`, { title: "Seara" });
    }));
  describe("archive or restore", () =>
    row(team, async (as) => {
      const { id } = await playlist();
      return call(as, "PUT", `/playlists/${id}/archived`, { archived: true });
    }));
  describe("add an entry", () =>
    row(team, async (as) => {
      const { id } = await playlist();
      return call(as, "POST", `/playlists/${id}/entries`, {
        kind: "song",
        songId: "song",
      });
    }));
  describe("change an entry", () =>
    row(team, async (as) => {
      const { id, entry } = await playlist();
      return call(as, "PATCH", `/playlists/${id}/entries/${entry}`, {
        plannedMinutes: 45,
      });
    }));
  describe("move an entry", () =>
    row(team, async (as) => {
      const { id, entry } = await playlist();
      return call(as, "POST", `/playlists/${id}/entries/${entry}/move`, {
        after: null,
      });
    }));
  describe("remove an entry", () =>
    row(team, async (as) => {
      const { id, entry } = await playlist();
      return call(as, "DELETE", `/playlists/${id}/entries/${entry}`);
    }));
  describe("undo removing an entry", () =>
    row(team, async (as) => {
      const { id, entry } = await playlist();
      await call("owner", "DELETE", `/playlists/${id}/entries/${entry}`);
      return call(as, "POST", `/playlists/${id}/entries/${entry}/restore`);
    }));
});

describe("create, edit and delete songs", () => {
  const editors: Person[] = ["editor", "owner"];
  const version = { language: "ro", title: "Cântare", text: "1:\nVers" };
  describe("create", () =>
    row(editors, (as) => call(as, "POST", "/songs", { versions: [version] })));
  describe("edit", () =>
    row(editors, async (as) => {
      // Based on the current text, so it never conflicts.
      const { versions } = (await call("owner", "GET", "/songs/song")).json<{
        versions: { text: string }[];
      }>();
      return call(as, "PUT", "/songs/song", {
        versions: [{ ...version, baseText: versions[0]?.text }],
      });
    }));
  describe("edit a section", () =>
    row(editors, async (as) => {
      const { versions } = (await call("owner", "GET", "/songs/song")).json<{
        versions: { text: string }[];
      }>();
      return call(as, "PUT", "/songs/song/versions/ro/sections/0", {
        baseText: versions[0]?.text,
        text: "1:\nVers",
      });
    }));
  describe("delete", () =>
    row(editors, async (as) => {
      const { id } = (
        await call("owner", "POST", "/songs", { versions: [version] })
      ).json<{ id: string }>();
      return call(as, "DELETE", `/songs/${id}`);
    }));
});

describe("edit chords, bar lines, `!` notes and tempo of songs", () => {
  const musicians: Person[] = ["team", "editor", "owner"];
  describe("chords and notes", () =>
    row(musicians, async (as) => {
      const { music } = (await call("owner", "GET", "/songs/song")).json<{
        music: Music;
      }>();
      const chords = musicOfTexts(["1:\n.G\n Cântați"]);
      return call(as, "PUT", "/songs/song/music", {
        base: music,
        music:
          JSON.stringify(music) === JSON.stringify(chords) ? music : chords,
      });
    }));
  describe("tempo", () =>
    row(musicians, (as) => call(as, "PUT", "/songs/song/tempo", { bpm: 72 })));
});

describe("change a song's key permanently, moving its chords", () =>
  row(["team", "editor", "owner"], (as) =>
    call("owner", "GET", "/songs/song").then((song) => {
      const { music } = song.json<{ music: Music }>();
      return call(as, "PUT", "/songs/song/key", {
        keySignature: "D",
        base: music,
        music,
      });
    }),
  ));

describe("set a song's key for one service, on its playlist entry", () =>
  row(["team", "owner"], async (as) => {
    const { id } = (
      await call("owner", "POST", "/playlists", { title: "Duminică" })
    ).json<{ id: string }>();
    const entry = (
      await call("owner", "POST", `/playlists/${id}/entries`, {
        kind: "song",
        songId: "song",
      })
    ).json<{ id: string }>().id;
    return call(as, "PATCH", `/playlists/${id}/entries/${entry}`, {
      keySignature: "E",
    });
  }));

describe("see a song's history", () =>
  row(["member", "team", "editor", "owner"], (as) =>
    call(as, "GET", "/songs/song/revisions"),
  ));

describe("restore a song as it was before a save", () =>
  row(["editor", "owner"], async (as) => {
    await call("owner", "PUT", "/songs/song/tempo", { bpm: 80 });
    const [last] = (await call("owner", "GET", "/songs/song/revisions")).json<
      { id: string }[]
    >();
    return call(as, "POST", `/songs/song/revisions/${last?.id}/restore`);
  }));
