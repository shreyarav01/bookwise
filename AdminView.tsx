"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  BookPlus,
  Download,
  FileSpreadsheet,
  FileUp,
  ImagePlus,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { CatalogueStudio } from "./CatalogueStudio";
import { AdminCsvFiles, type CsvFileKind } from "./AdminCsvFiles";
import type { CatalogueUpload } from "./useCatalogueUpload";
import { BookCover } from "./BookCover";
import {
  apiRequest,
  formatInr,
  type AdminTab,
  ApiError,
  type Book,
  type User,
} from "./types";


interface AdminViewProps {
  books: Book[];
  user: User;
  upload: CatalogueUpload;
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  onSignIn: (status?: number) => void;
  onCatalogueChanged: () => Promise<void>;
  onOpenBook: (id: string) => void;
}

const EMPTY_FORM = {
  title: "",
  author: "",
  genre: "",
  rating: "4.7",
  price: "499",
  year: "2025",
  synopsis: "",
  publisher: "",
  pages: "",
  language: "English",
  isbn: "",
  aboutAuthor: "",
};

export function AdminView({
  books,
  user, upload, onSignIn, activeTab, onTabChange: setActiveTab,
  onCatalogueChanged,
  onOpenBook,
}: AdminViewProps) {
  const username = user.username;
  const [fileRequest, setFileRequest] = useState<{ kind: CsvFileKind | null; revision: number }>({ kind: null, revision: 0 });
  const openFiles = (kind: CsvFileKind) => {
    setFileRequest(previous => ({ kind, revision: previous.revision + 1 }));
    setActiveTab("files");
  };

  // --- Manual Add / Edit Book State ---
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [coverData, setCoverData] = useState("");
  const [formMsg, setFormMsg] = useState<{ text: string; ok: boolean } | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  // --- Catalogue Management State ---
  const [filterText, setFilterText] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // --- Account Roles State ---
  const [accounts, setAccounts] = useState<
    { id: string; username: string; isAdmin: boolean; isOwner?: boolean }[]
  >([]);
  const [roleMsg, setRoleMsg] = useState<{ text: string; ok: boolean } | null>(
    null
  );
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  const csvInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ users: { id: string; username: string; isAdmin: boolean; isOwner?: boolean }[] }>(
      "/admin/users"
    )
      .then((res) => {
        if (!cancelled) setAccounts(res.users);
      })
      .catch((err: unknown) => {
        if (!cancelled) setRoleMsg({ text: err instanceof ApiError ? err.message : "Could not load account roles. Refresh the page to try again.", ok: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Manual Add / Edit Book handlers ---
  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setCoverData("");
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCoverData(typeof reader.result === "string" ? reader.result : "");
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormMsg(null);

    const payload = {
      ...form,
      title: form.title.trim(),
      author: form.author.trim(),
      genre: form.genre.trim(),
      publisher: form.publisher.trim(),
      language: form.language.trim() || "English",
      isbn: form.isbn.trim(),
      aboutAuthor: form.aboutAuthor.trim(),
      cover: coverData,
    };

    try {
      if (editingId) {
        await apiRequest(`/books/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setFormMsg({ text: "Saved changes to catalogue!", ok: true });
      } else {
        await apiRequest("/books", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setFormMsg({ text: "Book added to catalogue!", ok: true });
      }
      resetForm();
      await onCatalogueChanged();
    } catch (err) {
      setFormMsg({
        text: err instanceof Error ? err.message : "Failed to save book.",
        ok: false,
      });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (book: Book) => {
    setEditingId(book.id);
    setForm({
      title: book.title,
      author: book.author,
      genre: book.genre,
      rating: String(book.rating ?? ""),
      price: String(book.price ?? ""),
      year: book.year ? String(book.year) : "",
      synopsis: book.synopsis || "",
      publisher: book.publisher || "",
      pages: book.pages ? String(book.pages) : "",
      language: book.language || "English",
      isbn: book.isbn || "",
      aboutAuthor: book.aboutAuthor || "",
    });
    setCoverData(book.cover || "");
    setFormMsg(null);
    setActiveTab("editor");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await apiRequest(`/books/${id}`, { method: "DELETE" });
      if (editingId === id) resetForm();
      setConfirmDeleteId(null);
      await onCatalogueChanged();
    } catch (err) {
      setFormMsg({
        text: err instanceof Error ? err.message : "Delete failed.",
        ok: false,
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleAdmin = async (userId: string, nextAdmin: boolean) => {
    setTogglingUserId(userId);
    setRoleMsg(null);
    try {
      const res = await apiRequest<{
        user: { id: string; username: string; isAdmin: boolean };
        message: string;
      }>("/admin/users", {
        method: "PATCH",
        body: JSON.stringify({ userId, isAdmin: nextAdmin }),
      });
      setAccounts((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, isAdmin: res.user.isAdmin } : u
        )
      );
      setRoleMsg({ text: res.message, ok: true });
    } catch (err) {
      setRoleMsg({
        text: err instanceof Error ? err.message : "Could not update role.",
        ok: false,
      });
    } finally {
      setTogglingUserId(null);
    }
  };

  const filteredBooks = books.filter((b) => {
    if (!filterText.trim()) return true;
    const q = filterText.toLowerCase();
    return (
      b.title.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q) ||
      b.genre.toLowerCase().includes(q)
    );
  });

  const fieldClass =
    "w-full rounded-lg border border-[#DCE2DA] bg-[#F8F7F2] px-3 py-2 text-sm text-[#10231A] placeholder:text-[#78897F] focus:border-[#123524] focus:bg-[#FDFDF9] focus:outline-none";

  return (
    <div id="adm" className="space-y-7">
      {/* Admin Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-[#DCE2DA] pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#123524]">
            <span className="h-2 w-2 rounded-full bg-[#D9381E]" />
            <ShieldCheck className="h-3.5 w-3.5 text-[#123524]" />
            Admin Dashboard · {username}
          </div>
          <h1 className="mt-1.5 font-serif text-3xl sm:text-4xl font-semibold text-[#123524]">
            Catalogue Admin &{" "}
            <em className="font-serif italic font-medium text-[#D9381E]">
              CSV Upload
            </em>
          </h1>
          <p className="mt-1.5 text-sm text-[#4A5D52]">
            Upload <code className="font-semibold text-[#123524]">.csv</code>{" "}
            book files with instant row validation, add or edit individual
            editions, and manage your library of {books.length} books.
          </p>
        </div>

        {/* Quick CSV Download Actions */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button type="button" onClick={() => openFiles("template")} className="inline-flex items-center gap-1.5 rounded-lg border border-[#C9D6C2] bg-[#FFFEF9] px-3.5 py-2 text-xs font-semibold text-[#284E34] hover:bg-[#EAF0E4]">
            <FileSpreadsheet size={15} /> CSV template
          </button>
          <button type="button" onClick={() => openFiles("catalogue")} className="inline-flex items-center gap-1.5 rounded-lg bg-[#204731] px-3.5 py-2 text-xs font-semibold text-[#FAFAF0] hover:bg-[#163923]">
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* Admin Sub-Navigation Bar */}
      <div
        role="tablist"
        aria-label="Admin sections"
        className="flex flex-wrap items-center gap-2"
      >
        {(
          [
            {
              key: "csv" as AdminTab,
              label: "CSV File Upload",
              icon: FileUp,
            },
            { key: "files" as AdminTab, label: "CSV downloads", icon: Download },
            {
              key: "editor" as AdminTab,
              label: editingId ? "Editing Book" : "Add Single Book",
              icon: BookPlus,
            },
            {
              key: "catalogue" as AdminTab,
              label: `Manage Books (${books.length})`,
              icon: BookOpen,
            },
            {
              key: "roles" as AdminTab,
              label: `Account Roles (${accounts.length})`,
              icon: Users,
            },
          ] as const
        ).map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(key)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all ${
                active
                  ? "border-[#123524] bg-[#123524] text-[#F8F7F2] shadow-xs"
                  : "border-[#DCE2DA] bg-[#FDFDF9] text-[#4A5D52] hover:border-[#123524]/40 hover:text-[#123524]"
              }`}
            >
              <Icon
                className={`h-4 w-4 ${
                  active ? "text-[#F8F7F2]" : "text-[#123524]"
                }`}
              />
              {label}
              {active && (
                <span className="h-1.5 w-1.5 rounded-full bg-[#D9381E]" />
              )}
            </button>
          );
        })}
      </div>

      {activeTab === "files" && <AdminCsvFiles key={fileRequest.revision} initialKind={fileRequest.kind} bookCount={books.length}
        onAuthNeeded={onSignIn} onImport={() => setActiveTab("csv")} />}
      {activeTab === "csv" && <CatalogueStudio upload={upload} user={user} fileRef={csvInputRef}
        onFiles={() => openFiles("template")} onAuthNeeded={onSignIn} onOpenBook={onOpenBook}
        onBrowse={() => setActiveTab("catalogue")} />}

      {/* ==================== TAB 2: ADD / EDIT SINGLE BOOK ==================== */}
      {activeTab === "editor" && (
        <form
          onSubmit={handleSaveBook}
          className="max-w-4xl rounded-2xl border border-[#DCE2DA] bg-[#FDFDF9] p-6 sm:p-8 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#D9381E]" />
              <h2
                id="ft"
                className="font-serif text-xl sm:text-2xl font-semibold text-[#123524]"
              >
                {editingId ? "Edit book" : "Add a book manually"}
              </h2>
            </div>
            {editingId && (
              <button
                id="cn"
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1 rounded-lg border border-[#DCE2DA] px-3 py-1.5 text-xs font-semibold text-[#4A5D52] hover:border-[#D9381E] hover:text-[#D9381E]"
              >
                <X className="h-3.5 w-3.5" />
                Cancel edit
              </button>
            )}
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="nt"
                className="block text-xs font-semibold text-[#4A5D52] mb-1"
              >
                Title <span className="text-[#D9381E]">*</span>
              </label>
              <input
                id="nt"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Malgudi Days"
                className={fieldClass}
              />
            </div>

            <div>
              <label
                htmlFor="na"
                className="block text-xs font-semibold text-[#4A5D52] mb-1"
              >
                Author <span className="text-[#D9381E]">*</span>
              </label>
              <input
                id="na"
                required
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
                placeholder="e.g. R.K. Narayan"
                className={fieldClass}
              />
            </div>

            <div>
              <label
                htmlFor="ng"
                className="block text-xs font-semibold text-[#4A5D52] mb-1"
              >
                Genre <span className="text-[#D9381E]">*</span>
              </label>
              <input
                id="ng"
                required
                value={form.genre}
                onChange={(e) => setForm({ ...form, genre: e.target.value })}
                placeholder="e.g. Literary Fiction"
                className={fieldClass}
              />
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label
                  htmlFor="nr"
                  className="block text-xs font-semibold text-[#4A5D52] mb-1"
                >
                  Rating
                </label>
                <input
                  id="nr"
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={form.rating}
                  onChange={(e) => setForm({ ...form, rating: e.target.value })}
                  className={fieldClass}
                />
              </div>
              <div>
                <label
                  htmlFor="np"
                  className="block text-xs font-semibold text-[#4A5D52] mb-1"
                >
                  Price (₹)
                </label>
                <input
                  id="np"
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className={fieldClass}
                />
              </div>
              <div>
                <label
                  htmlFor="ny"
                  className="block text-xs font-semibold text-[#4A5D52] mb-1"
                >
                  Year
                </label>
                <input
                  id="ny"
                  type="number"
                  min="1000"
                  max="2100"
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                  className={fieldClass}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="npub"
                className="block text-xs font-semibold text-[#4A5D52] mb-1"
              >
                Publisher
              </label>
              <input
                id="npub"
                value={form.publisher}
                onChange={(e) =>
                  setForm({ ...form, publisher: e.target.value })
                }
                placeholder="e.g. Indian Thought Publications"
                className={fieldClass}
              />
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label
                  htmlFor="npg"
                  className="block text-xs font-semibold text-[#4A5D52] mb-1"
                >
                  Pages
                </label>
                <input
                  id="npg"
                  type="number"
                  min="1"
                  value={form.pages}
                  onChange={(e) => setForm({ ...form, pages: e.target.value })}
                  placeholder="264"
                  className={fieldClass}
                />
              </div>
              <div>
                <label
                  htmlFor="nlang"
                  className="block text-xs font-semibold text-[#4A5D52] mb-1"
                >
                  Language
                </label>
                <input
                  id="nlang"
                  value={form.language}
                  onChange={(e) =>
                    setForm({ ...form, language: e.target.value })
                  }
                  placeholder="English"
                  className={fieldClass}
                />
              </div>
              <div>
                <label
                  htmlFor="nisbn"
                  className="block text-xs font-semibold text-[#4A5D52] mb-1"
                >
                  ISBN
                </label>
                <input
                  id="nisbn"
                  value={form.isbn}
                  onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                  placeholder="978..."
                  className={fieldClass}
                />
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="ns"
              className="block text-xs font-semibold text-[#4A5D52] mb-1"
            >
              Synopsis
            </label>
            <textarea
              id="ns"
              rows={3}
              value={form.synopsis}
              onChange={(e) => setForm({ ...form, synopsis: e.target.value })}
              placeholder="Concise summary of the book (also powers TF-IDF semantic search)..."
              className={fieldClass}
            />
          </div>

          <div>
            <label
              htmlFor="nau"
              className="block text-xs font-semibold text-[#4A5D52] mb-1"
            >
              About the Author
            </label>
            <input
              id="nau"
              value={form.aboutAuthor}
              onChange={(e) =>
                setForm({ ...form, aboutAuthor: e.target.value })
              }
              placeholder="Short author biography..."
              className={fieldClass}
            />
          </div>

          {/* Cover Upload + Preview */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dashed border-[#C2CCC0] bg-[#F8F7F2] p-3.5">
            <div className="flex items-center gap-3">
              {coverData ? (
                <div className="relative h-16 w-11 overflow-hidden rounded border border-[#DCE2DA]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    id="cp"
                    src={coverData}
                    alt="Cover preview"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#F0EFE7] text-[#123524]">
                  <ImagePlus className="h-5 w-5" />
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-[#123524]">
                  Book Cover Artwork (optional)
                </p>
                <p className="text-[11px] text-[#4A5D52]">
                  Upload JPG/PNG, or leave empty for a dark-green clothbound
                  edition
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {coverData && (
                <button
                  type="button"
                  onClick={() => {
                    setCoverData("");
                    if (coverInputRef.current) coverInputRef.current.value = "";
                  }}
                  className="rounded-lg border border-[#DCE2DA] bg-[#FDFDF9] px-2.5 py-1.5 text-xs font-medium text-[#4A5D52] hover:border-[#D9381E]/40 hover:text-[#D9381E]"
                >
                  Remove
                </button>
              )}
              <label className="cursor-pointer rounded-lg border border-[#DCE2DA] bg-[#FDFDF9] px-3 py-1.5 text-xs font-semibold text-[#123524] hover:border-[#123524]">
                Choose cover image
                <input
                  ref={coverInputRef}
                  id="ncf"
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              id="add"
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#123524] px-5 py-2.5 text-sm font-semibold text-[#F8F7F2] transition-colors hover:bg-[#0B2418] disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {saving
                ? "Saving..."
                : editingId
                ? "Save changes"
                : "Add book"}
            </button>

            {formMsg && (
              <span
                id="am"
                className={`text-xs font-semibold ${
                  formMsg.ok ? "text-[#123524]" : "text-[#D9381E]"
                }`}
              >
                {formMsg.text}
              </span>
            )}
          </div>
        </form>
      )}

      {/* ==================== TAB 3: MANAGE CATALOGUE ==================== */}
      {activeTab === "catalogue" && (
        <div className="rounded-2xl border border-[#DCE2DA] bg-[#FDFDF9] p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#D9381E]" />
              <h2 className="font-serif text-xl font-semibold text-[#123524]">
                Manage Catalogue ({filteredBooks.length})
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78897F]" />
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Filter by title, author, genre..."
                  className="w-full rounded-lg border border-[#DCE2DA] bg-[#F8F7F2] py-2 pl-9 pr-3 text-xs text-[#10231A] placeholder:text-[#78897F] focus:border-[#123524] focus:bg-[#FDFDF9] focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("csv")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#123524] px-3.5 py-2 text-xs font-semibold text-[#F8F7F2] hover:bg-[#0B2418]"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload .CSV
              </button>
            </div>
          </div>

          <div id="al" className="divide-y divide-[#E8EDE6]">
            {filteredBooks.map((book) => (
              <div
                key={book.id}
                className="flex flex-wrap items-center justify-between gap-4 py-3"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-9 shrink-0">
                    <BookCover book={book} showBadge={false} size="sm" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-serif text-sm font-semibold text-[#123524]">
                      {book.title}
                    </p>
                    <p className="truncate text-xs text-[#4A5D52]">
                      {book.author} ·{" "}
                      <span className="font-semibold text-[#123524]">
                        {book.genre}
                      </span>{" "}
                      · <span className="text-[#D9381E]">★</span>{" "}
                      {book.rating.toFixed(1)} · {formatInr(book.price)}
                      {book.year ? ` · ${book.year}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(book)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#DCE2DA] bg-[#F8F7F2] px-3 py-1.5 text-xs font-semibold text-[#123524] transition-colors hover:border-[#123524] hover:bg-[#123524] hover:text-[#F8F7F2]"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>

                  {confirmDeleteId === book.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={deletingId === book.id}
                        onClick={() => handleDelete(book.id)}
                        className="rounded-lg bg-[#D9381E] px-3 py-1.5 text-xs font-semibold text-[#F8F7F2] hover:bg-[#BD2E16] disabled:opacity-60"
                      >
                        {deletingId === book.id ? "Deleting..." : "Confirm"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-lg border border-[#DCE2DA] px-2 py-1.5 text-xs text-[#4A5D52]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(book.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#DCE2DA] bg-[#FDFDF9] px-3 py-1.5 text-xs font-semibold text-[#4A5D52] transition-colors hover:border-[#D9381E]/50 hover:text-[#D9381E]"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================== TAB 4: ACCOUNT ROLES ==================== */}
      {activeTab === "roles" && (
        <div className="max-w-3xl rounded-2xl border border-[#DCE2DA] bg-[#FDFDF9] p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2 text-[#123524]">
              <span className="h-2 w-2 rounded-full bg-[#D9381E]" />
              <h2 className="font-serif text-xl font-semibold text-[#123524]">
                Account Roles
              </h2>
            </div>
            {roleMsg && (
              <span
                className={`text-xs font-semibold ${
                  roleMsg.ok ? "text-[#123524]" : "text-[#D9381E]"
                }`}
              >
                {roleMsg.text}
              </span>
            )}
          </div>
          <p className="mb-3 text-xs text-[#4A5D52]">
            Grant or revoke Admin permissions for any registered account.
          </p>
          <div className="divide-y divide-[#E8EDE6]">
            {accounts.map((acc) => {
              const isSelf =
                acc.username.toLowerCase() === username.toLowerCase();
              return (
                <div
                  key={acc.id}
                  className="flex items-center justify-between gap-4 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold text-[#123524]">
                      {acc.username}
                    </span>
                    {acc.isAdmin ? (
                      <span className="inline-flex items-center gap-1 rounded bg-[#123524] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#F8F7F2]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#D9381E]" />
                        Admin
                      </span>
                    ) : (
                      <span className="rounded border border-[#DCE2DA] bg-[#F8F7F2] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#4A5D52]">
                        Reader
                      </span>
                    )}
                  </div>
                  {isSelf || acc.isOwner ? (
                    <span className="text-xs text-[#4A5D52]">
                      {isSelf ? "Current session" : "Configured owner"}
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={togglingUserId === acc.id}
                      onClick={() => handleToggleAdmin(acc.id, !acc.isAdmin)}
                      className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-60 ${
                        acc.isAdmin
                          ? "border-[#DCE2DA] bg-[#FDFDF9] text-[#4A5D52] hover:border-[#D9381E]/50 hover:text-[#D9381E]"
                          : "border-[#DCE2DA] bg-[#F8F7F2] text-[#123524] hover:bg-[#123524] hover:text-[#F8F7F2]"
                      }`}
                    >
                      {acc.isAdmin ? "Revoke Admin" : "Make Admin"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
