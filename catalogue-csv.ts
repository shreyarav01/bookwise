import { parseCsvWithMeta, sanitiseBookInput } from "./books";

export const CSV_LIMIT = 10 * 1024 * 1024;
export const requiredColumns = ["title", "author", "genre"] as const;
export type DuplicateMode = "skip" | "update";
export type CsvSource = Record<string, string>;
export type CsvBook = ReturnType<typeof sanitiseBookInput>;
export type LibraryKey = { id: string; title: string; author: string };
export type RowStatus = "add" | "update" | "duplicate" | "missing";

export class CsvError extends Error {}

export function parsedFile(text: string): CsvSource[] {
  if (!text.trim()) throw new CsvError("This file is empty. Choose a CSV with at least one book.");
  if (/[\u0000\uFFFD]/u.test(text)) {
    throw new CsvError("This file could not be read as text. Save it as CSV UTF-8 and try again.");
  }
  const parsed = parseCsvWithMeta(text);
  if (parsed.error) throw new CsvError(parsed.error);
  const missing = requiredColumns.filter((key) => !parsed.mappedHeaders.includes(key));
  if (missing.length) {
    throw new CsvError(`Missing ${missing.join(", ")} ${missing.length === 1 ? "column" : "columns"}. Include title, author and genre in the first row, or use the template below.`);
  }
  if (!parsed.rows.length) throw new CsvError("The headers look good, but there are no books yet. Add a book on the next row.");
  return parsed.rows;
}

export async function readBookFile(file: File): Promise<CsvSource[]> {
  if (!/\.csv$/i.test(file.name.trim())) throw new CsvError("Please choose a .csv file. In Excel or Sheets, export your spreadsheet as CSV first.");
  if (!file.size) throw new CsvError("This file is empty. Choose a CSV with a header and at least one book.");
  if (file.size > CSV_LIMIT) throw new CsvError("This CSV is larger than 10 MB. Split it into smaller files and try again.");
  // Extensions and MIME hints from mobile browsers/Excel are not reliable encodings.
  // Validate the content and required headers on BOTH client and server.
  const bytes = new Uint8Array(await file.arrayBuffer());
  if ((bytes[0] === 0x50 && bytes[1] === 0x4b) || (bytes[0] === 0xd0 && bytes[1] === 0xcf)) {
    throw new CsvError("This is an Excel workbook, not a CSV. Use Save As → CSV UTF-8, then choose the exported file.");
  }
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le" : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : "utf-8";
  let text: string;
  try { text = new TextDecoder(encoding, { fatal: true }).decode(bytes); }
  catch { throw new CsvError("The text encoding could not be read. Export the spreadsheet as CSV UTF-8 and try again."); }
  return parsedFile(text);
}

function keyOf(title: string, author: string) {
  return JSON.stringify([title.trim().toLowerCase(), author.trim().toLowerCase()]);
}

export function planImport(rows: CsvSource[], known: LibraryKey[], mode: DuplicateMode) {
  const catalogue = new Map(known.map((b) => [keyOf(b.title, b.author), b.id]));
  const seen = new Set<string>();
  const counts = { add: 0, update: 0, duplicate: 0, missing: 0 };
  const entries = rows.map((source, index) => {
    const book = sanitiseBookInput(source);
    const key = keyOf(book.title, book.author);
    const existingId = catalogue.get(key);
    let status: RowStatus;
    if (!book.title || !book.author || !book.genre) status = "missing";
    else if (seen.has(key)) status = "duplicate";
    else {
      seen.add(key);
      status = existingId ? (mode === "update" ? "update" : "duplicate") : "add";
    }
    counts[status]++;
    return { row: index + 1, book, status, existingId };
  });
  return { entries, counts, changes: counts.add + counts.update };
}

// A CSV containing only prices must not erase an existing synopsis or cover.
export function providedFields(book: CsvBook, source: CsvSource): Partial<CsvBook> {
  return Object.fromEntries(Object.entries(book).filter(([key]) => source[key]?.trim()));
}
