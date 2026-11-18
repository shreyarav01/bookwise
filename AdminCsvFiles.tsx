"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Clipboard, Download, FileSpreadsheet, LibraryBig, LoaderCircle, X } from "lucide-react";
import { ApiError, sessionHeaders } from "./types";

export type CsvFileKind = "template" | "catalogue";

export function AdminCsvFiles({ bookCount, initialKind, onAuthNeeded, onImport }: {
  bookCount: number;
  initialKind: CsvFileKind | null;
  onAuthNeeded: (status: number) => void;
  onImport: () => void;
}) {
  const [request, setRequest] = useState<{ kind: CsvFileKind; number: number } | null>(initialKind ? { kind: initialKind, number: 0 } : null);
  const [file, setFile] = useState<{ name: string; url: string; text: string; size: number } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const preview = useRef<HTMLTextAreaElement>(null);
  const authHandler = useRef(onAuthNeeded);
  useEffect(() => { authHandler.current = onAuthNeeded; }, [onAuthNeeded]);
  useEffect(() => {
    if (!request) return;
    let active = true, objectUrl = "";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    (async () => {
      try {
        const endpoint = request.kind === "template" ? "/api/books/export?template=1" : "/api/books/export";
        const response = await fetch(endpoint, { headers: sessionHeaders(), cache: "no-store", credentials: "same-origin", signal: controller.signal });
        if (!response.ok) { const result = await response.json().catch(() => null); throw new ApiError(response.status, result?.error || "The CSV could not be prepared. Please try again."); }
        if (!response.headers.get("content-type")?.includes("text/csv")) throw new Error("Bookwise did not receive a CSV file. Please check your connection and retry.");
        const text = await response.text();
        if (!text.trim()) throw new Error("The export was empty. Please try again.");
        if (!active) return;
        const blob = new Blob(["\uFEFF", text.replace(/^\uFEFF/, "")], { type: "text/csv;charset=utf-8" });
        objectUrl = URL.createObjectURL(blob);
        setFile({ name: `bookwise-${request.kind}.csv`, url: objectUrl, text, size: blob.size });
      } catch (e) {
        if (!active) return;
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) authHandler.current(e.status);
        else setError(controller.signal.aborted ? "Preparing the CSV timed out. Please try again." : e instanceof Error ? e.message : "Could not prepare your CSV.");
      } finally { clearTimeout(timer); }
    })();
    return () => { active = false; controller.abort(); clearTimeout(timer); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [request]);
  const prepare = (kind: CsvFileKind) => { setFile(null); setNotice(""); setError(""); setCopied(false); setRequest(prev => ({ kind, number: (prev?.number || 0) + 1 })); };
  const copy = async () => {
    if (!file) return;
    try { await navigator.clipboard.writeText(file.text); setCopied(true); setNotice("CSV copied. Paste it into a spreadsheet or a .csv file."); }
    catch {
      const el = preview.current;
      if (!el) return;
      el.focus(); el.select();
      setNotice("The CSV text is selected. Use your device’s Copy action, then paste it into a .csv file.");
    }
  };
  return <section className="space-y-4 rounded-xl border border-[#D7DFD0] bg-[#FFFEF9] p-5 sm:p-7" aria-labelledby="csv-downloads-title">
    <div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#64755A]">CATALOGUE FILES</p><h2 id="csv-downloads-title" className="mt-1 font-serif text-2xl font-medium tracking-tight text-[#183E2C]">CSV downloads</h2><p className="mt-1 text-xs leading-relaxed text-[#5B6B58]">Choose a file, then save it to your device or copy its contents.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">{([
      { kind: "template", title: "CSV template", text: "A ready-to-edit file with example book rows.", icon: FileSpreadsheet },
      { kind: "catalogue", title: "Export catalogue", text: `${bookCount} books, with their current catalogue details.`, icon: LibraryBig },
    ] as const).map(({ kind, title, text, icon: Icon }) => <button type="button" key={kind} onClick={() => prepare(kind)} aria-pressed={request?.kind === kind} className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${request?.kind === kind ? "border-[#8CA684] bg-[#EDF3E6]" : "border-[#D6DFCE] bg-[#F9FAF3] hover:border-[#9BB292]"}`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#E1EADA] text-[#2E5437]"><Icon size={18} /></span><span className="min-w-0 flex-1"><strong className="block text-sm text-[#22492F]">{title}</strong><small className="mt-0.5 block text-xs leading-relaxed text-[#5C6C56]">{text}</small></span><ArrowRight size={14} className="mt-1 shrink-0 text-[#698062]" />
    </button>)}</div>
    {request && !file && !error && <p role="status" className="flex items-center gap-2 text-sm text-[#365D3C]"><LoaderCircle size={15} className="animate-spin" />Preparing your CSV…</p>}
    {error && <p role="alert" className="rounded-lg border border-[#EACABB] bg-[#FBF0E7] p-3 text-xs text-[#934429]">{error} <button type="button" onClick={() => prepare(request?.kind || "template")} className="ml-1 font-semibold underline">Retry</button></p>}
    {file && <div className="space-y-3 rounded-lg border border-[#D2DDC9] bg-[#F7F9F2] p-4">
      <div className="flex flex-wrap items-center gap-2"><Check size={16} className="text-[#456F42]" /><p role="status" className="flex-1 text-sm font-semibold text-[#244B31]">{file.name} is ready</p><small className="text-[11px] text-[#65765D]">{Math.max(0.1, file.size / 1024).toFixed(1)} KB</small><button type="button" aria-label="Close CSV preview" onClick={() => { setRequest(null); setFile(null); setNotice(""); }} className="p-1 text-[#65765D]"><X size={15} /></button></div>
      <label htmlFor="csv-download-preview" className="block text-xs font-medium text-[#53684D]">File contents</label>
      <textarea ref={preview} id="csv-download-preview" readOnly wrap="off" rows={4} value={file.text} className="block w-full rounded-md border border-[#D0DBCA] bg-[#FFFEFA] p-2.5 font-mono text-[11px] leading-relaxed text-[#354E36]" />
      <div className="flex flex-wrap items-center gap-2"><a href={file.url} download={file.name} onClick={() => setNotice("Download requested. If it is blocked by the preview, use Copy CSV instead.")} className="inline-flex items-center gap-2 rounded-md bg-[#214B34] px-4 py-2 text-xs font-semibold text-[#FCFCF0]"><Download size={14} /> Save CSV</a><button type="button" onClick={() => void copy()} className="inline-flex items-center gap-2 rounded-md border border-[#C4D2BB] bg-[#FFFEFA] px-4 py-2 text-xs font-semibold text-[#355A3C]">{copied ? <Check size={14} /> : <Clipboard size={14} />}{copied ? "Copied" : "Copy CSV"}</button></div>
      {notice && <p role="status" className="text-xs text-[#516B4A]">{notice}</p>}
    </div>}
    <button type="button" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#355A3B] hover:underline" onClick={onImport}>Back to CSV import <ArrowRight size={13} /></button>
  </section>;
}
