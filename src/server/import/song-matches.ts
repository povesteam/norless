/**
 * UA song id → the RO song it copies or translates, where the ids differ:
 * songs added again in the UA app under a new id (mostly a Russian
 * translation under the RO title), and UA copies later overwritten with
 * another song (the last five). Matched by reading both texts;
 * the import of the cutover dump uses it once.
 *
 * Six UA songs have no RO song and stay on their own: two Easter and Christmas
 * sketches, three songs only sung in the UA room, and a prayer list.
 */
export const UA_SONG_MATCHES: Record<string, string> = {
  "32uECu9FQ795fNA2M": "4SNZ4fdY4ecMu255z", // A venit Isus
  YtQbndqymTZKho2dA: "p8HTPNieioEMwfy5e", // Autentic
  "2CyMWN8iWZE4c8p2P": "pATvmjtrpeBcrqfjQ", // Rebecca
  Bz7gq4MykLMLKT7rk: "Sq636wfBpwKqMX9xg", // Cel mai mare proiect
  j8sWy3jcB5qfgvGbB: "Df5cR7pbh2BoFLYKB", // Cântecul revelației (El-Betel)
  aZZCtWj6sKvGJqb5T: "Duw6eGWQKsZMWMLem", // De noi fii slăvit
  xw5Pm9jc42pn7LLL8: "gbXYPBccJzg9ovMw9", // Din trupul sfânt al lui Isus
  qoAizHxmTMcWp2iRF: "qkimSfxnpiPnfx5TE", // Doamne, Tu ești bucuria mea
  M4CnaassHXj3pLoBu: "x6nAqKQdA9Px6HC5m", // Doar prin crucea Ta măreață
  HcbZQGMDkho8MBzCE: "4v7jCihTtYNcGjEwQ", // Domnul vă binecuvânteze (Sili)
  zuAzrpP6EbDtZDJ5d: "Y2vXuNpFQgYCCHRi5", // Dumnezeu minunat
  aXxvcvDB3T4a93AvY: "FLsu4zxGKYskt5Zv2", // Hristos a înviat din morți
  efAAHu2wC3YKT7Wjz: "ze2G7wbYuimzpodTf", // Inima-mi cântă de bucurie
  pnzXP82t6htikLafo: "gXRSxhNAhwBjZ7PaD", // Mergi și spune
  EfsZaxAvE5FXyWP24: "AxgxEN5EYTDuM7JLY", // Mărețul Har (Lanțul s-a frânt)
  GJovLEZX26t3WWucZ: "JwLjcFohva2ttc75B", // Noel - BBSO
  RTGj27Ltr6ScxZsv5: "ArMyEYfiexWHBXfrg", // O, ce minunat
  cMXRnzzjyKwC7iL7j: "u9qLCKKH9ELgJWjST", // PRIVESC CU BUCURIE (VBS)
  KDyY2kjXDcLLW67Wu: "5vKJ6XK9AzewYdDjL", // Pe Stâncă-s ancorat
  h9W394WcRssHzvmRE: "4EEwtvYjnXzqGHnkM", // Pe aproape să-l iubești
  woFgAqeuz3wZcy7kB: "oJ7YtEw59sN56wZ8d", // Purtăm în suflet dor de veșnicii
  AWBCWbWmY27hra7Qz: "ASedAqqFAKs2PTpNS", // Ridică-te, oștirea lui Cristos
  n3NCBkjKRW4sPjYoT: "z3use2Lh3ADcPjKfS", // SUPEREROU (VBS)
  DEieTYkZRvRcRvZEc: "mZ8kPre9aCXubjn2C", // Sfânt aş vrea să fiu, o, Doamne
  Ho5CzWuC5YiuisG9t: "N7bxvXHFn92dWfd4B", // Sunt plin de bucurie
  dTfKKqbJqmAztwX2E: "NwtRRnebFJoJ8gQw7", // Sus la lucru
  ZxiXNTNGRTYhNZp7d: "kEwvHMqngeugaEodW", // Să răsune pământul
  DwKvnZCerayQTPcsr: "LhgFQjhLN4XFYFmuW", // Să răsune vestea (S-a născut Mesia)
  "6eTsSu5CqEaaFs7zw": "4ZQSMT34bSvEJDjtZ", // Te iubesc, Isuse, ştiu că eşti al meu
  zvnkdjEKzSEZW8EDb: "wr4YcW8aqAbPNKLvL", // Te rog, cercetează-mă Tu!
  "2n8hygueEG6XknbzA": "erojCjpJf2TGk9B8v", // Un rob (Să răstignești)
  zA88nXmT2aLWRoWhz: "DgX6iJoei6aSvuDu8", // Vine duminica (Phil Wickham)
  oYYsgwMMQD4xzH9wm: "DXBkr6LSKoQyrfTse", // Dumnezeu peste toate
  "8CjpMW4LbSeSsbxSk": "QBRTFGmeidKrDEYvJ", // În rugăciune îndrăznim
  wteQbE877zmvC8csS: "PQyRytRoFcebJDonc", // În această noapte sfântă/ El s-a născut (Eldad Kids)
  LNHDEqG7dKKjfc5Ks: "nDsCAQGKkSr82i5ms", // Regele suprem
  "87DHswxBQEB4JZaK7": "dKFBJ2W6ThZAyMbKA", // Cu vocea mea vreau să Te laud
  sFgT65TW4WgZXRbsE: "P8Pf8TqkEdispQxi8", // Doamne, bunătatea Ta
  "5pJam4J2ddkbKj8Qo": "S2Guk5HWpMkwJuh3j", // Doamne Tu eşti stânca-n care mă ascund
  xsdmernaY3EE95LDy: "PcaNYHsbs9ai6GfLP", // Doamne, viața fără Tine
  TvmNKKSy32KgQD23z: "MSXGNBeD7cdoJkwBL", // Copiii au spus: Osana!
  vvKp4ySSauR2aCpS3: "wjSXn6EPutj2DHjHJ", // Vrednic este Mielul care-a fost junghiat
  kL2HqkK5oj4bpTzLz: "pqvLJsxxZayLS5Wac", // Dacă ești purtat de valul furios
  mdWADEFY3Fz8k3cv5: "trfg4t3NtktniKewK", // Dacă-ntr-o tainică vreme
  "46J5wvQfrNaZbcq7d": "j6cjsYQxhbuH5eZzK", // Căci iată că El
  pLtckNvnTRQbBJnqh: "eykTcYZPFRPrHWeye", // Iehova Elohim (alternativ)
  "6N74ZECf9DdzfByXx": "gadGy3SZLmqQLkM28", // Ierusalim (BBSO)
  ywx8nAKDc8Cfj6xAT: "CGhpSQSZWXhv2hznM", // A înviat Isus Cristos
  ADrNq7W7x8Htagz5t: "ZtKBnpmbbGuujSTui", // Răscumpărătorul
  "2Kyn7mYmvkXC3f4r8": "eRfNzjD4qJBLC6jFm", // Ce mare har să poți vedea
  JYTJT9XkNo6yTphd9: "QqQsPmpFnofPcsufe", // Ce zori slăvite
  yGpsjM7ALY5pi7Gfs: "wRyipyCMK4Hd8GtSS", // Când eram fără speranță (King of kings)
  sZhZof487g2QGaEdb: "z6ER7j4bAqGTCcRpD", // Cine altul decât Isus
  ZSvkhmRFzdsXfnbkS: "iJAJ5h8aPARYd5GzE", // Cine-a dat oceanelor hotar?
  opkgiZS5QEn784xvZ: "WtXbG8BT5EW78XDwJ", // Maria știa…
  "8QeScRNd8Hv3cF5ry": "KNE3JQbbaGmrvEhJ9", // Valoarea mea nu stă-n averi
  sqvGeFGdcNKg3iHeh: "YhWkM3xvsSQNeoX6H", // Noi cântăm si lăudăm pe EI
  kwacZDxihqFPGpTtt: "vxMR748FFwwnQypZf", // El te păzește mereu
  kqYSnN6x9zvriTHuq: "Piq6ApowHaCxHH6aK", // Alive
  "8j69JJKzcHrkGDKYd": "ELh3uJchZDj6mG53P", // El e Domn, El e Domn
  ZYGKdx9rXBKzZ7xLp: "h4n9WvhnACKhrQ4Ft", // Veniți copii de pe-ntregul pământ
  ES3NwchoM5gSWyv28: "rF8ybjrPn2xxD5cKE", // Bucurie (Eldad Kids)
  djtxZ3XCd8cPCxDmc: "Qyz883J8LroyrM8AM", // Bucuria a răsărit
  "5Y9bSnMXkDhSZSDJh": "Q6C5oZEt9X82EdrWy", // Cu inimi deschise
  ovMHzYkEnvyJK6Jk4: "uEroQX4gho9kp6Bs7", // Sfânta Scriptură deschisă
  bCNTjKZGAWjtCDp9j: "FGk39Nj2y5tSKGBWu", // Frământarea unui sceptic (Simona Muresan)
  ga9xcQeFagvXDiXyY: "Z4JD9QjLBQyzyqi7J", // Păstrează credința
  kshHqrXGokGRxy5Fe: "4RDK9ekG5NRf6cxWz", // Mântuire (Continental)
  DHGCoPuo8vqNBLvHE: "qCYP38nypAxM4bJ2w", // Îți mulțumesc că stele pot vedea
  FRtwYYWJbx7D44PLA: "2uPgGF8Bkt9DsdphH", // Duhul Tău - Orice-am face Doamne, orice-am spune
  igoaJxCkWP9prqKwM: "WLCLgFztTKyRA9nEq", // Dragostea Ta (1907)
  "5mjgLGFgzfDMBc79H": "nSMZqo8eNThmbfqCJ", // Vrednic ești doar Tu
  dY8RjBLkdCnthwsby: "W6mhmTzd949WpKz7G", // Laudă, cinste, onoare Mielului ce-a înviat
  o9WNeP5TpJ7h3a3CX: "Fww9u5rs6d24zqxYF", // E puterea crucii Lui - (Sofia Copaciu)
  ezEkRchJ7EXmpuQa9: "7KruwoHXzHXtGYj6f", // Voi cânta bunătatea Ta
  "7cC9BbWnHRTEMxNQW": "D8QN655xnZKyn2rEB", // Eu cred în Crăciun
  B4W8YPJaimBnTEQjH: "xytHyjywA9FdnRCuS", // Știu cine sunt
  DaF2nJ29gYExWnGY3: "P2Td6vM6dtvDYTmf6", // Te-nalț, Doamne, pururi
  sDsb8dkjbvdCGXCdY: "jsNWFyNGp2Lpzte9k", // Cânt Aleluia (Lumina ești, comoara eternă)
  gWZpejrESx7m3WSKt: "eaT9woykBt4XSEkMw", // Voi veni cu bucurie (Eu sunt fericit) (Osana)
  Mj5gyYr699Xsu5HvR: "Se8qekLx6TqdKBNLe", // Eu Te laud în furtuni
  TKctDMC9ugx7cRAb3: "uasn7RYJTyuph5ya5", // Privesc către crucea (Stau din nou)
  BHji6Hqfr3JimxMoT: "Qmn8jm7BHpv8GjSRF", // Strâng Cuvântul Tău (Psalm 119:11)
  iikBhnwLp9FxJHqvQ: "9JW6Mah9fhr825o7F", // Să Te vreau pe Tine, Isus
  ePdjPTcyELMYYiZTj: "phgku4rnZpRgxZwop", // IAHWE
  Ajdny85WDi9Fnj2Sv: "Xy3FzEARKeYPd2FiP", // Cântăm Aleluia (Christ our Hope in Life and Death)
  nPNEpQjT4dv2SWcdF: "c9GmZwwhpy5rt5FA9", // Ce mare și bun, minunat și slăvit •
  jngFrxZjAuThjSZjd: "P8Pf8TqkEdispQxi8", // Doamne, bunătatea Ta
  neb9Rcc34e4Na2okT: "86qhs6xfZZHBviuAF", // Doar în Hristos
  mXfrEYqxiKm9WocdS: "2DbT2s8FK446XtxEC", // O noapte preasfințită
  LzSTnT9PYsQAzEgx3: "xACnLPiYcabJhtQj7", // ukrainean song - Добрий вечір тобі!
  yDwX3dsSX78Qgf4p9: "EtrqThwJ5Y8t8JM4K", // ukrainean song - На Різдво Христове
  qdLBg7hYsDwiMtaAy: "tgz3prDy95xeDndnf", // ukrainean song - Нова радість стала
  YJToXKGFAFmmp3ZLW: "trpRH8jAXrujsZSLM", // ukrainean song - Нова радість стала
  cQEdaG2j9bebBQeCs: "oRjyXJHWTGA7ZC3ML", // ukrainean song - По всьому світу стала новина
  rtEo9LH8EsLp6Zz5J: "wrwgioDR9ZPrZaqPf", // Mărturisim acum că suntem slabi
  hwMNx689vfmXARoaY: "D2cDxNnJgL8mGC7MC", // Cetate tare-i Dumnezeu (Noi știm că Domnu Dumnezeu)
  MSXGNBeD7cdoJkwBL: "mADXS92nLEFR2WT2a", // Fugi Petru, fugi!
  "5GerBLSQyTzk2X4YW": "xnZwvbyaPuCjgigtr", // Tot ce sunt (Arad)
  DgX6iJoei6aSvuDu8: "GB48GpRSuNXMEem63", // Iubirea-adâncă-a Tatălui
};
