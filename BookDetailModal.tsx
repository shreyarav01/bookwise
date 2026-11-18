"use client";

import { useEffect, useState } from "react";
import { BookOpen, Heart, MessageSquare, Sparkles, Star, X } from "lucide-react";
import { BookCover } from "./BookCover";
import { BookCard } from "./BookCard";
import {
  apiRequest,
  formatInr,
  renderStars,
  type BookDetailData,
  type Review,
} from "./types";

interface BookDetailModalProps {
  bookId: string;
  wishlistIds: Set<string>;
  onClose: () => void;
  onSelectBook: (id: string) => void;
  onWishlistChange: (bookId: string, wishlisted: boolean) => void;
  onRequireAuth: (prompt?: string) => void;
  onActivityRecorded: () => void;
}

export function BookDetailModal({
  bookId,
  wishlistIds,
  onClose,
  onSelectBook,
  onWishlistChange,
  onRequireAuth,
  onActivityRecorded,
}: BookDetailModalProps) {
  const [data, setData] = useState<BookDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ratingValue, setRatingValue] = useState<number>(5);
  const [feedback, setFeedback] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiRequest<BookDetailData>(`/books/${bookId}`)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setRatingValue(res.userRating?.rating || 5);
        setFeedback(res.userRating?.feedback || "");
        if (res.wishlisted) {
          onWishlistChange(res.book.id, true);
        }
        onActivityRecorded();
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "Could not load book.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const isWishlisted = data
    ? wishlistIds.has(data.book.id) || data.wishlisted
    : false;

  const handleToggleWishlist = async () => {
    if (!data) return;
    try {
      const res = await apiRequest<{ wishlisted: boolean; message: string }>(
        `/books/${data.book.id}/wishlist`,
        { method: "POST" }
      );
      setData((prev) => (prev ? { ...prev, wishlisted: res.wishlisted } : prev));
      onWishlistChange(data.book.id, res.wishlisted);
      setActionMessage(res.message);
      onActivityRecorded();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not update wishlist.";
      setActionMessage(msg);
      if (msg.toLowerCase().includes("log in")) {
        onRequireAuth("Log in or create a reader account to save books to your wishlist.");
      }
    }
  };

  const handleRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || submitting) return;
    setSubmitting(true);
    try {
      const res = await apiRequest<{
        ok: boolean;
        message: string;
        reviews?: Review[];
      }>(`/books/${data.book.id}/rate`, {
        method: "POST",
        body: JSON.stringify({
          rating: ratingValue,
          feedback: feedback.trim(),
        }),
      });
      setActionMessage(res.message);
      if (res.reviews) {
        setData((prev) => (prev ? { ...prev, reviews: res.reviews! } : prev));
      }
      onActivityRecorded();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not submit rating.";
      setActionMessage(msg);
      if (msg.toLowerCase().includes("log in")) {
        onRequireAuth("Log in or create a reader account to rate and review books.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={data?.book.title || "Book details"}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B2418]/60 p-4 backdrop-blur-[2px] overflow-y-auto"
    >
      <div className="relative my-auto max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#DCE2DA] bg-[#F8F7F2] p-6 sm:p-8 shadow-2xl">
        {/* Delicate dark green + tomato red top bookmark strip */}
        <div className="absolute inset-x-0 top-0 flex h-1 overflow-hidden rounded-t-2xl">
          <span className="flex-1 bg-[#123524]" />
          <span className="w-16 bg-[#D9381E]" />
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-[#DCE2DA] bg-[#FDFDF9] text-[#4A5D52] transition-colors hover:border-[#D9381E] hover:text-[#D9381E]"
        >
          <X className="h-4 w-4" />
        </button>

        {loading && (
          <div className="flex flex-col sm:flex-row gap-6 animate-pulse py-4">
            <div className="h-56 w-36 shrink-0 rounded-md bg-[#E3E7E0]" />
            <div className="flex-1 space-y-3">
              <div className="h-7 w-2/3 rounded bg-[#E3E7E0]" />
              <div className="h-4 w-1/3 rounded bg-[#E3E7E0]" />
              <div className="h-20 w-full rounded bg-[#E3E7E0]" />
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="py-10 text-center">
            <p className="font-serif text-lg text-[#10231A]">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 rounded-lg bg-[#123524] px-4 py-2 text-sm font-medium text-[#F8F7F2] hover:bg-[#0B2418]"
            >
              Close
            </button>
          </div>
        )}

        {!loading && data && (
          <div className="space-y-6">
            {/* Book primary header */}
            <div className="flex flex-col sm:flex-row gap-6 pr-6">
              <div className="w-[144px] sm:w-[158px] shrink-0 mx-auto sm:mx-0">
                <BookCover book={data.book} size="md" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#123524] px-3 py-0.5 font-semibold text-[#F8F7F2]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#D9381E]" />
                    {data.book.genre}
                  </span>
                  {data.book.year && (
                    <span className="rounded-full border border-[#DCE2DA] bg-[#FDFDF9] px-2.5 py-0.5 font-medium text-[#4A5D52]">
                      {data.book.year}
                    </span>
                  )}
                </div>

                <h2 className="mt-2 font-serif text-2xl sm:text-[28px] font-semibold leading-tight text-[#123524]">
                  {data.book.title}
                </h2>
                <p className="mt-1 text-sm font-medium text-[#4A5D52]">
                  by <span className="font-semibold text-[#10231A]">{data.book.author}</span>
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base tracking-tight text-[#D9381E]">
                      {renderStars(data.book.rating)}
                    </span>
                    <span className="text-sm font-bold text-[#123524]">
                      {data.book.rating.toFixed(1)}
                    </span>
                  </div>
                  <span className="h-4 w-px bg-[#DCE2DA]" />
                  <span className="font-serif text-xl font-bold text-[#123524]">
                    {formatInr(data.book.price)}
                  </span>
                </div>

                <p className="mt-4 text-[14.5px] leading-relaxed text-[#24382E]">
                  {data.book.synopsis || "No synopsis available for this edition yet."}
                </p>

                {/* Edition metadata pills */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {(
                    [
                      ["Publisher", data.book.publisher],
                      ["Pages", data.book.pages],
                      ["Language", data.book.language],
                      ["ISBN", data.book.isbn],
                    ] as const
                  )
                    .filter(([, val]) => Boolean(val))
                    .map(([label, val]) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-1 rounded-md border border-[#DCE2DA] bg-[#FDFDF9] px-2.5 py-1 text-xs text-[#4A5D52]"
                      >
                        <strong className="font-semibold text-[#123524]">
                          {label}:
                        </strong>{" "}
                        {val}
                      </span>
                    ))}
                </div>

                {data.book.aboutAuthor && (
                  <div className="mt-4 rounded-xl border border-[#DCE2DA] bg-[#F0EFE7] p-3.5 text-xs leading-relaxed text-[#2D4137]">
                    <div className="flex items-center gap-1.5 font-semibold uppercase tracking-[0.08em] text-[#123524] mb-1">
                      <BookOpen className="h-3.5 w-3.5 text-[#123524]" />
                      About the Author
                    </div>
                    {data.book.aboutAuthor}
                  </div>
                )}
              </div>
            </div>

            {/* Wishlist + Rate & Review action bar */}
            <form
              onSubmit={handleRate}
              className="rounded-xl border border-[#DCE2DA] bg-[#FDFDF9] p-4 shadow-xs"
            >
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleWishlist}
                  className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
                    isWishlisted
                      ? "border-[#D9381E]/35 bg-[#D9381E]/10 text-[#D9381E]"
                      : "border-[#DCE2DA] bg-[#F8F7F2] text-[#123524] hover:border-[#D9381E]/50 hover:text-[#D9381E]"
                  }`}
                >
                  <Heart
                    className={`h-4 w-4 ${isWishlisted ? "fill-current" : ""}`}
                  />
                  {isWishlisted ? "Wishlisted" : "Wishlist"}
                </button>

                <div className="hidden sm:block h-6 w-px bg-[#DCE2DA]" />

                {/* Interactive 1-5 Star Selector */}
                <div
                  className="flex items-center gap-0.5"
                  role="group"
                  aria-label="Rating out of 5 stars"
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingValue(star)}
                      title={`Rate ${star} star${star > 1 ? "s" : ""}`}
                      className="p-1 transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-4 w-4 ${
                          star <= ratingValue
                            ? "fill-[#D9381E] text-[#D9381E]"
                            : "text-[#C6CFC4]"
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-1 text-xs font-semibold text-[#123524]">
                    {ratingValue}/5
                  </span>
                </div>

                <input
                  id="fb"
                  type="text"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Share your thoughts on this book..."
                  className="min-w-[180px] flex-1 rounded-lg border border-[#DCE2DA] bg-[#F8F7F2] px-3 py-2 text-sm text-[#10231A] placeholder:text-[#78897F] focus:border-[#123524] focus:bg-[#FDFDF9] focus:outline-none"
                />

                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#123524] px-4 py-2 text-sm font-semibold text-[#F8F7F2] transition-colors hover:bg-[#0B2418] disabled:opacity-60"
                >
                  {submitting ? "Saving..." : "Rate"}
                </button>
              </div>

              {actionMessage && (
                <p
                  id="mg"
                  className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#123524]"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#D9381E]" />
                  {actionMessage}
                </p>
              )}
            </form>

            {/* Reader Reviews */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="h-4 w-4 text-[#123524]" />
                <h3 className="font-serif text-lg font-semibold text-[#123524]">
                  Reader Reviews
                </h3>
                <span className="text-xs text-[#4A5D52]">
                  ({data.reviews.length})
                </span>
              </div>

              {data.reviews.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#C9D2C7] bg-[#FDFDF9] px-4 py-5 text-center text-sm text-[#4A5D52]">
                  No reader reviews yet. Be the first to rate this book.
                </p>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {data.reviews.map((review, idx) => (
                    <div
                      key={review.id || `${review.username}-${idx}`}
                      className="rounded-xl border border-[#DCE2DA] bg-[#FDFDF9] p-3.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-[#123524]">
                          {review.username}
                        </span>
                        <span className="text-xs tracking-tight text-[#D9381E]">
                          {"★".repeat(review.rating)}
                          {"☆".repeat(Math.max(0, 5 - review.rating))}
                        </span>
                      </div>
                      {review.feedback ? (
                        <p className="mt-1.5 text-xs leading-relaxed text-[#384C41]">
                          {review.feedback}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs italic text-[#78897F]">
                          Rated {review.rating} out of 5 stars
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Similar Books (TF-IDF Cosine Similarity) */}
            {data.similar.length > 0 && (
              <div className="border-t border-[#DCE2DA] pt-5">
                <div className="flex items-center gap-2 mb-3.5">
                  <Sparkles className="h-4 w-4 text-[#D9381E]" />
                  <h3 className="font-serif text-lg font-semibold text-[#123524]">
                    Similar Books
                  </h3>
                  <span className="text-xs text-[#4A5D52]">
                    matched by theme & style
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {data.similar.map((sim) => (
                    <BookCard
                      key={sim.id}
                      book={sim}
                      wishlisted={wishlistIds.has(sim.id)}
                      onOpen={onSelectBook}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
