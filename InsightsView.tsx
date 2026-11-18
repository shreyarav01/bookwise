"use client";

import { BarChart3, BookOpen, IndianRupee, MessageSquareHeart, Star } from "lucide-react";
import { formatInr, type InsightsData } from "./types";

interface BarChartCardProps {
  title: string;
  subtitle: string;
  items: { label: string; value: number }[];
  formatter?: (val: number) => string;
  barColor?: string;
  highlightTopInTomato?: boolean;
  limit?: number;
  onSelectLabel?: (label: string) => void;
}

function BarChartCard({
  title,
  subtitle,
  items,
  formatter = (v) => String(v),
  barColor = "#123524",
  highlightTopInTomato = true,
  limit = 8,
  onSelectLabel,
}: BarChartCardProps) {
  const top = [...items].sort((a, b) => b.value - a.value).slice(0, limit);
  const maximum = Math.max(1, ...top.map((item) => item.value));

  return (
    <div className="rounded-2xl border border-[#DCE2DA] bg-[#FDFDF9] p-6 shadow-xs">
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#D9381E]" />
          <h3 className="font-serif text-lg font-semibold text-[#123524]">
            {title}
          </h3>
        </div>
        <p className="mt-0.5 text-xs text-[#4A5D52]">{subtitle}</p>
      </div>

      {top.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#4A5D52]">
          No catalogue data available yet.
        </p>
      ) : (
        <div className="space-y-3">
          {top.map((item, idx) => {
            const pct = Math.max(6, Math.round((item.value / maximum) * 100));
            const isLeader = idx === 0 && highlightTopInTomato;
            return (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-xs">
                  {onSelectLabel ? (
                    <button
                      type="button"
                      onClick={() => onSelectLabel(item.label)}
                      className="truncate font-medium text-[#10231A] hover:text-[#D9381E] hover:underline text-left transition-colors"
                    >
                      {item.label}
                    </button>
                  ) : (
                    <span className="truncate font-medium text-[#10231A]">
                      {item.label}
                    </span>
                  )}
                  <span
                    className={`shrink-0 font-semibold tabular-nums ${
                      isLeader ? "text-[#D9381E]" : "text-[#123524]"
                    }`}
                  >
                    {formatter(item.value)}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F0EFE7]">
                  <div
                    className="relative h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: isLeader ? "#D9381E" : barColor,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface InsightsViewProps {
  data: InsightsData | null;
  loading: boolean;
  onSelectGenre: (genre: string) => void;
}

export function InsightsView({
  data,
  loading,
  onSelectGenre,
}: InsightsViewProps) {
  if (loading || !data) {
    return (
      <div className="space-y-6 py-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-[#E8ECE6]" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-[#E8ECE6]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div id="ins" className="space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#123524]">
          <span className="h-2 w-2 rounded-full bg-[#D9381E]" />
          <BarChart3 className="h-3.5 w-3.5 text-[#123524]" />
          Catalogue Analytics
        </div>
        <h1 className="mt-1.5 font-serif text-3xl sm:text-4xl font-semibold text-[#123524]">
          Market & Reader Insights
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#4A5D52]">
          Live distribution of genres, leading authors, reader rating benchmarks,
          Indian rupee pricing trends, and publication-year acclaim across the
          Bookwise library—with each category leader highlighted in tomato red.
        </p>
      </div>

      {/* 4 Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#DCE2DA] bg-[#FDFDF9] p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#4A5D52]">
            <BookOpen className="h-4 w-4 text-[#123524]" />
            Catalogue Titles
          </div>
          <p className="mt-2 font-serif text-3xl font-bold text-[#123524]">
            {data.summary.totalBooks}
          </p>
          <p className="mt-0.5 text-xs text-[#4A5D52]">
            across {data.summary.totalGenres} genres
          </p>
        </div>

        <div className="rounded-2xl border border-[#DCE2DA] bg-[#FDFDF9] p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#4A5D52]">
            <Star className="h-4 w-4 fill-[#D9381E] text-[#D9381E]" />
            Average Rating
          </div>
          <p className="mt-2 font-serif text-3xl font-bold text-[#123524]">
            {data.summary.avgRating.toFixed(2)}
          </p>
          <p className="mt-0.5 text-xs text-[#4A5D52]">out of 5.00 stars</p>
        </div>

        <div className="rounded-2xl border border-[#DCE2DA] bg-[#FDFDF9] p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#4A5D52]">
            <IndianRupee className="h-4 w-4 text-[#123524]" />
            Average Price
          </div>
          <p className="mt-2 font-serif text-3xl font-bold text-[#123524]">
            {formatInr(data.summary.avgPrice)}
          </p>
          <p className="mt-0.5 text-xs text-[#4A5D52]">catalogue retail mean</p>
        </div>

        <div className="rounded-2xl border border-[#DCE2DA] bg-[#FDFDF9] p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#4A5D52]">
            <MessageSquareHeart className="h-4 w-4 text-[#D9381E]" />
            Reader Signals
          </div>
          <p className="mt-2 font-serif text-3xl font-bold text-[#123524]">
            {data.summary.totalReviews + data.summary.totalWishlists}
          </p>
          <p className="mt-0.5 text-xs text-[#4A5D52]">
            {data.summary.totalReviews} ratings · {data.summary.totalWishlists} wishlists
          </p>
        </div>
      </div>

      {/* 5 Insight Bar Charts (Dark Green with #1 bar accented in Tomato Red) */}
      <div id="il" className="grid gap-6 md:grid-cols-2">
        <BarChartCard
          title="Most popular genres"
          subtitle="Number of books per category — click a genre to browse"
          items={data.genres.map((g) => ({ label: g.label, value: g.count }))}
          formatter={(v) => `${v} ${v === 1 ? "book" : "books"}`}
          barColor="#123524"
          onSelectLabel={onSelectGenre}
        />

        <BarChartCard
          title="Top authors by bestsellers"
          subtitle="Authors with the strongest representation in the catalogue"
          items={data.authors.map((a) => ({ label: a.label, value: a.count }))}
          formatter={(v) => `${v} ${v === 1 ? "title" : "titles"}`}
          barColor="#1B4832"
          limit={8}
        />

        <BarChartCard
          title="Average rating by genre"
          subtitle="Mean editorial & reader score out of 5.00"
          items={data.ratingByGenre.map((g) => ({
            label: g.label,
            value: g.average,
          }))}
          formatter={(v) => `${v.toFixed(2)} ★`}
          barColor="#123524"
          onSelectLabel={onSelectGenre}
        />

        <BarChartCard
          title="Average price by genre"
          subtitle="Mean book price in Indian Rupees (₹)"
          items={data.priceByGenre.map((g) => ({
            label: g.label,
            value: g.average,
          }))}
          formatter={(v) => formatInr(v)}
          barColor="#1E5038"
          onSelectLabel={onSelectGenre}
        />

        <div className="md:col-span-2">
          <BarChartCard
            title="Average rating by year"
            subtitle="Highest-rated publication vintages across releases"
            items={data.ratingByYear.map((y) => ({
              label: y.label,
              value: y.average,
            }))}
            formatter={(v) => `${v.toFixed(2)} ★`}
            barColor="#123524"
            limit={8}
          />
        </div>
      </div>
    </div>
  );
}
