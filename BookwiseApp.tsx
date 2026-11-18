"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Heart,
  LogOut,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { BookCover } from "./BookCover";
import { BookCard } from "./BookCard";
import { BookDetailModal } from "./BookDetailModal";
import { AuthModal } from "./AuthModal";
import { InsightsView } from "./InsightsView";
import { AdminView } from "./AdminView";
import { AdminPageGate } from "./AdminPageGate";
import { useCatalogueUpload } from "./useCatalogueUpload";
import {
  apiRequest,
  ApiError,
  type AdminTab,
  type AuthResult,
  type SessionProfile,
  formatInr,
  getGenrePalette,
  getStoredToken,
  setStoredToken,
  type Book,
  type HomeData,
  type InsightsData,
  type PageKey,
  type RecommendationsData,
  type User,
} from "./types";

interface BookwiseAppProps {
  initialHome: HomeData;
  initialPage?: PageKey;
  initialUser?: User | null;
  initialAdminTab?: AdminTab;
}

const SEMANTIC_EXAMPLES = [
  "boy wizard magic school",
  "building good daily habits",
  "spacecraft save our sun",
  "monsoon family letters",
  "wealth greed patience",
];

function BookShelf({
  title,
  subtitle,
  books,
  wishlistIds,
  onOpenBook,
  onViewAll,
}: {
  title: string;
  subtitle?: string;
  books: Book[];
  wishlistIds: Set<string>;
  onOpenBook: (id: string) => void;
  onViewAll: () => void;
}) {
  if (!books.length) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4 border-b border-[#DCE2DA] pb-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-[#D9381E]" aria-hidden="true" />
            <h2 className="font-serif text-2xl sm:text-[26px] font-semibold text-[#123524]">
              {title}
            </h2>
          </div>
          {subtitle && (
            <p className="mt-0.5 text-xs text-[#4A5D52]">{subtitle}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="group inline-flex shrink-0 items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[#123524] transition-colors hover:text-[#D9381E]"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5 text-[#D9381E] transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      <div className="shelf-scroll -mx-1 flex gap-5 overflow-x-auto px-1 pb-3">
        {books.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            compact
            wishlisted={wishlistIds.has(book.id)}
            onOpen={onOpenBook}
          />
        ))}
      </div>
    </section>
  );
}

export function BookwiseApp({
  initialHome,
  initialPage = "home",
  initialUser = null,
  initialAdminTab = "csv",
}: BookwiseAppProps) {
  const [page, setPage] = useState<PageKey>(initialPage);
  const [homeData, setHomeData] = useState<HomeData>(initialHome);
  const [allBooks, setAllBooks] = useState<Book[]>(initialHome.books);

  // Auth & Wishlist
  const [currentUser, setCurrentUser] = useState<User | null>(initialUser);
  const [adminTab, setAdminTab] = useState<AdminTab>(initialAdminTab);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [authOpen, setAuthOpen] = useState(false);
  const [authPrompt, setAuthPrompt] = useState("");
  const [authIntent, setAuthIntent] = useState<"default" | "admin">("default");
  // A sign-in or sign-out supersedes any startup check still in flight.
  const loginVersion = useRef(0);
  const [sessionError, setSessionError] = useState("");

  // Book Detail Modal
  const [activeBookId, setActiveBookId] = useState<string | null>(null);

  // Browse filters
  const [query, setQuery] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [genreFilter, setGenreFilter] = useState("All genres");
  const [minRating, setMinRating] = useState("0");
  const [sortBy, setSortBy] = useState("rel");
  const [browseResults, setBrowseResults] = useState<Book[]>(initialHome.books);
  const [browseLoading, setBrowseLoading] = useState(false);

  // Recommendations & Insights
  const [recsData, setRecsData] = useState<RecommendationsData | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const [insightsData, setInsightsData] = useState<InsightsData | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // Newsletter
  const [email, setEmail] = useState("");
  const [subMessage, setSubMessage] = useState<{
    text: string;
    ok: boolean;
  } | null>(null);
  const [subscribing, setSubscribing] = useState(false);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore the saved login once on page load; never re-check on focus or a timer.
  // The server still validates the session on every protected action.
  const refreshSession = useCallback(async () => {
    const version = loginVersion.current;
    try {
      const profile = await apiRequest<SessionProfile>("/me");
      if (version !== loginVersion.current) return;
      setCurrentUser(profile.user);
      setWishlistIds(new Set(profile.wishlistIds));
      setSessionError("");
    } catch (error) {
      if (version !== loginVersion.current) return;
      if (error instanceof ApiError && error.status === 401) {
        setStoredToken("");
        setCurrentUser(null);
        setWishlistIds(new Set());
        setSessionError("");
      } else {
        // A temporary network problem is not a reason to log someone out.
        setSessionError("Could not check your login. Try again if you need Admin tools.");
      }
    }
  }, []);

  useEffect(() => {
    if (initialUser) return; // /admin already verified the session on the server.
    let active = true;
    queueMicrotask(() => {
      if (active) void refreshSession();
    });
    return () => { active = false; };
  }, [initialUser, refreshSession]);

  useEffect(() => {
    const onPopState = () => {
      const url = new URL(window.location.href);
      const requested = url.searchParams.get("view");
      if (url.pathname === "/upload" || requested === "upload") {
        window.history.replaceState(null, "", "/admin");
        setPage("adm");
      } else if (url.pathname === "/admin") {
        const tool = url.searchParams.get("tool");
        setAdminTab(tool === "files" || tool === "catalogue" || tool === "editor" || tool === "roles" ? tool : "csv");
        setPage("adm");
      }
      else if (requested === "browse" || requested === "ins" || requested === "recs") setPage(requested);
      else setPage("home");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const loadHome = useCallback(async () => {
    try {
      const data = await apiRequest<HomeData>("/home");
      setHomeData(data);
      setAllBooks(data.books);
    } catch {
      // retain existing state on transient errors
    }
  }, []);

  const runSearch = useCallback(
    async (overrides?: {
      q?: string;
      author?: string;
      genre?: string;
      minRating?: string;
      sort?: string;
    }) => {
      setBrowseLoading(true);
      try {
        const params = new URLSearchParams({
          q: (overrides?.q ?? query).trim(),
          author: (overrides?.author ?? authorFilter).trim(),
          genre: overrides?.genre ?? genreFilter,
          minRating: overrides?.minRating ?? minRating,
          sort: overrides?.sort ?? sortBy,
        });
        const data = await apiRequest<{ books: Book[] }>(`/books?${params}`);
        setBrowseResults(data.books);
      } catch {
        setBrowseResults([]);
      } finally {
        setBrowseLoading(false);
      }
    },
    [query, authorFilter, genreFilter, minRating, sortBy]
  );

  const loadAllBooks = useCallback(async () => {
    try {
      const data = await apiRequest<{ books: Book[] }>("/books");
      setAllBooks(data.books);
      return data.books;
    } catch {
      return [];
    }
  }, []);

  const loadRecommendations = useCallback(async () => {
    setRecsLoading(true);
    try {
      const data = await apiRequest<RecommendationsData>("/recommendations");
      setRecsData(data);
      setWishlistIds(new Set(data.wishlist.map((b) => b.id)));
    } catch {
      setRecsData(null);
    } finally {
      setRecsLoading(false);
    }
  }, []);

  const loadInsights = useCallback(async () => {
    setInsightsLoading(true);
    try {
      const data = await apiRequest<InsightsData>("/insights");
      setInsightsData(data);
    } catch {
      setInsightsData(null);
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  // Debounced live search when on browse page
  useEffect(() => {
    if (page !== "browse") return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      runSearch();
    }, 220);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [page, query, authorFilter, genreFilter, minRating, sortBy, runSearch]);

  const navigate = useCallback(
    async (
      target: PageKey,
      opts?: { sort?: string; genre?: string; q?: string }
    ) => {
      setPage(target);
      if (typeof window !== "undefined") {
        const nextUrl = target === "adm" ? "/admin" : target === "home" ? "/" : `/?view=${target}`;
        if (window.location.pathname + window.location.search !== nextUrl) {
          window.history.pushState(null, "", nextUrl);
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      if (target === "home") {
        await loadHome();
      } else if (target === "browse") {
        const nextSort = opts?.sort ?? sortBy;
        const nextGenre = opts?.genre ?? genreFilter;
        const nextQuery = opts?.q ?? query;
        if (opts?.sort !== undefined) setSortBy(nextSort);
        if (opts?.genre !== undefined) setGenreFilter(nextGenre);
        if (opts?.q !== undefined) setQuery(nextQuery);
        await loadAllBooks();
        await runSearch({ sort: nextSort, genre: nextGenre, q: nextQuery });
      } else if (target === "adm") {
        setAdminTab("csv");
        await loadAllBooks();
      }
    },
    [sortBy, genreFilter, query, loadHome, loadAllBooks, runSearch]
  );

  const chooseAdminTool = (tool: AdminTab) => {
    setAdminTab(tool);
    if (window.location.pathname === "/admin") window.history.replaceState(null, "", tool === "csv" ? "/admin" : `/admin?tool=${tool}`);
  };

  const handleAuthenticated = async (result: AuthResult) => {
    // /api/login (or /api/register) has already checked the credentials and
    // created a database-backed session. No second sign-in request is needed.
    if (!result?.token || !result.user?.id) {
      throw new Error("Sign-in was not completed. Please try again.");
    }
    if ((page === "adm" || authIntent === "admin") && !result.user.isAdmin) {
      throw new Error("This account is a reader. Sign in with an administrator account.");
    }
    loginVersion.current++;
    setStoredToken(result.token);
    setCurrentUser(result.user);
    setSessionError("");
    setAuthPrompt("");
    setAuthIntent("default");
    csvUpload.setError("");
    if (page !== "adm" && result.user.isAdmin && !activeBookId) {
      void navigate("adm");
    } else if (page === "adm") {
      void loadAllBooks();
    } else if (page === "recs") {
      void loadRecommendations();
    } else {
      void loadHome();
    }
  };

  const handleLogout = async () => {
    loginVersion.current++;
    try {
      await apiRequest("/logout", { method: "POST" });
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) {
        setSessionError("Sign-out could not be completed. Please try again.");
        return;
      }
    }
    setStoredToken("");
    setCurrentUser(null);
    setSessionError("");
    csvUpload.reset();
    setWishlistIds(new Set());
    setRecsData(null);
    void loadHome();
  };

  const handleWishlistChange = useCallback(
    (bookId: string, wishlisted: boolean) => {
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (wishlisted) next.add(bookId);
        else next.delete(bookId);
        return next;
      });
    },
    []
  );

  const handleActivityRecorded = useCallback(() => {
    if (page === "home") {
      loadHome();
    } else if (page === "recs" && currentUser) {
      loadRecommendations();
    } else if (page === "ins") {
      loadInsights();
    }
  }, [page, currentUser, loadHome, loadRecommendations, loadInsights]);

  const handleCatalogueChanged = useCallback(async () => {
    await loadHome();
  }, [loadHome]);

  const askAdmin = (status?: number) => {
    if (status === 401 || status === 403) {
      loginVersion.current++;
      if (status === 401) {
        setStoredToken("");
        setCurrentUser(null);
        setWishlistIds(new Set());
      } else {
        setCurrentUser(prev => prev ? { ...prev, isAdmin: false } : null);
      }
    }
    setAuthIntent("admin");
    setAuthPrompt(status === 401
      ? "Sign in again to finish your import. Your selected CSV is still here."
      : status === 403
        ? "Sign in with an admin account to finish your import."
        : "Sign in as an administrator to continue.");
    setAuthOpen(true);
  };
  const csvUpload = useCatalogueUpload(allBooks, handleCatalogueChanged, askAdmin);
  // Also restore data on direct links and browser Back/Forward.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (page === "ins") void loadInsights();
      if (page === "recs" && currentUser) void loadRecommendations();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [page, currentUser, loadInsights, loadRecommendations]);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubMessage(null);
    const trimmed = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setSubMessage({ text: "Please enter a valid email address.", ok: false });
      return;
    }
    setSubscribing(true);
    try {
      const res = await apiRequest<{ ok: boolean; message: string }>(
        "/subscribe",
        {
          method: "POST",
          body: JSON.stringify({ email: trimmed }),
        }
      );
      setSubMessage({ text: res.message, ok: true });
      setEmail("");
    } catch (err) {
      setSubMessage({
        text: err instanceof Error ? err.message : "Could not subscribe.",
        ok: false,
      });
    } finally {
      setSubscribing(false);
    }
  };

  const allGenres = [
    ...new Set(allBooks.map((b) => b.genre).filter(Boolean)),
  ].sort();

  const hasActiveFilters =
    Boolean(query.trim()) ||
    Boolean(authorFilter.trim()) ||
    genreFilter !== "All genres" ||
    minRating !== "0" ||
    sortBy !== "rel";

  const resetFilters = () => {
    setQuery("");
    setAuthorFilter("");
    setGenreFilter("All genres");
    setMinRating("0");
    setSortBy("rel");
  };

  const navItems: { key: PageKey; label: string }[] = [
    { key: "home", label: "Discover" },
    { key: "browse", label: "Browse" },
    { key: "recs", label: "For You" },
    { key: "ins", label: "Insights" },
    { key: "adm", label: "Admin" },
  ];

  const featuredBook = homeData.newReleases[0] || homeData.bestsellers[0];
  const spineBooks = homeData.trending
    .filter((b) => b.id !== featuredBook?.id)
    .slice(0, 3);

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F7F2] text-[#10231A]">
      {/* Sticky Off-White & Dark Green Bookshop Header */}
      <header className="sticky top-0 z-40 border-b border-[#DBDFD3] bg-[#FCFBF6]/97 backdrop-blur-md">
        <div className="mx-auto flex h-[70px] max-w-7xl items-center justify-between gap-2 sm:gap-4 px-4 sm:px-6 lg:px-8">
          {/* Brand Wordmark with subtle tomato-red bookmark detail */}
          <button
            type="button"
            onClick={() => navigate("home")}
            className="flex shrink-0 items-center gap-1.5 sm:gap-2.5 text-left group"
          >
            <svg aria-hidden="true" className="w-7 sm:w-[34px]" viewBox="0 0 38 34" width="34" height="31" fill="none">
              <path d="M3 6c6-1 11 1 15 4v21c-5-3-10-4-16-4L3 6Z" fill="#244B36"/>
              <path d="M20 10c4-4 9-6 15-7l1 23c-6 0-12 2-16 5V10Z" fill="#244B36"/>
              <path d="M6 3c5 0 9 2 12 5M22 7c3-3 6-4 10-5" stroke="#244B36" strokeWidth="1.6" strokeLinecap="round"/>
              <path d="m27 6 4-2 .3 10-2.2-1-1.9 2.8Z" fill="#DD7050"/>
              <path d="M6 12c3 0 6 1 9 3m-9 2c3 0 6 1 9 3" stroke="#B7C7AE" strokeWidth="1.15"/>
            </svg>
            <span className="font-serif text-[23px] sm:text-[27px] font-semibold tracking-[-.06em] text-[#123524]">
              Bookwise<span className="text-[#D9381E]">.</span>
            </span>
          </button>

          {/* Primary Navigation (Desktop) */}
          <nav
            id="links"
            aria-label="Primary navigation"
            className="hidden lg:flex items-center gap-0.5"
          >
            {navItems.map((item) => {
              const active = page === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  data-page={item.key}
                  onClick={() => navigate(item.key)}
                  className={`relative inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm whitespace-nowrap transition-colors ${
                    active
                      ? "bg-[#123524]/8 text-[#123524] font-semibold"
                      : "text-[#4A5D52] font-medium hover:bg-[#F0EFE7] hover:text-[#123524]"
                  }`}
                >
                  {item.label}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-1 left-1/2 h-[2px] w-5 -translate-x-1/2 rounded-full bg-[#D9381E]"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Auth Controls */}
          <div id="auth" className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            {currentUser ? (
              <>
                <span className="hidden xl:inline-flex max-w-[128px] items-center gap-1.5 text-xs text-[#4A5D52] whitespace-nowrap overflow-hidden">
                  Hi,{" "}
                  <strong className="font-semibold text-[#123524]">
                    {currentUser.username}
                  </strong>
                  {currentUser.isAdmin && (
                    <span className="inline-flex items-center gap-1 rounded bg-[#123524] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#F8F7F2]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#D9381E]" />
                      Admin
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="Log out" title="Log out"
                  className="inline-flex h-9 w-9 sm:h-auto sm:w-auto shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#DCE2DA] bg-[#FDFDF9] px-2 sm:px-3 py-1.5 text-xs font-semibold text-[#123524] whitespace-nowrap transition-colors hover:border-[#D9381E]/50 hover:text-[#D9381E]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Log out</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthIntent(page === "adm" ? "admin" : "default");
                  setAuthPrompt("");
                  setAuthOpen(true);
                }}
                aria-label="Log in or register"
                className="inline-flex items-center gap-2 rounded-[6px] bg-[#193F2E] px-3.5 py-2 text-xs font-semibold text-[#F8F7F2] whitespace-nowrap transition-colors hover:bg-[#0B2418]"
              >
                <UserRound size={14} /><span className="hidden sm:inline">Log in</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Strip */}
        <nav
          aria-label="Mobile navigation"
          className="flex lg:hidden items-center justify-center gap-1 overflow-x-auto border-t border-[#DCE2DA]/80 px-2 py-1.5"
        >
          {navItems.map((item) => {
            const active = page === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(item.key)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                  active
                    ? "bg-[#123524] text-[#F8F7F2]"
                    : "text-[#4A5D52] hover:bg-[#F0EFE7] hover:text-[#123524]"
                }`}
              >
                {active && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#D9381E]" />
                )}
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8 py-5 sm:py-7">
        {sessionError && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E0CBBE] bg-[#FBF3EA] px-4 py-3 text-sm text-[#694C3C]">
          {sessionError} <button type="button" className="font-semibold underline" onClick={() => void refreshSession()}>Check session again</button>
        </div>}
        {/* ==================== HOME PAGE ==================== */}
        {page === "home" && (
          <div id="home" className="space-y-14">
            {/* Editorial Off-White & Dark Green Hero with Tomato Red Detailing */}
            <section className="relative overflow-hidden rounded-3xl border border-[#123524]/15 bg-gradient-to-br from-[#FDFDF9] via-[#F8F7F2] to-[#EEF1EC] px-6 py-10 sm:px-12 sm:py-14 shadow-[0_12px_40px_-24px_rgba(18,53,36,0.28)]">
              {/* Small decorative tomato-red silk bookmark ribbon at top right */}
              <div
                aria-hidden="true"
                className="hidden sm:block absolute right-10 top-0 h-9 w-3.5 bg-[#D9381E] shadow-xs"
                style={{
                  clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 76%, 0 100%)",
                }}
              />

              <div className="grid items-center gap-10 lg:grid-cols-12">
                {/* Left Editorial Copy */}
                <div className="lg:col-span-7 space-y-5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#123524]/18 bg-[#FDFDF9] px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#123524]">
                    <span className="h-2 w-2 rounded-full bg-[#D9381E]" />
                    Trending books · New in the market
                  </div>

                  <h1 className="font-serif text-4xl sm:text-5xl lg:text-[58px] font-semibold leading-[1.08] tracking-tight text-[#123524]">
                    Discover Your
                    <br />
                    Next{" "}
                    <em className="font-serif italic font-medium text-[#D9381E]">
                      Great Read
                    </em>
                  </h1>

                  <p className="max-w-lg text-[15.5px] leading-relaxed text-[#3E5247]">
                    Explore bestsellers and brand-new releases, compare honest
                    reader ratings in ₹, and let smart TF-IDF search uncover
                    books by meaning—not just keywords.
                  </p>

                  <div className="flex flex-wrap items-center gap-3.5 pt-2">
                    <button
                      type="button"
                      onClick={() => navigate("browse", { sort: "rel", genre: "All genres" })}
                      className="group inline-flex items-center gap-2 rounded-xl bg-[#123524] px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[#F8F7F2] shadow-sm transition-all hover:bg-[#0B2418] hover:-translate-y-0.5"
                    >
                      Browse Books
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("browse", { sort: "new", genre: "All genres" })}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#123524]/30 bg-[#FDFDF9] px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[#123524] transition-all hover:border-[#D9381E] hover:text-[#D9381E]"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-[#D9381E]" />
                      New Releases
                    </button>
                  </div>
                </div>

                {/* Right Tactile Dark-Green Bookshop Display Stage */}
                <div className="lg:col-span-5 flex flex-col items-center">
                  <div className="flex items-end justify-center gap-4 sm:gap-5">
                    {featuredBook && (
                      <button
                        type="button"
                        onClick={() => setActiveBookId(featuredBook.id)}
                        className="group relative w-[165px] sm:w-[192px] text-left transition-transform duration-300 hover:-translate-y-1.5 focus:outline-none"
                      >
                        <div className="rounded-[7px] shadow-[0_22px_38px_-14px_rgba(11,36,24,0.45)]">
                          <BookCover
                            book={featuredBook}
                            featuredBadgeText="NEW RELEASE"
                            size="lg"
                          />
                        </div>
                      </button>
                    )}

                    {/* Vertical Dark-Green Clothbound Spines with Tomato Red Bands */}
                    {spineBooks.length > 0 && (
                      <div className="flex items-end gap-2">
                        {spineBooks.map((book, idx) => {
                          const pal = getGenrePalette(book.genre);
                          const heights = [
                            "h-[222px] sm:h-[258px]",
                            "h-[205px] sm:h-[238px]",
                            "h-[234px] sm:h-[270px]",
                          ];
                          return (
                            <button
                              key={book.id}
                              type="button"
                              onClick={() => setActiveBookId(book.id)}
                              title={`${book.title} — ${book.author}`}
                              style={{ backgroundColor: pal.bg }}
                              className={`${heights[idx % 3]} w-10 sm:w-11 rounded-t-[5px] rounded-b-[2px] border border-[#0B2418]/40 shadow-md flex flex-col items-center justify-between py-3 px-1 transition-transform duration-200 hover:-translate-y-2`}
                            >
                              <span
                                className={`h-[2px] w-6 rounded-full ${
                                  idx === 0 ? "bg-[#D9381E]" : "bg-[#F8F7F2]/45"
                                }`}
                              />
                              <span
                                className="font-serif text-[11px] font-medium tracking-wide whitespace-nowrap overflow-hidden text-ellipsis max-h-[165px] text-[#F8F7F2]"
                                style={{ writingMode: "vertical-rl" }}
                              >
                                {book.title.slice(0, 24)}
                              </span>
                              <span className="h-[2px] w-6 rounded-full bg-[#F8F7F2]/40" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Dark Green Library Ledge with fine Tomato Red inlay */}
                  <div className="relative h-2.5 w-full max-w-[350px] overflow-hidden rounded-full bg-[#123524] shadow-sm">
                    <span className="absolute right-6 top-0 h-full w-8 bg-[#D9381E]" />
                  </div>
                  {featuredBook && (
                    <button
                      type="button"
                      onClick={() => setActiveBookId(featuredBook.id)}
                      className="mt-3 text-center group"
                    >
                      <p className="font-serif text-sm font-semibold text-[#123524] group-hover:text-[#D9381E] transition-colors">
                        {featuredBook.title}
                      </p>
                      <p className="text-xs text-[#4A5D52]">
                        {featuredBook.author} ·{" "}
                        <span className="text-[#D9381E]">★</span>{" "}
                        {featuredBook.rating.toFixed(1)} ·{" "}
                        <span className="font-semibold text-[#123524]">
                          {formatInr(featuredBook.price)}
                        </span>
                      </p>
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Browse by Category */}
            {homeData.categories.length > 0 && (
              <section className="space-y-5">
                <div className="flex items-center justify-center gap-3">
                  <span className="h-px w-10 bg-[#DCE2DA]" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#123524]">
                    Browse by category
                  </p>
                  <span className="h-px w-10 bg-[#DCE2DA]" />
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  {homeData.categories.map((genre) => (
                    <button
                      key={genre}
                      type="button"
                      onClick={() =>
                        navigate("browse", { genre, sort: "rel", q: "" })
                      }
                      className="group inline-flex items-center gap-2.5 rounded-full border border-[#DCE2DA] bg-[#FDFDF9] py-1.5 pl-1.5 pr-4 text-sm font-medium text-[#123524] shadow-2xs transition-all hover:-translate-y-0.5 hover:border-[#123524] hover:shadow-sm"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#123524] font-serif text-xs font-bold tracking-wider text-[#F8F7F2] transition-colors group-hover:bg-[#D9381E]">
                        {genre.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="font-medium text-[#123524]">
                        {genre}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Curated Horizontal Shelves */}
            <BookShelf
              title="Bestsellers"
              subtitle="Highest-rated classics and contemporary favourites"
              books={homeData.bestsellers}
              wishlistIds={wishlistIds}
              onOpenBook={setActiveBookId}
              onViewAll={() =>
                navigate("browse", { sort: "rating", genre: "All genres", q: "" })
              }
            />

            <BookShelf
              title="New Releases"
              subtitle="Fresh editions recently added to our shelves"
              books={homeData.newReleases}
              wishlistIds={wishlistIds}
              onOpenBook={setActiveBookId}
              onViewAll={() =>
                navigate("browse", { sort: "new", genre: "All genres", q: "" })
              }
            />

            <BookShelf
              title="Trending Now"
              subtitle="Ranked live by reader views and star acclaim"
              books={homeData.trending}
              wishlistIds={wishlistIds}
              onOpenBook={setActiveBookId}
              onViewAll={() =>
                navigate("browse", { sort: "rating", genre: "All genres", q: "" })
              }
            />

            {/* 4-Pillar Off-White & Dark Green Value Band */}
            <section className="grid gap-6 rounded-2xl border border-[#DCE2DA] bg-[#F0EFE7] p-6 sm:p-8 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: BookOpen,
                  title: "Wide Selection",
                  desc: "Bestsellers and new releases curated across every genre",
                },
                {
                  icon: Star,
                  title: "Honest Ratings",
                  desc: "Verified reader star scores and written feedback on every book",
                },
                {
                  icon: Search,
                  title: "Smart Search",
                  desc: "TF-IDF cosine similarity finds books by meaning and theme",
                },
                {
                  icon: TrendingUp,
                  title: "Trend Insights",
                  desc: "Explore top genres, authors, ratings, and ₹ price benchmarks",
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3.5">
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DCE2DA] bg-[#FDFDF9] text-[#123524]">
                    <Icon className="h-5 w-5" />
                    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#D9381E]" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-[#123524]">
                      {title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-[#4A5D52]">
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </section>

            {/* Deep Dark-Green Newsletter Banner with Tomato Red CTA Detail */}
            <section className="relative overflow-hidden rounded-3xl bg-[#123524] px-6 py-8 sm:px-10 sm:py-10 text-[#F8F7F2] shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#F8F7F2]/85">
                    <span className="h-2 w-2 rounded-full bg-[#D9381E]" />
                    Stay in the loop
                  </div>
                  <h2 className="mt-1.5 font-serif text-2xl sm:text-3xl font-semibold text-[#F8F7F2]">
                    Get new releases in your inbox
                  </h2>
                  <p className="mt-1 text-sm text-[#F8F7F2]/72">
                    Weekly notes on noteworthy editions, reader picks, and Indian
                    print releases.
                  </p>
                </div>

                <form
                  onSubmit={handleSubscribe}
                  className="w-full max-w-md space-y-2"
                >
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      id="em"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email address"
                      className="flex-1 rounded-xl border border-[#F8F7F2]/25 bg-[#F8F7F2]/10 px-4 py-3 text-sm text-[#F8F7F2] placeholder:text-[#F8F7F2]/60 focus:border-[#F8F7F2] focus:bg-[#F8F7F2]/15 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={subscribing}
                      className="rounded-xl bg-[#D9381E] px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[#F8F7F2] shadow-xs transition-colors hover:bg-[#BD2E16] disabled:opacity-60 whitespace-nowrap"
                    >
                      {subscribing ? "Saving..." : "Subscribe"}
                    </button>
                  </div>
                  {subMessage && (
                    <p
                      id="sm"
                      className={`text-xs font-medium ${
                        subMessage.ok ? "text-[#F8F7F2]" : "text-[#FF9B8A]"
                      }`}
                    >
                      {subMessage.text}
                    </p>
                  )}
                </form>
              </div>
            </section>

            {/* Latest Arrivals */}
            {homeData.newReleases.length > 0 && (
              <section className="space-y-5">
                <div className="flex items-end justify-between gap-4 border-b border-[#DCE2DA] pb-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="h-2 w-2 rounded-full bg-[#D9381E]" aria-hidden="true" />
                      <h2 className="font-serif text-2xl sm:text-[26px] font-semibold text-[#123524]">
                        Latest Arrivals
                      </h2>
                    </div>
                    <p className="mt-0.5 text-xs text-[#4A5D52]">
                      Six freshly catalogued picks from the front table
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      navigate("browse", { sort: "new", genre: "All genres", q: "" })
                    }
                    className="group inline-flex shrink-0 items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[#123524] transition-colors hover:text-[#D9381E]"
                  >
                    View all
                    <ArrowRight className="h-3.5 w-3.5 text-[#D9381E] transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
                  {homeData.newReleases.slice(0, 6).map((book) => (
                    <BookCard
                      key={book.id}
                      book={book}
                      wishlisted={wishlistIds.has(book.id)}
                      onOpen={setActiveBookId}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ==================== BROWSE PAGE ==================== */}
        {page === "browse" && (
          <div id="browse" className="space-y-7">
            <div>
              <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#123524]">
                <span className="h-2 w-2 rounded-full bg-[#D9381E]" />
                TF-IDF Semantic Catalogue
              </div>
              <h1 className="mt-1.5 font-serif text-3xl sm:text-4xl font-semibold text-[#123524]">
                Browse & Search Books
              </h1>
              <p className="mt-1.5 text-sm text-[#4A5D52]">
                Describe a plot, topic, theme, title, or author—our cosine
                similarity engine ranks matching books instantly.
              </p>
            </div>

            {/* Search + Filter Panel */}
            <div className="rounded-2xl border border-[#DCE2DA] bg-[#FDFDF9] p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78897F]" />
                  <input
                    id="q"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") runSearch();
                    }}
                    placeholder="Search by meaning, topic, or title (e.g. 'boy wizard magic school', 'daily habits')..."
                    className="w-full rounded-xl border border-[#DCE2DA] bg-[#F8F7F2] py-2.5 pl-10 pr-4 text-sm text-[#10231A] placeholder:text-[#78897F] focus:border-[#123524] focus:bg-[#FDFDF9] focus:outline-none"
                  />
                </div>
                <button
                  id="go"
                  type="button"
                  onClick={() => runSearch()}
                  className="rounded-xl bg-[#123524] px-6 py-2.5 text-sm font-semibold text-[#F8F7F2] transition-colors hover:bg-[#0B2418] shrink-0"
                >
                  Search
                </button>
              </div>

              {/* Try semantic search pills */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[#4A5D52] font-medium mr-1">
                  Try meaning search:
                </span>
                {SEMANTIC_EXAMPLES.map((example) => {
                  const isActive = query === example;
                  return (
                    <button
                      key={example}
                      type="button"
                      onClick={() => {
                        setQuery(example);
                        setSortBy("rel");
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors ${
                        isActive
                          ? "border-[#123524] bg-[#123524] text-[#F8F7F2]"
                          : "border-[#DCE2DA] bg-[#F8F7F2] text-[#123524] hover:border-[#123524]"
                      }`}
                    >
                      {isActive && (
                        <span className="h-1.5 w-1.5 rounded-full bg-[#D9381E]" />
                      )}
                      “{example}”
                    </button>
                  );
                })}
              </div>

              {/* Filter selects */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-1">
                <div>
                  <label
                    htmlFor="au"
                    className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4A5D52] mb-1"
                  >
                    Author
                  </label>
                  <input
                    id="au"
                    type="text"
                    value={authorFilter}
                    onChange={(e) => setAuthorFilter(e.target.value)}
                    placeholder="Filter by author..."
                    className="w-full rounded-lg border border-[#DCE2DA] bg-[#F8F7F2] px-3 py-2 text-sm text-[#10231A] placeholder:text-[#78897F] focus:border-[#123524] focus:bg-[#FDFDF9] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="ge"
                    className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4A5D52] mb-1"
                  >
                    Genre
                  </label>
                  <select
                    id="ge"
                    value={genreFilter}
                    onChange={(e) => setGenreFilter(e.target.value)}
                    className="w-full rounded-lg border border-[#DCE2DA] bg-[#F8F7F2] px-3 py-2 text-sm text-[#10231A] focus:border-[#123524] focus:bg-[#FDFDF9] focus:outline-none"
                  >
                    <option value="All genres">All genres</option>
                    {allGenres.map((genre) => (
                      <option key={genre} value={genre}>
                        {genre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="mr"
                    className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4A5D52] mb-1"
                  >
                    Minimum Rating
                  </label>
                  <select
                    id="mr"
                    value={minRating}
                    onChange={(e) => setMinRating(e.target.value)}
                    className="w-full rounded-lg border border-[#DCE2DA] bg-[#F8F7F2] px-3 py-2 text-sm text-[#10231A] focus:border-[#123524] focus:bg-[#FDFDF9] focus:outline-none"
                  >
                    <option value="0">Any rating</option>
                    <option value="4">4.0 ★ and above</option>
                    <option value="4.5">4.5 ★ and above</option>
                    <option value="4.7">4.7 ★ and above</option>
                    <option value="4.8">4.8 ★ and above</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="so"
                    className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4A5D52] mb-1"
                  >
                    Sort By
                  </label>
                  <select
                    id="so"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full rounded-lg border border-[#DCE2DA] bg-[#F8F7F2] px-3 py-2 text-sm text-[#10231A] focus:border-[#123524] focus:bg-[#FDFDF9] focus:outline-none"
                  >
                    <option value="rel">Relevance (Smart TF-IDF)</option>
                    <option value="rating">Highest Rated</option>
                    <option value="new">Newest Releases</option>
                    <option value="price">Price: Low to High (₹)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[#E8EDE6] pt-3 text-xs text-[#4A5D52]">
                <span className="inline-flex items-center gap-1.5 font-medium text-[#123524]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#D9381E]" />
                  {browseLoading
                    ? "Searching catalogue..."
                    : `Showing ${browseResults.length} ${
                        browseResults.length === 1 ? "book" : "books"
                      }`}
                </span>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1 font-semibold text-[#D9381E] hover:underline"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset filters
                  </button>
                )}
              </div>
            </div>

            {/* Search Results Grid */}
            <div id="res">
              {browseResults.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {browseResults.map((book) => (
                    <BookCard
                      key={book.id}
                      book={book}
                      wishlisted={wishlistIds.has(book.id)}
                      onOpen={setActiveBookId}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#C2CCC0] bg-[#FDFDF9] px-6 py-16 text-center">
                  <p className="font-serif text-xl font-semibold text-[#123524]">
                    No Results Found
                  </p>
                  <p className="mt-1.5 text-sm text-[#4A5D52]">
                    Try broadening your keywords or clearing an active filter.
                  </p>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="mt-4 rounded-lg bg-[#123524] px-4 py-2 text-xs font-semibold text-[#F8F7F2] hover:bg-[#0B2418]"
                    >
                      Show all books
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== FOR YOU (RECOMMENDATIONS) PAGE ==================== */}
        {page === "recs" && (
          <div id="recs" className="space-y-10">
            <div>
              <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#123524]">
                <span className="h-2 w-2 rounded-full bg-[#D9381E]" />
                <Sparkles className="h-3.5 w-3.5 text-[#123524]" />
                Personalised Reading Room
              </div>
              <h1 className="mt-1.5 font-serif text-3xl sm:text-4xl font-semibold text-[#123524]">
                Curated For You
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm text-[#4A5D52]">
                Recommendations adapt automatically from your reading profile:
                wishlists (+2), 4–5★ ratings (+3), lower ratings (−1), and book
                views (+1) blended with TF-IDF content similarity.
              </p>
            </div>

            {!currentUser ? (
              <div
                id="rl"
                className="rounded-3xl border border-[#DCE2DA] bg-[#FDFDF9] p-10 sm:p-14 text-center shadow-xs"
              >
                <div className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#123524] text-[#F8F7F2]">
                  <Sparkles className="h-6 w-6" />
                  <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-[#D9381E] ring-2 ring-[#FDFDF9]" />
                </div>
                <h2 className="mt-4 font-serif text-2xl font-semibold text-[#123524]">
                  Log in to get personalised recommendations
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-[#4A5D52]">
                  Sign in or register a reader account to track books you view,
                  build your wishlist, leave star reviews, and unlock tailored
                  discoveries.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAuthIntent("default");
                    setAuthPrompt("");
                    setAuthOpen(true);
                  }}
                  className="mt-6 rounded-xl bg-[#123524] px-6 py-3 text-sm font-semibold text-[#F8F7F2] transition-colors hover:bg-[#0B2418]"
                >
                  Log in / Register
                </button>
              </div>
            ) : recsLoading || !recsData ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-72 rounded-xl bg-[#E8ECE6]" />
                ))}
              </div>
            ) : (
              <>
                {/* Reader Taste Profile Banner */}
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#DCE2DA] bg-[#F0EFE7] p-5">
                  <div className="space-y-1">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#123524]">
                      <span className="h-2 w-2 rounded-full bg-[#D9381E]" />
                      {recsData.personalised
                        ? `Tailored to ${currentUser.username}'s reading taste`
                        : `Popular starter picks for ${currentUser.username}`}
                    </p>
                    <p className="text-xs text-[#4A5D52]">
                      {recsData.personalised && recsData.topGenres.length > 0
                        ? `Top genre affinities: ${recsData.topGenres.join(", ")}`
                        : "Open, wishlist, or rate any book to sharpen your personalised profile."}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="rounded-lg border border-[#DCE2DA] bg-[#FDFDF9] px-3 py-1.5 font-semibold text-[#123524]">
                      {recsData.stats.wishlisted} Wishlisted
                    </span>
                    <span className="rounded-lg border border-[#DCE2DA] bg-[#FDFDF9] px-3 py-1.5 font-semibold text-[#123524]">
                      {recsData.stats.rated} Rated
                    </span>
                    <span className="rounded-lg border border-[#DCE2DA] bg-[#FDFDF9] px-3 py-1.5 font-semibold text-[#123524]">
                      {recsData.stats.viewed} Views
                    </span>
                  </div>
                </div>

                {/* Recommended Books Grid */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <span className="h-2 w-2 rounded-full bg-[#D9381E]" />
                    <h2 className="font-serif text-2xl font-semibold text-[#123524]">
                      Recommended Next Reads
                    </h2>
                  </div>
                  <div id="rl">
                    {recsData.books.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                        {recsData.books.map((book) => (
                          <BookCard
                            key={book.id}
                            book={book}
                            wishlisted={wishlistIds.has(book.id)}
                            showMatchReason
                            onOpen={setActiveBookId}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[#C2CCC0] bg-[#FDFDF9] p-10 text-center text-sm text-[#4A5D52]">
                        You have already explored every book currently in the
                        catalogue! Check back for new releases.
                      </div>
                    )}
                  </div>
                </section>

                {/* Saved Wishlist */}
                <section className="space-y-4 border-t border-[#DCE2DA] pt-8">
                  <div className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-[#D9381E] fill-[#D9381E]" />
                    <h2 className="font-serif text-2xl font-semibold text-[#123524]">
                      Your Wishlist ({recsData.wishlist.length})
                    </h2>
                  </div>

                  {recsData.wishlist.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-5">
                      {recsData.wishlist.map((book) => (
                        <BookCard
                          key={book.id}
                          book={book}
                          wishlisted
                          onOpen={setActiveBookId}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-[#C2CCC0] bg-[#FDFDF9] p-6 text-sm text-[#4A5D52]">
                      Your wishlist is empty. Click any book cover and tap{" "}
                      <strong className="text-[#123524]">Wishlist</strong> to save titles here.
                    </p>
                  )}
                </section>

                {/* Reader's Own Ratings */}
                {recsData.ratings.length > 0 && (
                  <section className="space-y-4 border-t border-[#DCE2DA] pt-8">
                    <h2 className="font-serif text-2xl font-semibold text-[#123524]">
                      Your Ratings & Notes ({recsData.ratings.length})
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {recsData.ratings.map(({ book, rating, feedback }) => (
                        <button
                          key={book.id}
                          type="button"
                          onClick={() => setActiveBookId(book.id)}
                          className="flex items-start gap-3.5 rounded-2xl border border-[#DCE2DA] bg-[#FDFDF9] p-4 text-left transition-colors hover:border-[#123524]"
                        >
                          <div className="w-11 shrink-0">
                            <BookCover book={book} showBadge={false} size="sm" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate font-serif text-sm font-semibold text-[#123524]">
                                {book.title}
                              </p>
                              <span className="shrink-0 text-xs text-[#D9381E]">
                                {"★".repeat(rating)}
                              </span>
                            </div>
                            <p className="text-xs text-[#4A5D52]">{book.author}</p>
                            {feedback && (
                              <p className="mt-1.5 text-xs text-[#24382E] line-clamp-2">
                                “{feedback}”
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {/* ==================== INSIGHTS PAGE ==================== */}
        {page === "ins" && (
          <InsightsView
            data={insightsData}
            loading={insightsLoading}
            onSelectGenre={(genre) =>
              navigate("browse", { genre, sort: "rating", q: "" })
            }
          />
        )}

        {/* ==================== ADMIN PAGE ==================== */}
        {page === "adm" &&
          (currentUser?.isAdmin ? (
            <AdminView
              books={allBooks}
              user={currentUser}
              activeTab={adminTab}
              onTabChange={chooseAdminTool}
              upload={csvUpload}
              onSignIn={askAdmin}
              onCatalogueChanged={handleCatalogueChanged}
              onOpenBook={setActiveBookId}
            />
          ) : (
            <AdminPageGate
              selectedTask={adminTab}
              onSelectTask={chooseAdminTool}
              currentUser={currentUser}
              onAuthenticated={handleAuthenticated}
              onLogout={handleLogout}
            />
          ))}
      </main>

      {/* Deep Dark-Green Editorial Footer with Off-White Text & Tomato Red Detail */}
      <footer className="mt-16 bg-[#123524] text-[#F8F7F2]">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-7 text-xs text-[#F8F7F2]/75">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#F8F7F2]" />
            <span className="font-serif text-sm font-semibold text-[#F8F7F2]">
              Bookwise<span className="text-[#D9381E]">.</span>
            </span>
            <span>· Your books, in good company.</span>
          </div>
          <div className="flex items-center gap-5 font-medium text-[#F8F7F2]/85">
            <button
              type="button"
              onClick={() => navigate("browse")}
              className="transition-colors hover:text-[#D9381E]"
            >
              Browse
            </button>
            <button
              type="button"
              onClick={() => navigate("recs")}
              className="transition-colors hover:text-[#D9381E]"
            >
              For You
            </button>
            <button
              type="button"
              onClick={() => navigate("ins")}
              className="transition-colors hover:text-[#D9381E]"
            >
              Insights
            </button>
            <button
              type="button"
              onClick={() => navigate("adm")}
              className="transition-colors hover:text-[#D9381E]"
            >
              Admin
            </button>
          </div>
        </div>
      </footer>

      {/* Book Detail Modal */}
      {activeBookId && (
        <BookDetailModal
          key={activeBookId}
          bookId={activeBookId}
          wishlistIds={wishlistIds}
          onClose={() => setActiveBookId(null)}
          onSelectBook={(id) => setActiveBookId(id)}
          onWishlistChange={handleWishlistChange}
          onRequireAuth={(prompt) => {
            setAuthIntent("default");
            setAuthPrompt(prompt || "");
            setAuthOpen(true);
          }}
          onActivityRecorded={handleActivityRecorded}
        />
      )}

      {/* Authentication Modal */}
      {authOpen && (
        <AuthModal
          key={`${authIntent}-${authPrompt}`}
          open={authOpen}
          initialPrompt={authPrompt}
          intent={authIntent}
          onClose={() => {
            setAuthOpen(false);
            setAuthIntent("default");
          }}
          onAuthenticated={handleAuthenticated}
        />
      )}
    </div>
  );
}
