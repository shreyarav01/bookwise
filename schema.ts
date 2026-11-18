import {
  pgTable,
  uuid,
  text,
  boolean,
  real,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  securityAnswerHash: text("security_answer_hash").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)]
);

export const books = pgTable(
  "books",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    author: text("author").notNull(),
    genre: text("genre").notNull(),
    rating: real("rating").notNull().default(0),
    price: real("price").notNull().default(0),
    year: integer("year"),
    synopsis: text("synopsis").notNull().default(""),
    publisher: text("publisher").notNull().default(""),
    pages: integer("pages"),
    language: text("language").notNull().default("English"),
    isbn: text("isbn").notNull().default(""),
    aboutAuthor: text("about_author").notNull().default(""),
    cover: text("cover").notNull().default(""),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("books_genre_idx").on(table.genre),
    index("books_author_idx").on(table.author),
  ]
);

export const activity = pgTable(
  "activity",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // "wishlist" | "rating" | "view"
    rating: integer("rating"),
    feedback: text("feedback"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("activity_user_id_idx").on(table.userId),
    index("activity_book_id_idx").on(table.bookId),
    index("activity_type_idx").on(table.type),
  ]
);

export const subscribers = pgTable("subscribers", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type UserRow = typeof users.$inferSelect;
export type BookRow = typeof books.$inferSelect;
export type ActivityRow = typeof activity.$inferSelect;
