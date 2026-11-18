export type PageKey = "home" | "browse" | "recs" | "ins" | "adm";

export type AdminTab = "csv" | "files" | "editor" | "catalogue" | "roles";

export interface User {
  id: string;
  username: string;
  isAdmin: boolean;
}

export interface Book {
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
  matchReason?: string;
}

export interface Review {
  id?: string;
  username: string;
  rating: number;
  feedback: string;
  createdAt?: string;
}

export interface HomeData {
  books: Book[];
  bestsellers: Book[];
  newReleases: Book[];
  trending: Book[];
  categories: string[];
}

export interface BookDetailData {
  book: Book;
  reviews: Review[];
  similar: Book[];
  wishlisted: boolean;
  userRating: { rating: number; feedback: string } | null;
}

export interface RecommendationsData {
  books: Book[];
  personalised: boolean;
  topGenres: string[];
  wishlist: Book[];
  ratings: {
    book: Book;
    rating: number;
    feedback: string;
    createdAt?: string;
  }[];
  stats: {
    wishlisted: number;
    rated: number;
    viewed: number;
  };
}

export interface InsightsData {
  genres: { label: string; count: number }[];
  authors: { label: string; count: number }[];
  ratingByGenre: { label: string; count: number; average: number }[];
  priceByGenre: { label: string; count: number; average: number }[];
  ratingByYear: { label: string; count: number; average: number }[];
  summary: {
    totalBooks: number;
    totalGenres: number;
    avgRating: number;
    avgPrice: number;
    totalReviews: number;
    totalWishlists: number;
    totalViews: number;
  };
}

export const TOKEN_STORAGE_KEY = "bookwise_token";
// The current tab still works if the embedded browser disallows persistent storage.
let memoryToken: string | null = null;
export function getStoredToken(): string {
  if (typeof window === "undefined") return "";
  if (memoryToken !== null) return memoryToken;
  try {
    const saved = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (saved) return saved;
  } catch { /* Some embedded contexts block persistent storage. */ }
  try { return window.sessionStorage.getItem(TOKEN_STORAGE_KEY) || ""; } catch { return ""; }
}
export function syncTokenFromOtherTab(token: string | null) {
  memoryToken = token || "";
  try {
    if (token) window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch { /* In-memory access still works. */ }
}
export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  syncTokenFromOtherTab(token);
  try {
    if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch { /* The tab session remains usable. */ }
}
export function sessionHeaders(token: string | null = getStoredToken()): Record<string, string> {
  return token ? { "X-Bookwise-Session": token } : {};
}
export type AuthResult = { token: string; user: User };
export type SessionProfile = { user: User; wishlistIds: string[] };
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = "ApiError"; }
}
export async function apiRequest<T>(path: string, options: RequestInit = {}, token: string | null = getStoredToken()): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  for (const [key, value] of Object.entries(sessionHeaders(token))) headers.set(key, value);
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 20000);
  try {
    const response = await fetch(`/api${path}`, { ...options, headers, credentials: "same-origin", cache: "no-store", signal: controller.signal });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(response.status, data?.error || "Bookwise could not complete that request. Please try again.");
    if (!data || typeof data !== "object") throw new ApiError(502, "Bookwise did not receive a valid server response. Please try again.");
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, controller.signal.aborted ? "The server took too long to respond. Please try again." : "Could not reach Bookwise. Check your connection and try again.");
  } finally { clearTimeout(timer); options.signal?.removeEventListener("abort", abort); }
}

export interface CsvImportResult {
  imported: number;
  updated: number;
  skipped: number;
  skippedReasons?: {
    missingFields: number;
    duplicates: number;
  };
  totalRows: number;
  fileName: string | null;
  importedBooks?: Book[];
  message: string;
}

export function uploadCsvFile(file: File, duplicateMode: "skip" | "update" = "skip", onProgress?: (percent: number) => void): Promise<CsvImportResult> {
  // Do not set Content-Type: the browser supplies the correct multipart boundary.
  const form = new FormData();
  form.append("file", file, file.name); form.append("duplicateMode", duplicateMode);
  const token = getStoredToken();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/books/import");
    xhr.timeout = 120000;
    xhr.withCredentials = true;
    xhr.responseType = "json";
    for (const [key, value] of Object.entries(sessionHeaders(token))) xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100)); };
    xhr.upload.onload = () => onProgress?.(100);
    xhr.onload = () => {
      const data = xhr.response;
      if (xhr.status < 200 || xhr.status >= 300) {
        const fallback = xhr.status === 413 ? "The file is too large. Split it into smaller CSV files and try again." : "The import was not confirmed by the server. Your file is still selected.";
        reject(new ApiError(xhr.status, data?.error || fallback));
      } else if (typeof data?.imported !== "number" || typeof data?.updated !== "number" || typeof data?.skipped !== "number") {
        reject(new ApiError(502, "The import receipt could not be read. Check the catalogue before retrying."));
      } else resolve(data as CsvImportResult);
    };
    xhr.onerror = () => reject(new ApiError(0, "The connection was interrupted. Your file is still selected. Check the catalogue before retrying."));
    xhr.ontimeout = () => reject(new ApiError(408, "No import confirmation arrived in time. Check the catalogue before retrying; duplicate rows are skipped by default."));
    xhr.onabort = () => reject(new ApiError(0, "The transfer was cancelled. Your file is still selected."));
    xhr.send(form);
  });
}

export function formatInr(value: number): string {
  return "₹" + Math.round(value || 0).toLocaleString("en-IN");
}

export function renderStars(rating: number): string {
  const full = Math.min(5, Math.max(0, Math.round(rating || 0)));
  return "★".repeat(full) + "☆".repeat(5 - full);
}

// Curated heritage dark-green cloth-bound palettes with crisp off-white foil
const GENRE_PALETTES: Record<string, { bg: string; accent: string; spine: string }> = {
  fantasy: { bg: "#123524", accent: "#F8F7F2", spine: "#0B2418" },
  "literary fiction": { bg: "#18422E", accent: "#F8F7F2", spine: "#102E20" },
  "self help": { bg: "#1E4D36", accent: "#F8F7F2", spine: "#143726" },
  "science fiction": { bg: "#0F2E20", accent: "#F8F7F2", spine: "#091F15" },
  mystery: { bg: "#153A28", accent: "#F8F7F2", spine: "#0D271B" },
  history: { bg: "#1B4732", accent: "#F8F7F2", spine: "#123223" },
  psychology: { bg: "#21533B", accent: "#F8F7F2", spine: "#173C2A" },
  biography: { bg: "#143826", accent: "#F8F7F2", spine: "#0C2519" },
};

const FALLBACK_PALETTES = [
  { bg: "#123524", accent: "#F8F7F2", spine: "#0B2418" },
  { bg: "#19442F", accent: "#F8F7F2", spine: "#113021" },
  { bg: "#1E4F38", accent: "#F8F7F2", spine: "#143827" },
  { bg: "#0F2D1F", accent: "#F8F7F2", spine: "#091E14" },
  { bg: "#23573E", accent: "#F8F7F2", spine: "#183E2C" },
];

export function getGenrePalette(genre: string) {
  const key = String(genre || "").trim().toLowerCase();
  if (GENRE_PALETTES[key]) return GENRE_PALETTES[key];
  const hash = [...key].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return FALLBACK_PALETTES[hash % FALLBACK_PALETTES.length];
}

export function getBookBadge(
  book: Book
): { label: string; variant: "new" | "best" | "top" } | null {
  const year = book.year || 0;
  if (year >= 2021) return { label: "NEW", variant: "new" };
  if (book.rating >= 4.8) return { label: "BEST SELLER", variant: "best" };
  if (book.rating >= 4.7) return { label: "TOP RATED", variant: "top" };
  return null;
}
