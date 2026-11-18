import type { Metadata } from "next";
import { cookies } from "next/headers";
import { BookwiseApp } from "@/components/BookwiseApp";
import { getInitialHomeData } from "@/lib/home-data";
import { SESSION_COOKIE, userForSessionToken } from "@/lib/auth";
import type { AdminTab } from "@/components/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Catalogue administrator — Bookwise",
  description: "Sign in to import books, download CSV files, and manage the Bookwise catalogue.",
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tool?: string | string[] }> }) {
  const [jar, { tool }, initialHome] = await Promise.all([cookies(), searchParams, getInitialHomeData()]);
  const initialUser = await userForSessionToken(jar.get(SESSION_COOKIE)?.value || "");
  const initialAdminTab: AdminTab = tool === "files" || tool === "catalogue" || tool === "editor" || tool === "roles" ? tool : "csv";
  return <BookwiseApp initialHome={initialHome} initialPage="adm" initialUser={initialUser} initialAdminTab={initialAdminTab} />;
}
