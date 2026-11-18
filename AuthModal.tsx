"use client";

import { useEffect, useState } from "react";
import { BookOpen, KeyRound, ShieldCheck, X } from "lucide-react";
import { apiRequest, type AuthResult } from "./types";

type AuthMode = "login" | "register" | "reset";

interface AuthModalProps {
  open: boolean;
  initialPrompt?: string;
  intent?: "default" | "admin";
  onClose: () => void;
  onAuthenticated: (result: AuthResult) => Promise<void>;
}

export function AuthModal({
  open,
  initialPrompt = "",
  intent = "default",
  onClose,
  onAuthenticated,
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
  const [registerAsAdmin, setRegisterAsAdmin] = useState(false);
  const [message, setMessage] = useState(initialPrompt);
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    apiRequest<{ hasAdmin: boolean }>("/auth-status")
      .then((res) => {
        if (cancelled) return;
        setHasAdmin(res.hasAdmin);
        if (!res.hasAdmin && intent === "admin") {
          setMode("register");
          setRegisterAsAdmin(true);
          setIsSuccess(true);
          setMessage(
            "No admin account exists yet. Create your Admin account with your own username and password."
          );
        }
      })
      .catch(() => {
        if (!cancelled) setHasAdmin(true);
      });

    return () => {
      cancelled = true;
    };
  }, [open, intent]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleLogin = async (name: string, secret: string) => {
    setLoading(true);
    setIsSuccess(false);
    setMessage("");
    try {
      const data = await apiRequest<AuthResult>("/login", {
        method: "POST",
        body: JSON.stringify({
          username: name.trim(),
          password: secret,
          adminOnly: intent === "admin",
        }),
      });
      await onAuthenticated(data);
      setPassword("");
      setSecurityAnswer("");
      onClose();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    setIsSuccess(false);
    setMessage("");
    try {
      const data = await apiRequest<AuthResult>("/register", {
        method: "POST",
        body: JSON.stringify({
          username: username.trim(),
          password,
          securityAnswer,
          registerAsAdmin: hasAdmin === false ? registerAsAdmin : false,
        }),
      });
      await onAuthenticated(data);
      setPassword("");
      setSecurityAnswer("");
      onClose();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setLoading(true);
    setIsSuccess(false);
    setMessage("");
    try {
      await apiRequest<{ ok: boolean }>("/reset-password", {
        method: "POST",
        body: JSON.stringify({
          username: username.trim(),
          securityAnswer,
          newPassword: password,
        }),
      });
      setIsSuccess(true);
      setMode("login");
      setPassword("");
      setSecurityAnswer("");
      setMessage(
        "Password reset successfully. You can now log in with your new password."
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Password reset failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    const values = new FormData(e.currentTarget);
    if (mode === "login") void handleLogin(String(values.get("username") || ""), String(values.get("password") || ""));
    else if (mode === "register") handleRegister();
    else handleResetPassword();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Account authentication"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B2418]/60 p-4 backdrop-blur-[2px]"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#DCE2DA] bg-[#F8F7F2] p-6 sm:p-7 shadow-2xl">
        {/* Top dark green + tomato red bookmark accent */}
        <div className="absolute inset-x-0 top-0 flex h-1">
          <span className="flex-1 bg-[#123524]" />
          <span className="w-12 bg-[#D9381E]" />
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close login modal"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-[#DCE2DA] bg-[#FDFDF9] text-[#4A5D52] transition-colors hover:border-[#D9381E] hover:text-[#D9381E]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 text-[#123524]">
          <BookOpen className="h-4.5 w-4.5" />
          <span className="text-xs font-bold uppercase tracking-[0.16em]">
            {intent === "admin" ? "Bookwise Admin" : "Bookwise Reader Club"}
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-[#D9381E]" />
        </div>

        <h2 className="mt-2 font-serif text-2xl font-semibold text-[#123524]">
          {mode === "login"
            ? intent === "admin" ? "Admin sign in" : "Welcome back"
            : mode === "register"
            ? registerAsAdmin && hasAdmin === false
              ? "Set up your Admin account"
              : "Create your account"
            : "Reset your password"}
        </h2>

        {/* Reader registration is not an alternative to admin sign-in. */}
        {(intent !== "admin" || hasAdmin === false) && <div className="mt-4 grid grid-cols-2 rounded-lg border border-[#DCE2DA] bg-[#F0EFE7] p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setMessage("");
              setIsSuccess(false);
            }}
            className={`rounded-md py-1.5 transition-colors ${
              mode === "login"
                ? "bg-[#123524] text-[#F8F7F2] shadow-xs"
                : "text-[#4A5D52] hover:text-[#123524]"
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setMessage("");
              setIsSuccess(false);
            }}
            className={`rounded-md py-1.5 transition-colors ${
              mode === "register"
                ? "bg-[#123524] text-[#F8F7F2] shadow-xs"
                : "text-[#4A5D52] hover:text-[#123524]"
            }`}
          >
            Register
          </button>
        </div>}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label
              htmlFor="u"
              className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#4A5D52] mb-1"
            >
              Username
            </label>
            <input
              id="u" name="username"
              type="text"
              autoComplete="username" autoCapitalize="none" spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={
                mode === "register" ? "Choose your username" : "Enter your username"
              }
              required
              className="w-full rounded-lg border border-[#DCE2DA] bg-[#FDFDF9] px-3.5 py-2.5 text-sm text-[#10231A] placeholder:text-[#78897F] focus:border-[#123524] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="pw"
              className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#4A5D52] mb-1"
            >
              {mode === "reset" ? "New Password (min 4 chars)" : "Password"}
            </label>
            <input
              id="pw" name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                mode === "login"
                  ? "Enter your password"
                  : "Create a password (min 4 characters)"
              }
              required
              className="w-full rounded-lg border border-[#DCE2DA] bg-[#FDFDF9] px-3.5 py-2.5 text-sm text-[#10231A] placeholder:text-[#78897F] focus:border-[#123524] focus:outline-none"
            />
          </div>

          {(mode === "register" || mode === "reset") && (
            <div>
              <label
                htmlFor="sa"
                className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#4A5D52] mb-1"
              >
                Security Answer{" "}
                <span className="font-normal normal-case text-[#78897F]">
                  (favourite book or secret word)
                </span>
              </label>
              <input
                id="sa"
                type="text"
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                placeholder="Used if you ever forget your password"
                required
                className="w-full rounded-lg border border-[#DCE2DA] bg-[#FDFDF9] px-3.5 py-2.5 text-sm text-[#10231A] placeholder:text-[#78897F] focus:border-[#123524] focus:outline-none"
              />
            </div>
          )}

          {/* First-time Admin Setup toggle — only shown until the first Admin registers */}
          {mode === "register" && hasAdmin === false && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#DCE2DA] bg-[#F0EFE7] p-3 text-xs text-[#24382E]">
              <input
                type="checkbox"
                checked={registerAsAdmin}
                onChange={(e) => setRegisterAsAdmin(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#DCE2DA] accent-[#123524]"
              />
              <span className="leading-snug">
                <span className="inline-flex items-center gap-1 font-semibold text-[#123524]">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#D9381E]" />
                  Register as Admin account
                </span>
                <span className="block text-[11px] text-[#4A5D52] mt-0.5">
                  One-time initial setup so you can manage the catalogue with your own credentials.
                </span>
              </span>
            </label>
          )}

          {message && (
            <div
              id="ae" role={isSuccess ? "status" : "alert"}
              className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                isSuccess
                  ? "border-[#123524]/25 bg-[#123524]/8 text-[#123524]"
                  : "border-[#D9381E]/30 bg-[#D9381E]/8 text-[#B82D16]"
              }`}
            >
              {message}
            </div>
          )}

          <div className="pt-1 flex flex-col gap-2">
            {mode === "login" && (
              <button
                id="login-btn"
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#123524] py-2.5 text-sm font-semibold text-[#F8F7F2] transition-colors hover:bg-[#0B2418] disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Log in"}
              </button>
            )}

            {mode === "register" && (
              <button
                id="reg-btn"
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#123524] py-2.5 text-sm font-semibold text-[#F8F7F2] transition-colors hover:bg-[#0B2418] disabled:opacity-60"
              >
                {loading
                  ? "Creating account..."
                  : registerAsAdmin && hasAdmin === false
                  ? "Create Admin account"
                  : "Register"}
              </button>
            )}

            {mode === "reset" && (
              <button
                id="rb"
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#D9381E] py-2.5 text-sm font-semibold text-[#F8F7F2] transition-colors hover:bg-[#BD2E16] disabled:opacity-60"
              >
                {loading ? "Resetting..." : "Reset password"}
              </button>
            )}
          </div>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs text-[#4A5D52]">
          {mode !== "reset" ? (
            <button
              type="button"
              onClick={() => {
                setPassword("");
                setMode("reset");
                setIsSuccess(false);
                setMessage(
                  "Enter your username, security answer, and a new password below."
                );
              }}
              className="inline-flex items-center gap-1 font-medium text-[#4A5D52] transition-colors hover:text-[#D9381E]"
            >
              <KeyRound className="h-3.5 w-3.5" />
              Forgot password?
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setMessage("");
              }}
              className="font-medium text-[#123524] hover:underline"
            >
              ← Back to log in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
