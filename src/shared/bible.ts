import { bibleBooks } from "./bible-books.js";

export type BibleReference = {
  book: number;
  chapter: number;
  from: number;
  to: number;
};

/** Lowercase letters and digits only, without diacritics, so "1 Împărați" becomes "1imparati". */
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");

// Book (an optional digit, then a name), chapter, optional first and last verse,
// with any separators, as in the old app. Trailing separators are allowed while typing.
const REFERENCE =
  /^\s*(\d?\D*?\p{L}\D*?)[^\p{L}\d]*(\d+)(?:\D+?(\d+)(?:\D+?(\d+))?)?[^\p{L}\d]*$/u;

/**
 * Reads a query like "ioan 3:16-18" as references to every book whose name, in one of
 * the languages, contains the typed book name, and that has the chapter. Verses are
 * limited to the chapter, a reversed range is swapped, and no verses means the whole
 * chapter. Returns [] when the query isn't shaped as a reference.
 */
export function parseReference(
  query: string,
  languages: string[],
): BibleReference[] {
  const m = REFERENCE.exec(query);
  if (!m) return [];
  const [, bookQuery = "", chapterText = "", fromText, toText] = m;
  const needle = fold(bookQuery);
  const chapter = Number(chapterText);

  return bibleBooks.flatMap((book, i) => {
    const last = book.verses[chapter - 1];
    const matches = languages.some((lang) => {
      const name = book.names[lang];
      return name !== undefined && fold(name).includes(needle);
    });
    if (!matches || last === undefined) return [];
    const clamp = (verse: number) => Math.min(Math.max(verse, 1), last);
    const from = fromText ? clamp(Number(fromText)) : 1;
    const to = toText ? clamp(Number(toText)) : fromText ? from : last;
    return [
      {
        book: i + 1,
        chapter,
        from: Math.min(from, to),
        to: Math.max(from, to),
      },
    ];
  });
}

/** "Ioan 3:16-18", or "Ioan 3:16" for one verse, in the given language (English if it has no name). */
export function formatReference(
  { book, chapter, from, to }: BibleReference,
  language: string,
): string {
  const names = bibleBooks[book - 1]?.names;
  const name = names?.[language] ?? names?.en ?? "";
  return `${name} ${chapter}:${from}${to === from ? "" : `-${to}`}`;
}

/** A version on bible.com: its id in the site's links, abbreviation and name. */
export type BibleVersion = { id: number; abbreviation: string; name: string };

/**
 * The bible.com versions an owner picks from per language (ids checked on bible.com),
 * the default first: Cornilescu for Romanian, Ogienko for Ukrainian, King
 * James for English. Any other version is chosen by its id.
 */
export const bibleVersions: Record<string, BibleVersion[]> = {
  ro: [
    { id: 191, abbreviation: "VDC", name: "Cornilescu 1924" },
    { id: 2311, abbreviation: "EDCR", name: "Cornilescu revizuită 2024" },
    { id: 3914, abbreviation: "EDC100", name: "Cornilescu 2024" },
    { id: 126, abbreviation: "NTR", name: "Noua Traducere Românească" },
    { id: 903, abbreviation: "BTF2015", name: "Traducerea Fidelă 2015" },
    { id: 1454, abbreviation: "BVA", name: "Versiune Actualizată 2018" },
  ],
  uk: [
    { id: 186, abbreviation: "UBIO", name: "Огієнко 1962" },
    { id: 3269, abbreviation: "НПУ", name: "Новий переклад українською" },
    { id: 204, abbreviation: "UMT", name: "Сучасною мовою" },
    { id: 1755, abbreviation: "УТТ", name: "Турконяк" },
    { id: 188, abbreviation: "UKRK", name: "Куліш і Пулюй 1905" },
  ],
  en: [
    { id: 1, abbreviation: "KJV", name: "King James Version" },
    { id: 114, abbreviation: "NKJV", name: "New King James Version" },
    { id: 111, abbreviation: "NIV", name: "New International Version" },
    { id: 59, abbreviation: "ESV", name: "English Standard Version" },
  ],
};

/**
 * The passage on bible.com, e.g. John 3:16-18 in Cornilescu: in the version the
 * community chose for the language (`chosen`, an id), else the language's default.
 */
export function bibleLink(
  { book, chapter, from, to }: BibleReference,
  language: string,
  chosen?: number,
): string | null {
  const usfm = bibleBooks[book - 1]?.usfm;
  const known = bibleVersions[language] ?? [];
  const id = chosen ?? known[0]?.id;
  if (!usfm || !id) return null;
  const verses = to === from ? `${from}` : `${from}-${to}`;
  // bible.com opens a link without the abbreviation too, for a version not listed.
  const abbreviation = known.find((v) => v.id === id)?.abbreviation;
  return `https://www.bible.com/bible/${id}/${usfm}.${chapter}.${verses}${abbreviation ? `.${abbreviation}` : ""}`;
}

/** Whether the reference names a real book, chapter and verses, in order. */
export function isValidReference({
  book,
  chapter,
  from,
  to,
}: BibleReference): boolean {
  const last = bibleBooks[book - 1]?.verses[chapter - 1];
  return last !== undefined && from >= 1 && from <= to && to <= last;
}
