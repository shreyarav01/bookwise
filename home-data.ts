import { eq } from "drizzle-orm";
import { db } from "@/db";
import { activity, books as booksTable } from "@/db/schema";
import { normaliseBook } from "@/lib/books";
import { ensureSeeded } from "@/lib/seed";
import type { HomeData } from "@/components/types";

export async function getInitialHomeData(): Promise<HomeData> {
  try {
    await ensureSeeded();
    const [allRows, viewRows] = await Promise.all([
      db.select().from(booksTable),
      db
        .select({ bookId: activity.bookId })
        .from(activity)
        .where(eq(activity.type, "view")),
    ]);

    const books = allRows.map(normaliseBook);
    const views: Record<string, number> = {};
    viewRows.forEach((row) => {
      views[row.bookId] = (views[row.bookId] || 0) + 1;
    });

    const bestsellers = [...books]
      .sort((a, b) => b.rating - a.rating || (b.year || 0) - (a.year || 0))
      .slice(0, 10);

    const newReleases = [...books]
      .sort((a, b) => (b.year || 0) - (a.year || 0) || b.rating - a.rating)
      .slice(0, 10);

    const trending = [...books]
      .sort(
        (a, b) =>
          (views[b.id] || 0) * 4 + b.rating - ((views[a.id] || 0) * 4 + a.rating)
      )
      .slice(0, 10);

    const categories = [
      ...new Set(books.map((book) => book.genre).filter(Boolean)),
    ].sort();

    return {
      books,
      bestsellers,
      newReleases,
      trending,
      categories,
    };
  } catch (error) {
    console.error("Failed to fetch initial home data:", error);
    return {
      books: [],
      bestsellers: [],
      newReleases: [],
      trending: [],
      categories: [],
    };
  }
}
