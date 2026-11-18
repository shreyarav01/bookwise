import crypto from "crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { activity, books, users } from "@/db/schema";
import { hashValue } from "@/lib/auth";

const INITIAL_BOOKS = [
  {
    title: "The Glass Observatory",
    author: "Meera Subramanian",
    genre: "Literary Fiction",
    rating: 4.9,
    price: 599,
    year: 2025,
    synopsis:
      "Atop a windswept coastal cliff in Kodaikanal, a young astronomer inherits her grandmother's brass observatory and uncovers a century of star charts, forgotten love letters, and a mystery hidden in the winter constellations.",
    publisher: "Penguin Hamish Hamilton",
    pages: 368,
    language: "English",
    isbn: "9780670098415",
    aboutAuthor:
      "Meera Subramanian is an award-winning novelist whose lyrical fiction explores memory, science, and coastal landscapes of southern India.",
    cover: "/images/covers/glass-observatory.jpg",
  },
  {
    title: "Monsoon Letters from Malabar",
    author: "Arundhati Nair",
    genre: "Literary Fiction",
    rating: 4.8,
    price: 499,
    year: 2024,
    synopsis:
      "When three estranged siblings return to their ancestral teakwood home during the June monsoon, a bundle of ribbon-tied letters reveals the quiet courage and secret artistry that held their family together across generations.",
    publisher: "HarperCollins India",
    pages: 312,
    language: "English",
    isbn: "9789356294189",
    aboutAuthor:
      "Arundhati Nair writes intimate multigenerational stories rooted in Kerala's literary and architectural heritage.",
    cover: "/images/covers/monsoon-letters.jpg",
  },
  {
    title: "Harry Potter and the Philosopher's Stone",
    author: "J.K. Rowling",
    genre: "Fantasy",
    rating: 4.9,
    price: 499,
    year: 1997,
    synopsis:
      "Rescued from neglect on his eleventh birthday, a young boy wizard discovers his magical heritage and attends Hogwarts School of Witchcraft and Wizardry, forging lifelong friendships and confronting dark magic.",
    publisher: "Bloomsbury",
    pages: 223,
    language: "English",
    isbn: "9780747532699",
    aboutAuthor:
      "J.K. Rowling is a British author best known for creating the beloved seven-volume Harry Potter fantasy series.",
    cover: "/images/covers/harry-potter.jpg",
  },
  {
    title: "Atomic Habits",
    author: "James Clear",
    genre: "Self Help",
    rating: 4.8,
    price: 499,
    year: 2018,
    synopsis:
      "A practical, evidence-based guide to building good daily habits and breaking bad ones, showing how tiny one-percent improvements in systems and routines compound into remarkable long-term transformation.",
    publisher: "Random House Avery",
    pages: 320,
    language: "English",
    isbn: "9781847941831",
    aboutAuthor:
      "James Clear is a writer and speaker focused on habits, behavioural psychology, decision making, and continuous improvement.",
    cover: "/images/covers/atomic-habits.jpg",
  },
  {
    title: "Project Hail Mary",
    author: "Andy Weir",
    genre: "Science Fiction",
    rating: 4.9,
    price: 549,
    year: 2021,
    synopsis:
      "Ryland Grace wakes up alone aboard an interstellar spacecraft light-years from Earth with no memory of his name—only to realise he is humanity's last hope to save our dimming sun through ingenuity, physics, and an unexpected cosmic friendship.",
    publisher: "Del Rey Books",
    pages: 476,
    language: "English",
    isbn: "9780593135204",
    aboutAuthor:
      "Andy Weir worked as a software engineer for two decades before becoming the bestselling science fiction author of The Martian and Project Hail Mary.",
    cover: "/images/covers/project-hail-mary.jpg",
  },
  {
    title: "The Midnight Library",
    author: "Matt Haig",
    genre: "Fantasy",
    rating: 4.7,
    price: 449,
    year: 2022,
    synopsis:
      "Between life and death lies an infinite library whose shelves hold every life Nora Seed might have lived had she made different choices—offering a moving exploration of regret, hope, and second chances.",
    publisher: "Canongate Books",
    pages: 304,
    language: "English",
    isbn: "9781786892737",
    aboutAuthor:
      "Matt Haig is an internationally bestselling British author of fiction and nonfiction exploring empathy, wonder, and mental wellbeing.",
    cover: "/images/covers/midnight-library.jpg",
  },
  {
    title: "The Psychology of Money",
    author: "Morgan Housel",
    genre: "Psychology",
    rating: 4.8,
    price: 399,
    year: 2020,
    synopsis:
      "Through nineteen concise, timeless stories, Morgan Housel explores the strange ways people think about wealth, greed, patience, compounding, and happiness—proving financial wisdom is more about behaviour than spreadsheets.",
    publisher: "Jaico Publishing House",
    pages: 252,
    language: "English",
    isbn: "9789390166268",
    aboutAuthor:
      "Morgan Housel is a partner at The Collaborative Fund and a two-time winner of the Best in Business Award from the Society of American Business Editors.",
    cover: "/images/covers/psychology-money.jpg",
  },
  {
    title: "The Silent Patient",
    author: "Alex Michaelides",
    genre: "Mystery",
    rating: 4.7,
    price: 425,
    year: 2023,
    synopsis:
      "Famous painter Alicia Berenson never speaks another word after a shocking night in London. Criminal psychotherapist Theo Faber becomes obsessed with unravelling the truth hidden inside her silence and her final enigmatic canvas.",
    publisher: "Orion Publishing",
    pages: 352,
    language: "English",
    isbn: "9781409181637",
    aboutAuthor:
      "Alex Michaelides was born in Cyprus and studied English literature at Trinity College, Cambridge before writing acclaimed psychological mysteries.",
    cover: "/images/covers/silent-patient.jpg",
  },
  {
    title: "Sapiens: A Brief History of Humankind",
    author: "Yuval Noah Harari",
    genre: "History",
    rating: 4.8,
    price: 650,
    year: 2015,
    synopsis:
      "A sweeping narrative of humanity's journey from ancient foraging tribes to the cognitive, agricultural, and scientific revolutions—examining how shared myths, empires, money, and science shaped our modern world.",
    publisher: "Vintage Penguin",
    pages: 512,
    language: "English",
    isbn: "9780099590088",
    aboutAuthor:
      "Yuval Noah Harari is a historian, philosopher, and professor in the Department of History at the Hebrew University of Jerusalem.",
    cover: "/images/covers/sapiens.jpg",
  },
  {
    title: "Wings of Fire",
    author: "A.P.J. Abdul Kalam",
    genre: "Biography",
    rating: 4.9,
    price: 350,
    year: 1999,
    synopsis:
      "An inspiring autobiography tracing Dr. A.P.J. Abdul Kalam's journey from a humble boyhood in Rameswaram to pioneering India's space and aerospace programmes—a celebration of curiosity, perseverance, and quiet leadership.",
    publisher: "Universities Press",
    pages: 180,
    language: "English",
    isbn: "9788173711466",
    aboutAuthor:
      "Dr. A.P.J. Abdul Kalam was an eminent Indian aerospace scientist, educator, and the 11th President of India.",
    cover: "/images/covers/wings-of-fire.jpg",
  },
  {
    title: "Deep Work",
    author: "Cal Newport",
    genre: "Self Help",
    rating: 4.7,
    price: 459,
    year: 2016,
    synopsis:
      "Rules for focused success in a distracted world: how cultivating sustained, distraction-free concentration unlocks mastery, creative productivity, and meaningful daily rituals.",
    publisher: "Piatkus",
    pages: 304,
    language: "English",
    isbn: "9780349411903",
    aboutAuthor:
      "Cal Newport is a computer science professor at Georgetown University who writes about technology, focus, and intentional work.",
    cover: "",
  },
  {
    title: "Dune",
    author: "Frank Herbert",
    genre: "Science Fiction",
    rating: 4.8,
    price: 699,
    year: 1965,
    synopsis:
      "Set on the desert planet Arrakis—the sole source of the precious spice melange—young Paul Atreides navigates interstellar politics, ecology, prophecy, and survival in science fiction's defining epic.",
    publisher: "Hodder & Stoughton",
    pages: 688,
    language: "English",
    isbn: "9780340960196",
    aboutAuthor:
      "Frank Herbert was an American science fiction master celebrated for the world-building depth and philosophical scope of the Dune chronicles.",
    cover: "",
  },
  {
    title: "The Thursday Murder Club",
    author: "Richard Osman",
    genre: "Mystery",
    rating: 4.6,
    price: 479,
    year: 2023,
    synopsis:
      "In a peaceful English retirement village, four sharp-witted septuagenarians meet every Thursday to investigate unsolved cold cases—until a real mystery lands right on their doorstep.",
    publisher: "Viking Penguin",
    pages: 400,
    language: "English",
    isbn: "9780241988268",
    aboutAuthor:
      "Richard Osman is a British author, producer, and television presenter whose witty crime novels have become global bestsellers.",
    cover: "",
  },
  {
    title: "Thinking, Fast and Slow",
    author: "Daniel Kahneman",
    genre: "Psychology",
    rating: 4.7,
    price: 599,
    year: 2011,
    synopsis:
      "Nobel laureate Daniel Kahneman takes readers on a groundbreaking tour of the human mind, explaining the interplay between fast intuitive System 1 thinking and slow analytical System 2 judgement.",
    publisher: "Penguin Press",
    pages: 499,
    language: "English",
    isbn: "9780141033570",
    aboutAuthor:
      "Daniel Kahneman was a psychologist and winner of the Nobel Memorial Prize in Economic Sciences for his pioneering work on behavioural economics.",
    cover: "",
  },
  {
    title: "The Anarchy",
    author: "William Dalrymple",
    genre: "History",
    rating: 4.8,
    price: 750,
    year: 2022,
    synopsis:
      "Drawn from previously untranslated Persian and Indian archives, this vivid historical chronicle tells how a London trading corporation reshaped the Mughal subcontinent between the seventeenth and nineteenth centuries.",
    publisher: "Bloomsbury India",
    pages: 576,
    language: "English",
    isbn: "9781408864395",
    aboutAuthor:
      "William Dalrymple is a historian, curator, and co-founder of the Jaipur Literature Festival, living on a farm outside Delhi.",
    cover: "",
  },
  {
    title: "Harry Potter and the Prisoner of Azkaban",
    author: "J.K. Rowling",
    genre: "Fantasy",
    rating: 4.9,
    price: 525,
    year: 2024,
    synopsis:
      "In this newly illustrated anniversary edition, Harry returns for his third year at Hogwarts as secrets of the Marauder's Map, time-turners, and his parents' loyal friends come dramatically to light.",
    publisher: "Bloomsbury",
    pages: 352,
    language: "English",
    isbn: "9781408855676",
    aboutAuthor:
      "J.K. Rowling is a British novelist and philanthropist whose Hogwarts stories have enchanted generations of readers worldwide.",
    cover: "",
  },
];

let seedPromise: Promise<void> | null = null;

async function runSeed(): Promise<void> {
  const [{ count: bookCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(books);

  if (bookCount > 0) {
    return;
  }

  // 1. Seed non-admin community reader profiles for catalogue reviews (no pre-seeded admin)
  const insertedUsers = await db
    .insert(users)
    .values([
      {
        username: "ananya",
        passwordHash: hashValue(crypto.randomBytes(24).toString("hex")),
        securityAnswerHash: hashValue(crypto.randomBytes(24).toString("hex")),
        isAdmin: false,
      },
      {
        username: "vikram",
        passwordHash: hashValue(crypto.randomBytes(24).toString("hex")),
        securityAnswerHash: hashValue(crypto.randomBytes(24).toString("hex")),
        isAdmin: false,
      },
    ])
    .onConflictDoNothing()
    .returning();

  const ananya = insertedUsers.find((u) => u.username === "ananya");
  const vikram = insertedUsers.find((u) => u.username === "vikram");

  if (!ananya || !vikram) {
    await db.insert(books).values(INITIAL_BOOKS);
    return;
  }

  // 2. Seed rich catalogue
  const insertedBooks = await db.insert(books).values(INITIAL_BOOKS).returning();

  const byTitle = (title: string) =>
    insertedBooks.find((b) => b.title.toLowerCase().startsWith(title.toLowerCase()));

  const glass = byTitle("The Glass Observatory");
  const monsoon = byTitle("Monsoon Letters");
  const hp1 = byTitle("Harry Potter and the Philosopher");
  const atomic = byTitle("Atomic Habits");
  const hailMary = byTitle("Project Hail Mary");
  const midnight = byTitle("The Midnight Library");
  const psychMoney = byTitle("The Psychology of Money");
  const silent = byTitle("The Silent Patient");
  const sapiens = byTitle("Sapiens");
  const wings = byTitle("Wings of Fire");

  const seedActivity: (typeof activity.$inferInsert)[] = [];

  // Authentic reader reviews
  if (glass) {
    seedActivity.push(
      {
        userId: ananya.id,
        bookId: glass.id,
        type: "rating",
        rating: 5,
        feedback:
          "Luminous prose—the Kodaikanal observatory setting feels vivid on every single page.",
      },
      { userId: ananya.id, bookId: glass.id, type: "view" },
      { userId: vikram.id, bookId: glass.id, type: "view" },
      { userId: vikram.id, bookId: glass.id, type: "view" }
    );
  }
  if (atomic) {
    seedActivity.push(
      {
        userId: vikram.id,
        bookId: atomic.id,
        type: "rating",
        rating: 5,
        feedback:
          "The two-minute rule and habit stacking completely transformed my morning reading routine.",
      },
      { userId: vikram.id, bookId: atomic.id, type: "wishlist" },
      { userId: vikram.id, bookId: atomic.id, type: "view" },
      { userId: ananya.id, bookId: atomic.id, type: "view" },
      { userId: ananya.id, bookId: atomic.id, type: "view" }
    );
  }
  if (hp1) {
    seedActivity.push(
      {
        userId: ananya.id,
        bookId: hp1.id,
        type: "rating",
        rating: 5,
        feedback: "Pure comfort reading. Stepping onto Platform 9¾ never loses its magic.",
      },
      {
        userId: vikram.id,
        bookId: hp1.id,
        type: "rating",
        rating: 5,
        feedback: "Timeless storytelling and unforgettable world-building from chapter one.",
      },
      { userId: ananya.id, bookId: hp1.id, type: "wishlist" },
      { userId: ananya.id, bookId: hp1.id, type: "view" }
    );
  }
  if (hailMary) {
    seedActivity.push(
      {
        userId: vikram.id,
        bookId: hailMary.id,
        type: "rating",
        rating: 5,
        feedback:
          "Smart, thrilling, and unexpectedly heartwarming—couldn't put it down past midnight.",
      },
      { userId: vikram.id, bookId: hailMary.id, type: "wishlist" },
      { userId: vikram.id, bookId: hailMary.id, type: "view" },
      { userId: vikram.id, bookId: hailMary.id, type: "view" },
      { userId: ananya.id, bookId: hailMary.id, type: "view" }
    );
  }
  if (monsoon) {
    seedActivity.push(
      {
        userId: ananya.id,
        bookId: monsoon.id,
        type: "rating",
        rating: 5,
        feedback: "You can practically smell the rain on red laterite earth. Deeply moving.",
      },
      { userId: ananya.id, bookId: monsoon.id, type: "view" },
      { userId: vikram.id, bookId: monsoon.id, type: "view" }
    );
  }
  if (psychMoney) {
    seedActivity.push(
      {
        userId: vikram.id,
        bookId: psychMoney.id,
        type: "rating",
        rating: 5,
        feedback: "Clear, humble, and packed with wisdom on compounding and contentment.",
      },
      { userId: vikram.id, bookId: psychMoney.id, type: "view" },
      { userId: ananya.id, bookId: psychMoney.id, type: "view" }
    );
  }
  if (midnight) {
    seedActivity.push(
      {
        userId: ananya.id,
        bookId: midnight.id,
        type: "rating",
        rating: 4,
        feedback: "A warm, gentle reminder to appreciate the quiet beauty of ordinary life.",
      },
      { userId: ananya.id, bookId: midnight.id, type: "view" }
    );
  }
  if (silent) {
    seedActivity.push(
      {
        userId: vikram.id,
        bookId: silent.id,
        type: "rating",
        rating: 5,
        feedback: "That final twist caught me completely off guard—brilliantly paced mystery.",
      },
      { userId: vikram.id, bookId: silent.id, type: "view" },
      { userId: ananya.id, bookId: silent.id, type: "view" }
    );
  }
  if (sapiens) {
    seedActivity.push({
      userId: vikram.id,
      bookId: sapiens.id,
      type: "rating",
      rating: 5,
      feedback: "Makes you look at history, currency, and human cooperation with fresh eyes.",
    });
  }
  if (wings) {
    seedActivity.push(
      {
        userId: ananya.id,
        bookId: wings.id,
        type: "rating",
        rating: 5,
        feedback: "Every student and dreamer should read Dr. Kalam's story at least once.",
      },
      { userId: ananya.id, bookId: wings.id, type: "view" }
    );
  }

  if (seedActivity.length > 0) {
    await db.insert(activity).values(seedActivity);
  }
}

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}
