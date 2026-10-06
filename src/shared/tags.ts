/**
 * Tag as stored: lowercase, other characters collapsed into single spaces, and
 * diacritics removed from Latin letters only (ș → s), so Cyrillic й and ї stay intact.
 */
export function normalizeTag(tag: string): string {
  return tag
    .normalize("NFD")
    .replace(/(\p{Script=Latin})\p{Diacritic}+/gu, "$1")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}
