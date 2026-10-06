/**
 * The 66 books of the Protestant canon, numbered 1–66 in this order, with their names,
 * USFM codes (for bible.com links) and the number of verses in each chapter.
 * Verse counts follow the Cornilescu versification, the same as the King James Version.
 */
export type BibleBook = {
  usfm: string;
  names: Record<string, string>;
  verses: number[];
};

export const bibleBooks: BibleBook[] = [
  {
    usfm: "GEN",
    names: { ro: "Geneza", uk: "Буття", en: "Genesis" },
    verses: [
      31, 25, 24, 26, 32, 22, 24, 22, 29, 32, 32, 20, 18, 24, 21, 16, 27, 33,
      38, 18, 34, 24, 20, 67, 34, 35, 46, 22, 35, 43, 55, 32, 20, 31, 29, 43,
      36, 30, 23, 23, 57, 38, 34, 34, 28, 34, 31, 22, 33, 26,
    ],
  },
  {
    usfm: "EXO",
    names: { ro: "Exodul", uk: "Вихід", en: "Exodus" },
    verses: [
      22, 25, 22, 31, 23, 30, 25, 32, 35, 29, 10, 51, 22, 31, 27, 36, 16, 27,
      25, 26, 36, 31, 33, 18, 40, 37, 21, 43, 46, 38, 18, 35, 23, 35, 35, 38,
      29, 31, 43, 38,
    ],
  },
  {
    usfm: "LEV",
    names: { ro: "Levitic", uk: "Левит", en: "Leviticus" },
    verses: [
      17, 16, 17, 35, 19, 30, 38, 36, 24, 20, 47, 8, 59, 57, 33, 34, 16, 30, 37,
      27, 24, 33, 44, 23, 55, 46, 34,
    ],
  },
  {
    usfm: "NUM",
    names: { ro: "Numeri", uk: "Числа", en: "Numbers" },
    verses: [
      54, 34, 51, 49, 31, 27, 89, 26, 23, 36, 35, 16, 33, 45, 41, 50, 13, 32,
      22, 29, 35, 41, 30, 25, 18, 65, 23, 31, 40, 16, 54, 42, 56, 29, 34, 13,
    ],
  },
  {
    usfm: "DEU",
    names: { ro: "Deuteronom", uk: "Повторення Закону", en: "Deuteronomy" },
    verses: [
      46, 37, 29, 49, 33, 25, 26, 20, 29, 22, 32, 32, 18, 29, 23, 22, 20, 22,
      21, 20, 23, 30, 25, 22, 19, 19, 26, 68, 29, 20, 30, 52, 29, 12,
    ],
  },
  {
    usfm: "JOS",
    names: { ro: "Iosua", uk: "Ісус Навин", en: "Joshua" },
    verses: [
      18, 24, 17, 24, 15, 27, 26, 35, 27, 43, 23, 24, 33, 15, 63, 10, 18, 28,
      51, 9, 45, 34, 16, 33,
    ],
  },
  {
    usfm: "JDG",
    names: { ro: "Judecători", uk: "Суддів", en: "Judges" },
    verses: [
      36, 23, 31, 24, 31, 40, 25, 35, 57, 18, 40, 15, 25, 20, 20, 31, 13, 31,
      30, 48, 25,
    ],
  },
  {
    usfm: "RUT",
    names: { ro: "Rut", uk: "Рут", en: "Ruth" },
    verses: [22, 23, 18, 22],
  },
  {
    usfm: "1SA",
    names: { ro: "1 Samuel", uk: "1 Самуїлова", en: "1 Samuel" },
    verses: [
      28, 36, 21, 22, 12, 21, 17, 22, 27, 27, 15, 25, 23, 52, 35, 23, 58, 30,
      24, 42, 15, 23, 29, 22, 44, 25, 12, 25, 11, 31, 13,
    ],
  },
  {
    usfm: "2SA",
    names: { ro: "2 Samuel", uk: "2 Самуїлова", en: "2 Samuel" },
    verses: [
      27, 32, 39, 12, 25, 23, 29, 18, 13, 19, 27, 31, 39, 33, 37, 23, 29, 33,
      43, 26, 22, 51, 39, 25,
    ],
  },
  {
    usfm: "1KI",
    names: { ro: "1 Împărați", uk: "1 Царів", en: "1 Kings" },
    verses: [
      53, 46, 28, 34, 18, 38, 51, 66, 28, 29, 43, 33, 34, 31, 34, 34, 24, 46,
      21, 43, 29, 53,
    ],
  },
  {
    usfm: "2KI",
    names: { ro: "2 Împărați", uk: "2 Царів", en: "2 Kings" },
    verses: [
      18, 25, 27, 44, 27, 33, 20, 29, 37, 36, 21, 21, 25, 29, 38, 20, 41, 37,
      37, 21, 26, 20, 37, 20, 30,
    ],
  },
  {
    usfm: "1CH",
    names: { ro: "1 Cronici", uk: "1 Хронік", en: "1 Chronicles" },
    verses: [
      54, 55, 24, 43, 26, 81, 40, 40, 44, 14, 47, 40, 14, 17, 29, 43, 27, 17,
      19, 8, 30, 19, 32, 31, 31, 32, 34, 21, 30,
    ],
  },
  {
    usfm: "2CH",
    names: { ro: "2 Cronici", uk: "2 Хронік", en: "2 Chronicles" },
    verses: [
      17, 18, 17, 22, 14, 42, 22, 18, 31, 19, 23, 16, 22, 15, 19, 14, 19, 34,
      11, 37, 20, 12, 21, 27, 28, 23, 9, 27, 36, 27, 21, 33, 25, 33, 27, 23,
    ],
  },
  {
    usfm: "EZR",
    names: { ro: "Ezra", uk: "Ездра", en: "Ezra" },
    verses: [11, 70, 13, 24, 17, 22, 28, 36, 15, 44],
  },
  {
    usfm: "NEH",
    names: { ro: "Neemia", uk: "Неемія", en: "Nehemiah" },
    verses: [11, 20, 32, 23, 19, 19, 73, 18, 38, 39, 36, 47, 31],
  },
  {
    usfm: "EST",
    names: { ro: "Estera", uk: "Естер", en: "Esther" },
    verses: [22, 23, 15, 17, 14, 14, 10, 17, 32, 3],
  },
  {
    usfm: "JOB",
    names: { ro: "Iov", uk: "Йов", en: "Job" },
    verses: [
      22, 13, 26, 21, 27, 30, 21, 22, 35, 22, 20, 25, 28, 22, 35, 22, 16, 21,
      29, 29, 34, 30, 17, 25, 6, 14, 23, 28, 25, 31, 40, 22, 33, 37, 16, 33, 24,
      41, 30, 24, 34, 17,
    ],
  },
  {
    usfm: "PSA",
    names: { ro: "Psalm", uk: "Псалми", en: "Psalms" },
    verses: [
      6, 12, 8, 8, 12, 10, 17, 9, 20, 18, 7, 8, 6, 7, 5, 11, 15, 50, 14, 9, 13,
      31, 6, 10, 22, 12, 14, 9, 11, 12, 24, 11, 22, 22, 28, 12, 40, 22, 13, 17,
      13, 11, 5, 26, 17, 11, 9, 14, 20, 23, 19, 9, 6, 7, 23, 13, 11, 11, 17, 12,
      8, 12, 11, 10, 13, 20, 7, 35, 36, 5, 24, 20, 28, 23, 10, 12, 20, 72, 13,
      19, 16, 8, 18, 12, 13, 17, 7, 18, 52, 17, 16, 15, 5, 23, 11, 13, 12, 9, 9,
      5, 8, 28, 22, 35, 45, 48, 43, 13, 31, 7, 10, 10, 9, 8, 18, 19, 2, 29, 176,
      7, 8, 9, 4, 8, 5, 6, 5, 6, 8, 8, 3, 18, 3, 3, 21, 26, 9, 8, 24, 13, 10, 7,
      12, 15, 21, 10, 20, 14, 9, 6,
    ],
  },
  {
    usfm: "PRO",
    names: { ro: "Proverbe", uk: "Приповісті", en: "Proverbs" },
    verses: [
      33, 22, 35, 27, 23, 35, 27, 36, 18, 32, 31, 28, 25, 35, 33, 33, 28, 24,
      29, 30, 31, 29, 35, 34, 28, 28, 27, 28, 27, 33, 31,
    ],
  },
  {
    usfm: "ECC",
    names: { ro: "Eclesiastul", uk: "Екклезіяст", en: "Ecclesiastes" },
    verses: [18, 26, 22, 16, 20, 12, 29, 17, 18, 20, 10, 14],
  },
  {
    usfm: "SNG",
    names: {
      ro: "Cântarea Cântărilor",
      uk: "Пісня над піснями",
      en: "Song of Songs",
    },
    verses: [17, 17, 11, 16, 16, 13, 13, 14],
  },
  {
    usfm: "ISA",
    names: { ro: "Isaia", uk: "Ісая", en: "Isaiah" },
    verses: [
      31, 22, 26, 6, 30, 13, 25, 22, 21, 34, 16, 6, 22, 32, 9, 14, 14, 7, 25, 6,
      17, 25, 18, 23, 12, 21, 13, 29, 24, 33, 9, 20, 24, 17, 10, 22, 38, 22, 8,
      31, 29, 25, 28, 28, 25, 13, 15, 22, 26, 11, 23, 15, 12, 17, 13, 12, 21,
      14, 21, 22, 11, 12, 19, 12, 25, 24,
    ],
  },
  {
    usfm: "JER",
    names: { ro: "Ieremia", uk: "Єремія", en: "Jeremiah" },
    verses: [
      19, 37, 25, 31, 31, 30, 34, 22, 26, 25, 23, 17, 27, 22, 21, 21, 27, 23,
      15, 18, 14, 30, 40, 10, 38, 24, 22, 17, 32, 24, 40, 44, 26, 22, 19, 32,
      21, 28, 18, 16, 18, 22, 13, 30, 5, 28, 7, 47, 39, 46, 64, 34,
    ],
  },
  {
    usfm: "LAM",
    names: {
      ro: "Plângerile lui Ieremia",
      uk: "Плач Єремії",
      en: "Lamentations",
    },
    verses: [22, 22, 66, 22, 22],
  },
  {
    usfm: "EZK",
    names: { ro: "Ezechiel", uk: "Єзекіїль", en: "Ezekiel" },
    verses: [
      28, 10, 27, 17, 17, 14, 27, 18, 11, 22, 25, 28, 23, 23, 8, 63, 24, 32, 14,
      49, 32, 31, 49, 27, 17, 21, 36, 26, 21, 26, 18, 32, 33, 31, 15, 38, 28,
      23, 29, 49, 26, 20, 27, 31, 25, 24, 23, 35,
    ],
  },
  {
    usfm: "DAN",
    names: { ro: "Daniel", uk: "Даниїл", en: "Daniel" },
    verses: [21, 49, 30, 37, 31, 28, 28, 27, 27, 21, 45, 13],
  },
  {
    usfm: "HOS",
    names: { ro: "Osea", uk: "Осія", en: "Hosea" },
    verses: [11, 23, 5, 19, 15, 11, 16, 14, 17, 15, 12, 14, 16, 9],
  },
  {
    usfm: "JOL",
    names: { ro: "Ioel", uk: "Йоїл", en: "Joel" },
    verses: [20, 32, 21],
  },
  {
    usfm: "AMO",
    names: { ro: "Amos", uk: "Амос", en: "Amos" },
    verses: [15, 16, 15, 13, 27, 14, 17, 14, 15],
  },
  {
    usfm: "OBA",
    names: { ro: "Obadia", uk: "Овдій", en: "Obadiah" },
    verses: [21],
  },
  {
    usfm: "JON",
    names: { ro: "Iona", uk: "Йона", en: "Jonah" },
    verses: [17, 10, 10, 11],
  },
  {
    usfm: "MIC",
    names: { ro: "Mica", uk: "Михей", en: "Micah" },
    verses: [16, 13, 12, 13, 15, 16, 20],
  },
  {
    usfm: "NAM",
    names: { ro: "Naum", uk: "Наум", en: "Nahum" },
    verses: [15, 13, 19],
  },
  {
    usfm: "HAB",
    names: { ro: "Habacuc", uk: "Авакум", en: "Habakkuk" },
    verses: [17, 20, 19],
  },
  {
    usfm: "ZEP",
    names: { ro: "Țefania", uk: "Софонія", en: "Zephaniah" },
    verses: [18, 15, 20],
  },
  {
    usfm: "HAG",
    names: { ro: "Hagai", uk: "Огій", en: "Haggai" },
    verses: [15, 23],
  },
  {
    usfm: "ZEC",
    names: { ro: "Zaharia", uk: "Захарія", en: "Zechariah" },
    verses: [21, 13, 10, 14, 11, 15, 14, 23, 17, 12, 17, 14, 9, 21],
  },
  {
    usfm: "MAL",
    names: { ro: "Maleahi", uk: "Малахії", en: "Malachi" },
    verses: [14, 17, 18, 6],
  },
  {
    usfm: "MAT",
    names: { ro: "Matei", uk: "Матвія", en: "Matthew" },
    verses: [
      25, 23, 17, 25, 48, 34, 29, 34, 38, 42, 30, 50, 58, 36, 39, 28, 27, 35,
      30, 34, 46, 46, 39, 51, 46, 75, 66, 20,
    ],
  },
  {
    usfm: "MRK",
    names: { ro: "Marcu", uk: "Марка", en: "Mark" },
    verses: [45, 28, 35, 41, 43, 56, 37, 38, 50, 52, 33, 44, 37, 72, 47, 20],
  },
  {
    usfm: "LUK",
    names: { ro: "Luca", uk: "Луки", en: "Luke" },
    verses: [
      80, 52, 38, 44, 39, 49, 50, 56, 62, 42, 54, 59, 35, 35, 32, 31, 37, 43,
      48, 47, 38, 71, 56, 53,
    ],
  },
  {
    usfm: "JHN",
    names: { ro: "Ioan", uk: "Івана", en: "John" },
    verses: [
      51, 25, 36, 54, 47, 71, 53, 59, 41, 42, 57, 50, 38, 31, 27, 33, 26, 40,
      42, 31, 25,
    ],
  },
  {
    usfm: "ACT",
    names: { ro: "Faptele Apostolilor", uk: "Дії", en: "Acts" },
    verses: [
      26, 47, 26, 37, 42, 15, 60, 40, 43, 48, 30, 25, 52, 28, 41, 40, 34, 28,
      41, 38, 40, 30, 35, 27, 27, 32, 44, 31,
    ],
  },
  {
    usfm: "ROM",
    names: { ro: "Romani", uk: "Римлян", en: "Romans" },
    verses: [32, 29, 31, 25, 21, 23, 25, 39, 33, 21, 36, 21, 14, 23, 33, 27],
  },
  {
    usfm: "1CO",
    names: { ro: "1 Corinteni", uk: "1 Коринтян", en: "1 Corinthians" },
    verses: [31, 16, 23, 21, 13, 20, 40, 13, 27, 33, 34, 31, 13, 40, 58, 24],
  },
  {
    usfm: "2CO",
    names: { ro: "2 Corinteni", uk: "2 Коринтян", en: "2 Corinthians" },
    verses: [24, 17, 18, 18, 21, 18, 16, 24, 15, 18, 33, 21, 14],
  },
  {
    usfm: "GAL",
    names: { ro: "Galateni", uk: "Галатів", en: "Galatians" },
    verses: [24, 21, 29, 31, 26, 18],
  },
  {
    usfm: "EPH",
    names: { ro: "Efeseni", uk: "Ефесян", en: "Ephesians" },
    verses: [23, 22, 21, 32, 33, 24],
  },
  {
    usfm: "PHP",
    names: { ro: "Filipeni", uk: "Филип’ян", en: "Philippians" },
    verses: [30, 30, 21, 23],
  },
  {
    usfm: "COL",
    names: { ro: "Coloseni", uk: "Колоссян", en: "Colossians" },
    verses: [29, 23, 25, 18],
  },
  {
    usfm: "1TH",
    names: { ro: "1 Tesaloniceni", uk: "1 Солунян", en: "1 Thessalonians" },
    verses: [10, 20, 13, 18, 28],
  },
  {
    usfm: "2TH",
    names: { ro: "2 Tesaloniceni", uk: "2 Солунян", en: "2 Thessalonians" },
    verses: [12, 17, 18],
  },
  {
    usfm: "1TI",
    names: { ro: "1 Timotei", uk: "1 Тимофія", en: "1 Timothy" },
    verses: [20, 15, 16, 16, 25, 21],
  },
  {
    usfm: "2TI",
    names: { ro: "2 Timotei", uk: "2 Тимофія", en: "2 Timothy" },
    verses: [18, 26, 17, 22],
  },
  {
    usfm: "TIT",
    names: { ro: "Tit", uk: "Тита", en: "Titus" },
    verses: [16, 15, 15],
  },
  {
    usfm: "PHM",
    names: { ro: "Filimon", uk: "Филимона", en: "Philemon" },
    verses: [25],
  },
  {
    usfm: "HEB",
    names: { ro: "Evrei", uk: "Євреїв", en: "Hebrews" },
    verses: [14, 18, 19, 16, 14, 20, 28, 13, 28, 39, 40, 29, 25],
  },
  {
    usfm: "JAS",
    names: { ro: "Iacov", uk: "Якова", en: "James" },
    verses: [27, 26, 18, 17, 20],
  },
  {
    usfm: "1PE",
    names: { ro: "1 Petru", uk: "1 Петра", en: "1 Peter" },
    verses: [25, 25, 22, 19, 14],
  },
  {
    usfm: "2PE",
    names: { ro: "2 Petru", uk: "2 Петра", en: "2 Peter" },
    verses: [21, 22, 18],
  },
  {
    usfm: "1JN",
    names: { ro: "1 Ioan", uk: "1 Івана", en: "1 John" },
    verses: [10, 29, 24, 21, 21],
  },
  {
    usfm: "2JN",
    names: { ro: "2 Ioan", uk: "2 Івана", en: "2 John" },
    verses: [13],
  },
  {
    usfm: "3JN",
    names: { ro: "3 Ioan", uk: "3 Івана", en: "3 John" },
    verses: [14],
  },
  { usfm: "JUD", names: { ro: "Iuda", uk: "Юди", en: "Jude" }, verses: [25] },
  {
    usfm: "REV",
    names: { ro: "Apocalipsa", uk: "Об’явлення", en: "Revelation" },
    verses: [
      20, 29, 22, 11, 14, 17, 17, 13, 21, 11, 19, 17, 18, 20, 8, 21, 18, 24, 21,
      15, 27, 21,
    ],
  },
];
