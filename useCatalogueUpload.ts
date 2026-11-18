"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { planImport, readBookFile, type CsvSource, type DuplicateMode, type LibraryKey } from "@/lib/catalogue-csv";
import { ApiError, uploadCsvFile, type CsvImportResult } from "./types";

export function useCatalogueUpload(books: LibraryKey[], onSaved: () => Promise<void>, onAuthNeeded: (status: number) => void) {
  const [draft, setDraft] = useState<{ file: File; rows: CsvSource[] } | null>(null);
  const [mode, setMode] = useState<DuplicateMode>("skip");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<CsvImportResult | null>(null);
  const generation = useRef(0);
  const sending = useRef(false);
  const plan = useMemo(() => draft ? planImport(draft.rows, books, mode) : null, [draft, books, mode]);

  const reset = useCallback(() => {
    if (sending.current) return;
    generation.current++;
    setDraft(null); setReceipt(null); setMode("skip"); setError(""); setProgress(0); setReading(false);
  }, []);
  const select = useCallback(async (file: File) => {
    if (sending.current) return;
    const current = ++generation.current;
    setDraft(null); setMode("skip"); setError(""); setReceipt(null); setProgress(0); setReading(true);
    try {
      const rows = await readBookFile(file);
      if (current === generation.current) setDraft({ file, rows });
    } catch (e) {
      if (current === generation.current) setError(e instanceof Error ? e.message : "Could not read this file. Please choose it again.");
    } finally { if (current === generation.current) setReading(false); }
  }, []);
  const sample = async () => {
    if (sending.current) return;
    const current = ++generation.current;
    setReading(true); setError("");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch("/api/books/export?template=1", { signal: controller.signal });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      if (generation.current === current) await select(new File([blob], "bookwise-example.csv", { type: "text/csv" }));
    } catch {
      if (generation.current === current) { setReading(false); setError("Could not load the example file. Try again or choose your own CSV."); }
    } finally { clearTimeout(timer); }
  };
  const commit = async () => {
    if (sending.current || reading || !draft || !plan?.changes) return;
    sending.current = true; setSaving(true); setProgress(0); setError("");
    try {
      const result = await uploadCsvFile(draft.file, mode, setProgress);
      // The server sends a receipt only after its transaction commits. Do not block on a secondary full-catalogue fetch.
      setReceipt(result); setDraft(null);
      void onSaved().catch(() => undefined);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) onAuthNeeded(e.status);
      else setError(e instanceof Error ? e.message : "Import failed. Your file is still selected.");
    } finally { sending.current = false; setSaving(false); }
  };
  return { draft, plan, mode, setMode, reading, saving, progress, error, setError, receipt, reset, select, sample, commit };
}
export type CatalogueUpload = ReturnType<typeof useCatalogueUpload>;
