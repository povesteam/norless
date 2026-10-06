import type { Document } from "bson";
import { idFrom } from "../ids.js";
import type { OplogTimes } from "./oplog.js";

export type Row = Record<string, string | number | null>;

/** Rows per table, in insertion order (foreign keys point backwards). */
export type Rows = {
  users: Row[];
  communities: Row[];
  members: Row[];
  rooms: Row[];
  pages: Row[];
  schedule_events: Row[];
  songs: Row[];
  song_versions: Row[];
  playlists: Row[];
  entries: Row[];
  plays: Row[];
  song_revisions: Row[];
  slide_log: Row[];
};

/** Counts and anomalies. Samples hold old ids only, never names, emails or lyrics. */
export type Report = {
  counts: Record<string, number>;
  notes: Record<string, number>;
  samples: Record<string, string[]>;
};

/** What the mapping steps share. */
export type Mapping = {
  get: (db: string, collection: string) => Document[];
  note: (key: string, sample?: string) => void;
  rows: Rows;
  at: string;
  times: OplogTimes | undefined;
  imported: { imported_at: string; updated_at: string };
  /** The fields every community-owned row starts with. */
  community: {
    community_id: string;
    created_at: string;
    deleted_at: null;
    created_by: null;
    updated_by: null;
  };
};

export const RO = "norless";
export const UA = "norless-ua";

/** A stable id for an imported record, so every re-run targets the same rows. */
export const legacyId = (...parts: string[]) =>
  idFrom("norless-import", ...parts);

export const iso = (value: unknown): string | null => {
  const date =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value)
        : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
};

export const str = (value: unknown) => (typeof value === "string" ? value : "");
