import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bookwise — Discover Your Next Great Read",
  description:
    "Explore bestsellers and new releases, search books by meaning with TF-IDF similarity, rate and wishlist favourites, view catalogue trend insights, and get personalised recommendations.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${jakarta.variable}`}>
      <body className="min-h-screen bg-[#F8F7F2] font-sans text-[#10231A] antialiased selection:bg-[#123524] selection:text-[#F8F7F2]">
        {children}
      </body>
    </html>
  );
}
