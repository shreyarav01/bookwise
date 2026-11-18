"use client";

import { useRef, useState, type RefObject } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, ClipboardList, Download, FileSpreadsheet, FileUp, LoaderCircle, ShieldCheck, Sparkles, Upload, X } from "lucide-react";
import type { CatalogueUpload } from "./useCatalogueUpload";
import type { User } from "./types";
import styles from "./CatalogueStudio.module.css";

interface Props {
  upload: CatalogueUpload;
  user: User;
  fileRef: RefObject<HTMLInputElement | null>;
  onFiles: () => void;
  onAuthNeeded: (status?: number) => void;
  onBrowse: () => void;
  onOpenBook: (id: string) => void;
}
const sources = [
  { id: "file", title: "Upload file", icon: FileUp },
  { id: "paste", title: "Paste CSV", icon: ClipboardList },
  { id: "sample", title: "Use sample", icon: Sparkles },
] as const;

function RowTable({ upload }: { upload: CatalogueUpload }) {
  const [page, setPage] = useState(0);
  const { draft, plan, saving, mode, setMode } = upload;
  if (!draft || !plan) return null;
  const last = Math.ceil(plan.entries.length / 5) - 1;
  const index = Math.min(page, last);
  return <>
    <div className={styles.reviewScroll} tabIndex={0} aria-label="CSV row preview"><table className={styles.reviewTable}>
      <caption className="sr-only">Rows from {draft.file.name}</caption>
      <thead><tr><th>#</th><th>Book / author</th><th>Genre</th><th>Status</th></tr></thead>
      <tbody>{plan.entries.slice(index * 5, index * 5 + 5).map(({ row, book, status }) => <tr key={row}><td>{row}</td><td><strong>{book.title || "Missing title"}</strong><small>{book.author || "Missing author"}</small></td><td>{book.genre || "Missing genre"}</td><td><span className={`${styles.rowStatus} ${status === "missing" ? styles.warning : status === "duplicate" ? styles.dim : ""}`}>{{ add: "Ready", update: "Update", missing: "Missing field", duplicate: "Duplicate" }[status]}</span></td></tr>)}</tbody>
    </table></div>
    {last > 0 && <div className={styles.pagination}><span>Page {index + 1} of {last + 1} · {plan.entries.length} rows</span><button type="button" className={styles.iconAction} aria-label="Previous preview rows" disabled={!index} onClick={() => setPage(index - 1)}><ChevronLeft size={15} /></button><button type="button" className={styles.iconAction} aria-label="Next preview rows" disabled={index === last} onClick={() => setPage(index + 1)}><ChevronRight size={15} /></button></div>}
    <div className={styles.duplicateRule}><label htmlFor="studio-duplicate-mode">Existing books</label><select id="studio-duplicate-mode" value={mode} disabled={saving} onChange={e => setMode(e.target.value === "update" ? "update" : "skip")}><option value="skip">Skip duplicates</option><option value="update">Update supplied fields</option></select></div>
    <p className={styles.importSummary} aria-live="polite">{plan.counts.add} new · {plan.counts.update} to update · {plan.counts.duplicate + plan.counts.missing} to skip</p>
    {!plan.changes && <p role="status" className={styles.noChanges}>{plan.counts.duplicate ? "These titles are already in the catalogue. Choose ‘Update supplied fields’ to update them, or select a different file." : "No rows are ready to import. Add the missing title, author or genre and preview again."}</p>}
  </>;
}

export function CatalogueStudio({ upload, user, fileRef, onFiles, onAuthNeeded, onBrowse, onOpenBook }: Props) {
  const [source, setSource] = useState<"file" | "paste" | "sample">("file");
  const [paste, setPaste] = useState("");
  const [view, setView] = useState<"source" | "review" | "confirm">("source");
  const [changing, setChanging] = useState(false);
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const { draft, receipt, plan, reading, saving } = upload;
  const busy = reading || saving;
  const stage = receipt ? 3 : draft && !changing ? view === "confirm" ? 3 : 2 : 1;
  const preview = (file: File) => { setChanging(false); setView("review"); void upload.select(file); };
  const choose = () => { if (!busy) fileRef.current?.click(); };
  const switchSource = (method: typeof source) => {
    setSource(method); upload.setError("");
    if (method === "sample") {
      upload.reset(); setChanging(false); setView("review"); void upload.sample();
    } else if (method === "paste") {
      if (receipt) upload.reset();
      setChanging(true); setView("source");
      requestAnimationFrame(() => document.getElementById("ct")?.focus());
    } else choose();
  };
  const stepTo = (next: number) => {
    if (busy) return;
    upload.setError("");
    if (next === 1) {
      if (receipt) upload.reset();
      setView("source"); setChanging(true); setSource("file");
      if (stage === 1 || receipt) choose();
      return;
    }
    if (receipt) { if (next === 2) onBrowse(); else document.getElementById("csv-receipt")?.focus(); return; }
    if (!draft || !plan) { upload.setError("First choose a CSV file, paste some rows, or select Use sample."); return; }
    if (next === 3 && !plan.changes) { setChanging(false); setView("review"); upload.setError("There are no changes to confirm. Check the row statuses and duplicate setting below."); return; }
    setChanging(false); setView(next === 2 ? "review" : "confirm");
  };
  const clear = () => { upload.reset(); setView("source"); setChanging(false); setSource("file"); setPaste(""); };
  const replaceButton = <button type="button" className={styles.textAction} onClick={choose} disabled={busy}>Replace file</button>;
  return <div className={styles.studio}>
    <input ref={fileRef} id="bookwise-csv-file" type="file" name="file" accept=".csv,text/csv,application/csv" aria-label="Choose a catalogue CSV file" className="sr-only" tabIndex={-1} disabled={busy} onChange={e => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (f) preview(f); }} />
    <div className={styles.grid}><section className={styles.uploadCard} aria-labelledby="studio-file-heading" aria-busy={busy}>
      <div className={styles.panelHeading}><div><div className={styles.sectionKicker}><span /> CATALOGUE IMPORT</div><h2 id="studio-file-heading" className={styles.cardTitle}>{receipt ? "Import complete" : stage === 3 ? "Confirm your import" : stage === 2 ? "Review your books" : "Import your books"}</h2></div><span className={styles.stepLabel}>STEP 0{stage} <i>/</i> 03</span></div>
      <div className={`${styles.access} ${styles.accessActive}`} role="status"><span className={styles.accessMark}><ShieldCheck size={17} /></span><div><strong>Admin session active</strong><small>Signed in as {user.username}</small></div></div>
      <nav aria-label="CSV import steps" className={styles.workflowNav}>{(receipt ? ["New import", "View catalogue", "Receipt"] : ["Upload file", "Review rows", "Import books"]).map((label, i) => <button type="button" key={label} aria-label={`Step ${i + 1}: ${label}`} aria-current={stage === i + 1 ? "step" : undefined} onClick={() => stepTo(i + 1)} disabled={busy} className={stage === i + 1 ? styles.workflowCurrent : ""}><span>{receipt || i + 1 < stage ? <Check size={11} /> : i + 1}</span>{label}</button>)}</nav>
        <p className={styles.sourceLabel}>{receipt ? "Add another book list" : "Choose how to add your book list"}</p>
        <div className={styles.sourceTabs} role="group" aria-label="CSV input methods">{sources.map(({ id, title, icon: Icon }) => <button key={id} type="button" aria-pressed={source === id} disabled={busy} onClick={() => switchSource(id)}><Icon size={15} />{title}</button>)}</div>

      {receipt ? <div className={styles.success} id="csv-receipt" tabIndex={-1} role="status"><span className={styles.successCheck}><CircleCheck size={28} /></span><h3>{receipt.imported || receipt.updated ? "Books saved to your catalogue." : "Your catalogue is already up to date."}</h3><p>{receipt.message}</p><small>{receipt.fileName}</small>
        {Boolean(receipt.importedBooks?.length) && <ul className={styles.savedTitles}>{receipt.importedBooks?.map(b => <li key={b.id}><button type="button" onClick={() => onOpenBook(b.id)}>{b.title}<ArrowUpRight size={12} /></button></li>)}</ul>}
        <div><button type="button" className={styles.primary} onClick={onBrowse}>View catalogue <ArrowRight size={14} /></button><button type="button" className={styles.textAction} onClick={clear}>Start another import</button></div>
      </div> : stage === 1 ? <div className={styles.sourcePanel}>
        {source === "paste" ? <div className={styles.pasteBox}><label htmlFor="ct">Paste the header and book rows below.</label><textarea id="ct" rows={6} value={paste} onChange={e => { setPaste(e.target.value); upload.setError(""); }} placeholder={"title,author,genre\nThe Hobbit,J.R.R. Tolkien,Fantasy"} /><button type="button" disabled={!paste.trim() || busy} onClick={() => preview(new File([paste], "pasted-books.csv", { type: "text/csv" }))}>Preview pasted rows <ArrowRight size={14} /></button></div>
        : <label htmlFor="bookwise-csv-file" role="button" aria-label="Choose CSV file" aria-disabled={busy} tabIndex={busy ? -1 : 0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); } }} className={`${styles.dropzone} ${over ? styles.dragging : ""}`} onDragEnter={e => { e.preventDefault(); depth.current++; setOver(true); }} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }} onDragLeave={e => { e.preventDefault(); if (--depth.current <= 0) { depth.current = 0; setOver(false); } }} onDrop={e => { e.preventDefault(); depth.current = 0; setOver(false); if (busy) return; if (e.dataTransfer.files.length !== 1) { upload.setError("Drop one .csv file at a time."); return; } preview(e.dataTransfer.files[0]); }}>
          <span className={styles.sheetIcon}>{reading ? <LoaderCircle size={25} className={styles.spin} /> : <FileSpreadsheet size={25} strokeWidth={1.5} />}</span>
          <h3>{reading ? "Reading your book list…" : over ? "Drop your CSV here" : "Drag & drop a CSV file"}</h3><p>or choose it from your device</p>
          <span className={styles.primary}><Upload size={15} /> Choose CSV file</span><small>CSV files <span>·</span> Up to 10 MB</small>
        </label>}
        {draft && <button type="button" className={styles.returnLink} onClick={() => stepTo(2)}>Return to {draft.file.name} <ArrowRight size={14} /></button>}
        <p className={styles.sourceFoot}>Your catalogue won’t change until you confirm the import.</p>
      </div> : draft && plan ? <div className={styles.review}>
        <div className={styles.fileRow}><span className={styles.fileIcon}><FileSpreadsheet size={20} /></span><div className={styles.fileMeta}><strong>{draft.file.name}</strong><span>{plan.entries.length.toLocaleString()} rows · {Math.max(.1, draft.file.size / 1024).toFixed(1)} KB</span></div>{replaceButton}<button type="button" disabled={busy} aria-label="Remove selected file" className={styles.iconAction} onClick={clear}><X size={15} /></button></div>
        {stage === 2 ? <><RowTable key={`${draft.file.lastModified}-${draft.file.size}`} upload={upload} /><div className={styles.reviewActions}><button type="button" className={styles.primary} disabled={busy || !plan.changes} onClick={() => stepTo(3)}>Continue to import <ArrowRight size={15} /></button><button type="button" className={styles.textAction} onClick={() => stepTo(1)}>Change source</button></div></>
        : <><p className={styles.confirmIntro}>Ready to save these changes?</p><div className={styles.countGrid}>{[["New books", plan.counts.add], ["Updates", plan.counts.update], ["Skipped", plan.counts.duplicate + plan.counts.missing]].map(([label, count]) => <div key={label}><strong>{count}</strong><span>{label}</span></div>)}</div>
          <p className={styles.importSummary}>Existing titles are matched by title and author. {upload.mode === "update" ? "Only supplied fields will be updated." : "Duplicates will be left unchanged."}</p>
          {saving && <div role="status" className={styles.transfer}><div><LoaderCircle size={14} className={styles.spin} />{upload.progress < 100 ? `Uploading · ${upload.progress}%` : "Saving books to your catalogue…"}</div><progress aria-label="Upload progress" value={upload.progress} max={100} /></div>}
          <div className={styles.reviewActions}><button type="button" className={styles.primary} disabled={busy || !plan.changes} onClick={() => user.isAdmin ? void upload.commit() : onAuthNeeded(403)}><CheckCheck size={16} />{saving ? "Importing…" : `Import ${plan.changes} ${plan.changes === 1 ? "book" : "books"}`}</button><button type="button" className={styles.returnLink} disabled={busy} onClick={() => stepTo(2)}><ArrowLeft size={14} /> Back to review</button></div>
        </>}
      </div> : null}
      {upload.error && <p className={styles.error} role="alert"><AlertCircle size={16} />{upload.error}</p>}
    </section>
    <aside className={styles.guide} aria-labelledby="csv-guide-title"><div className={styles.guideKicker}><BookOpen size={15} /> FIELD REFERENCE</div><h2 id="csv-guide-title" className={styles.cardTitle}>CSV format guide</h2><p className={styles.muted}>Include a header row and these three columns. Use one row per book.</p>
      <dl className={styles.fields}>{[["title", "The name of the book"], ["author", "The author’s name"], ["genre", "The book’s category"]].map(([key, label]) => <div key={key}><dt><code>{key}</code></dt><dd>{label}</dd></div>)}</dl>
      <details className={styles.optional}><summary>Optional columns <ChevronDown size={14} /></summary><p>rating, price, year, synopsis, publisher, pages, language, isbn, aboutauthor, coverpage</p><p>Name, Authors and Category are also recognized. Export Excel workbooks as CSV before uploading.</p></details>
      <button type="button" className={styles.template} onClick={onFiles}><Download size={15} /> Get CSV template <span className={styles.fileTag}>.CSV</span></button>
    </aside></div>
  </div>;
}
