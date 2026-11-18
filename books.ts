import type { ActivityRow, BookRow } from "@/db/schema";

export interface BookDTO {
  id: string;
  title: string;
  author: string;
  genre: string;
  rating: number;
  price: number;
  year: number | null;
  synopsis: string;
  publisher: string;
  pages: number | null;
  language: string;
  isbn: string;
  aboutAuthor: string;
  cover: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(String(value || "").trim());
}

export function sanitiseBookInput(raw: Record<string, unknown>) {
  const rawRating = Number(raw.rating);
  const rating = Number.isFinite(rawRating)
    ? Math.round(Math.min(5, Math.max(0, rawRating)) * 10) / 10
    : 0;

  const cleanedPriceStr = String(raw.price ?? "")
    .replace(/[₹$€£,\s]/g, "")
    .trim();
  const rawPrice = cleanedPriceStr ? Number(cleanedPriceStr) : 0;
  const price = Number.isFinite(rawPrice) ? Math.max(0, rawPrice) : 0;

  const cleanedYearStr = String(raw.year ?? "").trim();
  const yearMatch = cleanedYearStr.match(/\b(1\d{3}|20\d{2}|2100)\b/);
  const parsedYear = yearMatch
    ? Number(yearMatch[1])
    : cleanedYearStr
    ? Math.round(Number(cleanedYearStr))
    : null;
  const year =
    parsedYear && Number.isFinite(parsedYear) && parsedYear > 0
      ? parsedYear
      : null;

  const cleanedPagesStr = String(raw.pages ?? "")
    .replace(/[,\s]/g, "")
    .trim();
  const rawPages = cleanedPagesStr ? Math.round(Number(cleanedPagesStr)) : null;
  const pages = rawPages && Number.isFinite(rawPages) && rawPages > 0 ? rawPages : null;

  const aboutAuthor = String(
    raw.aboutAuthor ?? raw.aboutauthor ?? raw.about_author ?? ""
  ).trim();

  const cover = String(raw.cover ?? raw.coverpage ?? "").trim();

  return {
    title: String(raw.title ?? "").trim(),
    author: String(raw.author ?? "").trim(),
    genre: String(raw.genre ?? "").trim(),
    rating,
    price,
    year,
    synopsis: String(raw.synopsis ?? "").trim(),
    publisher: String(raw.publisher ?? "").trim(),
    pages,
    language: String(raw.language ?? "").trim() || "English",
    isbn: String(raw.isbn ?? "").trim(),
    aboutAuthor,
    cover,
  };
}

export function normaliseBook(book: BookRow | BookDTO): BookDTO {
  return {
    id: book.id,
    title: book.title || "",
    author: book.author || "",
    genre: book.genre || "",
    rating: Math.round((Number(book.rating) || 0) * 10) / 10,
    price: Number(book.price) || 0,
    year: book.year ? Number(book.year) : null,
    synopsis: book.synopsis || "",
    publisher: book.publisher || "",
    pages: book.pages ? Number(book.pages) : null,
    language: book.language || "",
    isbn: book.isbn || "",
    aboutAuthor: book.aboutAuthor || "",
    cover: book.cover || "",
  };
}

const STOP_WORDS = new Set(
  "a an the and or of to in on is are was for with by from as at that this it its into who his her their be than then not but about over"
    .split(" ")
);

// Light stemming helper so "habits"/"habit", "wizards"/"wizard", "routines"/"routine" match semantically
function lightStem(word: string): string {
  if (word.length > 5 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith("s") && !word.endsWith("ss")) {
    return word.slice(0, -1);
  }
  return word;
}

export function tokenize(text: string): string[] {
  const rawWords = String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));

  const tokens: string[] = [];
  for (const word of rawWords) {
    tokens.push(word);
    const stem = lightStem(word);
    if (stem !== word && stem.length > 2) {
      tokens.push(stem);
    }
  }
  return tokens;
}

export interface TfIdfIndex {
  idf: Record<string, number>;
  vectors: Record<string, number>[];
}

export function buildIndex(bookList: BookDTO[]): TfIdfIndex {
  const docs = bookList.map((book) =>
    tokenize(
      [book.title, book.title, book.author, book.genre, book.synopsis, book.aboutAuthor].join(
        " "
      )
    )
  );

  const documentFrequency: Record<string, number> = {};
  docs.forEach((words) => {
    new Set(words).forEach((word) => {
      documentFrequency[word] = (documentFrequency[word] || 0) + 1;
    });
  });

  const idf: Record<string, number> = {};
  Object.entries(documentFrequency).forEach(([word, count]) => {
    idf[word] = Math.log((bookList.length + 1) / (count + 1)) + 1;
  });

  const vectors = docs.map((words) => {
    const termCounts: Record<string, number> = {};
    words.forEach((word) => {
      termCounts[word] = (termCounts[word] || 0) + 1;
    });

    const vector: Record<string, number> = {};
    let length = 0;
    Object.entries(termCounts).forEach(([word, count]) => {
      const weight = count * (idf[word] || 0);
      vector[word] = weight;
      length += weight * weight;
    });

    const magnitude = Math.sqrt(length) || 1;
    Object.keys(vector).forEach((word) => {
      vector[word] /= magnitude;
    });
    return vector;
  });

  return { idf, vectors };
}

export function cosine(a: Record<string, number>, b: Record<string, number>): number {
  let total = 0;
  for (const word in a) {
    if (b[word]) {
      total += a[word] * b[word];
    }
  }
  return total;
}

export function searchBooks(
  bookList: BookDTO[],
  query: string
): { book: BookDTO; score: number }[] {
  const trimmed = String(query || "").trim();
  if (!trimmed) {
    return bookList.map((book) => ({ book, score: 0 }));
  }

  const index = buildIndex(bookList);
  const queryWords = tokenize(trimmed);
  const queryVector: Record<string, number> = {};

  queryWords.forEach((word) => {
    if (index.idf[word]) {
      queryVector[word] = (queryVector[word] || 0) + index.idf[word];
    } else {
      // Partial prefix expansion in vocabulary for live typing
      Object.entries(index.idf).forEach(([vocabWord, idfVal]) => {
        if (word.length >= 3 && vocabWord.startsWith(word)) {
          queryVector[vocabWord] = (queryVector[vocabWord] || 0) + idfVal * 0.65;
        }
      });
    }
  });

  let magnitude = 0;
  Object.values(queryVector).forEach((value) => {
    magnitude += value * value;
  });
  magnitude = Math.sqrt(magnitude) || 1;
  Object.keys(queryVector).forEach((word) => {
    queryVector[word] /= magnitude;
  });

  const lowerQuery = trimmed.toLowerCase();

  return bookList
    .map((book, i) => {
      const tfidfScore = Object.keys(queryVector).length
        ? cosine(queryVector, index.vectors[i])
        : 0;
      const haystack = `${book.title} ${book.author} ${book.genre} ${book.synopsis}`.toLowerCase();
      const exactTitleBoost = book.title.toLowerCase().includes(lowerQuery) ? 0.35 : 0;
      const substringBoost = haystack.includes(lowerQuery) ? 0.15 : 0;
      return {
        book,
        score: tfidfScore + exactTitleBoost + substringBoost,
      };
    })
    .filter((item) => item.score > 0.01);
}

export function getSimilarBooks(
  bookList: BookDTO[],
  targetId: string,
  limit = 4
): BookDTO[] {
  const index = buildIndex(bookList);
  const currentIndex = bookList.findIndex((item) => String(item.id) === String(targetId));
  if (currentIndex < 0) return [];

  const targetGenre = bookList[currentIndex].genre;

  return bookList
    .map((item, i) => ({
      book: item,
      score:
        cosine(index.vectors[currentIndex], index.vectors[i]) +
        (item.genre === targetGenre ? 0.08 : 0),
    }))
    .filter((item) => String(item.book.id) !== String(targetId))
    .sort((a, b) => b.score - a.score || b.book.rating - a.book.rating)
    .slice(0, limit)
    .map((item) => item.book);
}

export function getPersonalisedRecommendations(
  bookList: BookDTO[],
  userActivities: ActivityRow[],
  limit = 8
): {
  books: (BookDTO & { matchReason?: string })[];
  personalised: boolean;
  topGenres: string[];
} {
  const weights: Record<string, number> = {};
  const genreWeights: Record<string, number> = {};

  userActivities.forEach((item) => {
    let weight = 0;
    if (item.type === "wishlist") weight = 2;
    else if (item.type === "rating") weight = (item.rating ?? 0) >= 4 ? 3 : -1;
    else if (item.type === "view") weight = 1;

    weights[item.bookId] = (weights[item.bookId] || 0) + weight;
  });

  const index = buildIndex(bookList);
  const profile: Record<string, number> = {};
  let profileMagnitude = 0;

  Object.entries(weights).forEach(([bookId, weight]) => {
    const bookIndex = bookList.findIndex((book) => String(book.id) === bookId);
    if (bookIndex < 0 || weight <= 0) return;

    const book = bookList[bookIndex];
    genreWeights[book.genre] = (genreWeights[book.genre] || 0) + weight;

    Object.entries(index.vectors[bookIndex]).forEach(([word, value]) => {
      profile[word] = (profile[word] || 0) + value * weight;
      profileMagnitude += value * value * weight * weight;
    });
  });

  profileMagnitude = Math.sqrt(profileMagnitude) || 1;
  Object.keys(profile).forEach((word) => {
    profile[word] /= profileMagnitude;
  });

  const topGenreWeight = Math.max(0, ...Object.values(genreWeights));
  const topGenres = Object.entries(genreWeights)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([genre]) => genre);

  const seen = new Set(Object.keys(weights));
  const personalised = Object.keys(profile).length > 0;

  const ranked = bookList.map((book, i) => {
    const similarity = personalised ? cosine(profile, index.vectors[i]) : 0;
    const genreBoost = topGenreWeight
      ? ((genreWeights[book.genre] || 0) / topGenreWeight) * 0.1
      : 0;
    const score = similarity + genreBoost + book.rating / 50;

    let matchReason = "Acclaimed reader favourite";
    if (personalised) {
      if (genreWeights[book.genre] && similarity > 0.08) {
        matchReason = `Matches your ${book.genre} picks & themes`;
      } else if (genreWeights[book.genre]) {
        matchReason = `Because you enjoy ${book.genre}`;
      } else if (similarity > 0.06) {
        matchReason = "Similar themes to books you liked";
      } else {
        matchReason = "Highly rated discovery for you";
      }
    }

    return {
      book: { ...book, matchReason },
      score,
      seen: seen.has(String(book.id)),
    };
  });

  const results = ranked
    .sort((a, b) => b.score - a.score)
    .filter((item) => !item.seen)
    .slice(0, limit)
    .map((item) => item.book);

  return {
    books: results,
    personalised,
    topGenres,
  };
}

export const CSV_HEADER_ALIASES: Record<string, string> = {
  // Title
  title: "title",
  name: "title",
  book: "title",
  booktitle: "title",
  "book title": "title",
  book_title: "title",
  "book name": "title",
  book_name: "title",
  // Author
  author: "author",
  authors: "author",
  "author(s)": "author",
  "author name": "author",
  writer: "author",
  "book author": "author",
  book_author: "author",
  // Genre
  genre: "genre",
  genres: "genre",
  category: "genre",
  categories: "genre",
  "book genre": "genre",
  "book category": "genre",
  subject: "genre",
  // Rating
  rating: "rating",
  ratings: "rating",
  "user rating": "rating",
  user_rating: "rating",
  "average rating": "rating",
  average_rating: "rating",
  avg_rating: "rating",
  stars: "rating",
  score: "rating",
  // Price
  price: "price",
  cost: "price",
  mrp: "price",
  "book price": "price",
  "price (inr)": "price",
  price_inr: "price",
  // Year
  year: "year",
  "publication year": "year",
  publication_year: "year",
  pub_year: "year",
  published_year: "year",
  original_publication_year: "year",
  "release year": "year",
  published: "year",
  // Synopsis
  synopsis: "synopsis",
  description: "synopsis",
  summary: "synopsis",
  overview: "synopsis",
  blurb: "synopsis",
  plot: "synopsis",
  // Publisher
  publisher: "publisher",
  imprint: "publisher",
  // Pages
  pages: "pages",
  num_pages: "pages",
  "number of pages": "pages",
  page_count: "pages",
  "page count": "pages",
  // Language
  language: "language",
  language_code: "language",
  lang: "language",
  // ISBN
  isbn: "isbn",
  isbn13: "isbn",
  isbn_13: "isbn",
  isbn10: "isbn",
  isbn_10: "isbn",
  // About author
  aboutauthor: "aboutAuthor",
  about_author: "aboutAuthor",
  "about author": "aboutAuthor",
  author_bio: "aboutAuthor",
  "author bio": "aboutAuthor",
  // Cover
  cover: "cover",
  coverpage: "cover",
  cover_page: "cover",
  cover_url: "cover",
  "cover url": "cover",
  "cover image": "cover",
  cover_image: "cover",
  image_url: "cover",
  "image url": "cover",
  thumbnail: "cover",
};

function detectCsvDelimiter(firstLine: string): string {
  const scores = new Map([[",", 0], [";", 0], ["\t", 0]]);
  let quoted = false;
  for (const c of firstLine) {
    if (c === '"') quoted = !quoted;
    else if (!quoted && scores.has(c)) scores.set(c, scores.get(c)! + 1);
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export function parseCsvWithMeta(text: string): {
  headers: string[];
  mappedHeaders: string[];
  rows: Record<string, string>[];
  error?: string;
} {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  // Excel may include a separator declaration or CR-only line endings.
  let cleanText = String(text || "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").replace(/^(?:[ \t]*\n)+/, "");
  const declaration = /^sep=([,;\t])\s*\n/i.exec(cleanText);
  if (declaration) cleanText = cleanText.slice(declaration[0].length);
  const firstLine = cleanText.split("\n", 1)[0];
  const delimiter = declaration?.[1] || detectCsvDelimiter(firstLine);

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];

    if (quoted) {
      if (char === '"' && cleanText[i + 1] === '"') {
        value += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  if (quoted) {
    return { headers: [], mappedHeaders: [], rows: [], error: "A quoted field is missing its closing quotation mark. Fix the CSV and choose it again." };
  }
  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);

  if (!rows.length) {
    return { headers: [], mappedHeaders: [], rows: [] };
  }

  const rawHeaders = rows.shift()!.map((h) => h.trim());
  const mappedHeaders = rawHeaders.map((h) => {
    const lower = h.toLowerCase().replace(/\s+/g, " ").trim();
    return Object.hasOwn(CSV_HEADER_ALIASES, lower) ? CSV_HEADER_ALIASES[lower] : lower;
  });

  const parsedRows = rows.map((cells) => {
    const item: Record<string, string> = Object.create(null);
    mappedHeaders.forEach((key, index) => {
      const cellVal = (cells[index] || "").trim();
      // Keep first non-empty value when multiple alias columns map to the same field
      if (!item[key] && cellVal) {
        item[key] = cellVal;
      } else if (!(key in item)) {
        item[key] = cellVal;
      }
    });
    return item;
  });

  return {
    headers: rawHeaders,
    mappedHeaders: [...new Set(mappedHeaders.filter(Boolean))],
    rows: parsedRows,
  };
}

export function parseCsv(text: string): Record<string, string>[] {
  return parseCsvWithMeta(text).rows;
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function serializeBooksToCsv(bookList: BookDTO[]): string {
  const headers = [
    "title",
    "author",
    "genre",
    "rating",
    "price",
    "year",
    "synopsis",
    "publisher",
    "pages",
    "language",
    "isbn",
    "aboutauthor",
    "coverpage",
  ];

  const lines = [headers.join(",")];
  for (const b of bookList) {
    lines.push(
      [
        escapeCsvCell(b.title),
        escapeCsvCell(b.author),
        escapeCsvCell(b.genre),
        escapeCsvCell(b.rating),
        escapeCsvCell(b.price),
        escapeCsvCell(b.year),
        escapeCsvCell(b.synopsis),
        escapeCsvCell(b.publisher),
        escapeCsvCell(b.pages),
        escapeCsvCell(b.language),
        escapeCsvCell(b.isbn),
        escapeCsvCell(b.aboutAuthor),
        // Avoid dumping huge base64 strings into cover column if it's an inline data URL
        escapeCsvCell(b.cover.startsWith("data:") ? "" : b.cover),
      ].join(",")
    );
  }
  return lines.join("\n") + "\n";
}
