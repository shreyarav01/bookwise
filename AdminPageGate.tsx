"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Download, Eye, EyeOff, FileUp, KeyRound, LibraryBig, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { apiRequest, type AdminTab, type AuthResult, type User } from "./types";

interface AdminPageGateProps {
  currentUser: User | null;
  selectedTask: AdminTab;
  onSelectTask: (task: AdminTab) => void;
  onAuthenticated: (result: AuthResult) => Promise<void>;
  onLogout: () => Promise<void>;
}
const tasks = [
  { id: "csv", icon: FileUp, title: "Import books", text: "Upload a CSV, paste your rows, or use a sample." },
  { id: "files", icon: Download, title: "CSV downloads", text: "Get a template or export your whole catalogue." },
  { id: "catalogue", icon: LibraryBig, title: "Manage books", text: "Add editions, edit details and update covers." },
] as const;

export function AdminPageGate({ currentUser, selectedTask, onSelectTask, onAuthenticated }: AdminPageGateProps) {
  const [hasAdmin, setHasAdmin] = useState(true);
  const [mode, setMode] = useState<"login" | "setup" | "reset">("login");
  const [username, setUsername] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);
  const task = tasks.find(t => t.id === selectedTask) || tasks[2];
  useEffect(() => {
    let active = true;
    apiRequest<{ hasAdmin: boolean }>("/auth-status").then(r => {
      if (!active) return;
      setHasAdmin(r.hasAdmin);
      if (!r.hasAdmin) setMode("setup");
    }).catch(() => { if (active) setNote({ text: "Setup status is unavailable. You can still sign in with an existing admin account." }); });
    return () => { active = false; };
  }, []);
  const selectTask = (id: AdminTab) => {
    onSelectTask(id);
    setNote(null);
    nameInput.current?.focus({ preventScroll: true });
    form.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  const switchMode = (value: typeof mode) => {
    setMode(value); setNote(null); setReveal(false);
    const pw = form.current?.elements.namedItem("password");
    if (pw instanceof HTMLInputElement) pw.value = "";
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    const values = new FormData(event.currentTarget);
    const name = String(values.get("username") || "").trim();
    const password = String(values.get("password") || "");
    const securityAnswer = String(values.get("securityAnswer") || "").trim();
    submitting.current = true; setBusy(true); setNote(null);
    try {
      if (mode === "reset") {
        await apiRequest("/reset-password", { method: "POST", body: JSON.stringify({ username: name, securityAnswer, newPassword: password }) });
        switchMode("login"); setNote({ text: "Password updated. Sign in with your new password." });
      } else {
        const result = await apiRequest<AuthResult>(mode === "setup" ? "/register" : "/login", { method: "POST", body: JSON.stringify({ username: name, password, ...(mode === "setup" ? { securityAnswer, registerAsAdmin: true } : { adminOnly: true }) }) });
        await onAuthenticated(result);
      }
    } catch (e) { setNote({ text: e instanceof Error ? e.message : "Could not sign in. Please try again.", error: true }); }
    finally { submitting.current = false; setBusy(false); }
  };
  const field = "w-full rounded-lg border border-[#CAD4C6] bg-[#FCFCF7] px-3.5 py-2.5 text-sm text-[#173D2C] placeholder:text-[#798378] focus:border-[#295C41] focus:outline-none focus:ring-2 focus:ring-[#295C41]/10";
  return <div id="adm" className="mx-auto max-w-5xl py-2 sm:py-5">
    <div className="mb-7 border-b border-[#D7DFD0] pb-5">
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.17em] text-[#496541]"><span className="h-0.5 w-5 bg-[#C96648]" /> BOOKWISE ADMIN</p>
      <h1 className="mt-2 font-serif text-4xl font-medium tracking-[-.045em] text-[#173F2E] sm:text-5xl">Catalogue workspace<span className="text-[#C96648]">.</span></h1>
    </div>
    <div className="grid items-start gap-6 md:grid-cols-[1fr_1.05fr]">
      <section aria-labelledby="admin-tools-heading" className="min-w-0 py-1">
        <h2 id="admin-tools-heading" className="font-serif text-2xl font-medium tracking-tight text-[#173F2E]">Choose a workspace</h2>
        <p className="mt-1 mb-4 text-[13px] leading-relaxed text-[#586858]">Select a tool. We’ll open it as soon as you sign in.</p>
        <div className="grid gap-2.5">{tasks.map(({ id, icon: Icon, title, text }) => {
          const selected = task.id === id;
          return <button key={id} type="button" aria-pressed={selected} onClick={() => selectTask(id)} disabled={busy}
            className={`group flex w-full items-center gap-3.5 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[#436B46] ${selected ? "border-[#8FA78D] bg-[#ECF1E5]" : "border-[#D9DFD2] bg-[#FFFEF8] hover:border-[#98AE91]"}`}>
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${selected ? "bg-[#1E4632] text-[#F7F7EB]" : "bg-[#EAF0E2] text-[#38583D]"}`}><Icon size={19} strokeWidth={1.65} /></span>
            <span className="min-w-0 flex-1"><strong className="block text-sm text-[#183C2A]">{title}</strong><small className="mt-0.5 block text-xs leading-relaxed text-[#586858]">{text}</small></span>
            {selected ? <Check size={16} className="shrink-0 text-[#466947]" /> : <ArrowRight size={15} className="shrink-0 text-[#70816B]" />}
          </button>;
        })}</div>
        <p className="mt-4 flex items-center gap-2 text-xs text-[#647261]"><LockKeyhole size={13} /> Administrator access required.</p>
      </section>
      <section className="relative min-w-0 overflow-hidden rounded-xl border border-[#D4DDCF] bg-[#FFFEF9] p-6 shadow-sm sm:p-7" aria-labelledby="admin-access-title">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-[#244A34]"><span className="absolute inset-y-0 right-6 w-7 bg-[#CB694D]" /></div>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-[#596E52]"><ShieldCheck size={15} /> Administrator access</div>
        <h2 id="admin-access-title" className="mt-2 font-serif text-[27px] font-medium tracking-tight text-[#173F2E]">{mode === "setup" ? "Set up your admin account" : mode === "reset" ? "Reset your password" : "Admin sign in"}</h2>
        <p className="mt-1 text-xs leading-relaxed text-[#596957]">{mode === "login" ? <>Sign in to continue to <strong className="text-[#345739]">{task.title}</strong>.</> : mode === "reset" ? "Use your security answer to choose a new password." : "Choose the credentials you’ll use to manage your catalogue."}</p>
        {currentUser && !currentUser.isAdmin && <p role="status" className="mt-3 rounded-md border border-[#DEDCC9] bg-[#F8F4E9] p-2.5 text-xs text-[#6F614A]">Signed in as Reader ({currentUser.username}). Enter your admin credentials below to switch accounts.</p>}
        <form ref={form} method="post" onSubmit={submit} className="mt-5 space-y-3.5">
          <fieldset disabled={busy} className="space-y-3.5">
            <div><label htmlFor="admin-u" className="mb-1.5 block text-xs font-semibold text-[#36503C]">Admin username</label>
              <input ref={nameInput} id="admin-u" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={username} onChange={e => setUsername(e.target.value)} placeholder="Your admin username" className={field} />
            </div>
            <div><label htmlFor="admin-pw" className="mb-1.5 block text-xs font-semibold text-[#36503C]">{mode === "reset" ? "New password" : "Password"}</label>
              <div className="relative"><input id="admin-pw" name="password" type={reveal ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? undefined : 4} required placeholder={mode === "login" ? "Your password" : "At least 4 characters"} className={`${field} pr-11`} />
                <button type="button" aria-label={reveal ? "Hide password" : "Show password"} onClick={() => setReveal(!reveal)} className="absolute inset-y-0 right-1.5 grid w-8 place-items-center text-[#657760]">{reveal ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </div>
            {mode !== "login" && <div><label htmlFor="admin-sa" className="mb-1.5 block text-xs font-semibold text-[#36503C]">Security answer</label><input id="admin-sa" name="securityAnswer" type="password" autoComplete="off" required placeholder="Your recovery word" className={field} /></div>}
          </fieldset>
          {note && <p role={note.error ? "alert" : "status"} className={`rounded-lg border p-3 text-xs leading-relaxed ${note.error ? "border-[#E7CCBD] bg-[#FBF0E8] text-[#93442E]" : "border-[#D4DFCB] bg-[#EFF5E9] text-[#38593A]"}`}>{note.text}</p>}
          <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1C432F] px-4 py-2.5 text-sm font-semibold text-[#FAFAF1] hover:bg-[#102E20] disabled:opacity-60">
            {busy ? <><LoaderCircle size={16} className="animate-spin" /> {mode === "login" ? "Signing in…" : "Please wait…"}</> : mode === "login" ? <>Sign in to Admin <ArrowRight size={15} /></> : mode === "setup" ? "Create admin account" : "Reset password"}
          </button>
        </form>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-medium text-[#4A654A]">
          {mode === "login" ? <button type="button" disabled={busy} onClick={() => switchMode("reset")} className="inline-flex items-center gap-1.5 hover:underline"><KeyRound size={13} /> Forgot password?</button> : <button type="button" disabled={busy} onClick={() => switchMode("login")} className="hover:underline">Back to sign in</button>}
          {!hasAdmin && mode !== "setup" && <button type="button" disabled={busy} onClick={() => switchMode("setup")} className="hover:underline">First-time admin setup</button>}
        </div>
      </section>
    </div>
  </div>;
}
