import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppShell from "@/components/AppShell";
import { ReadingProvider } from "@/components/ReadingPreferences";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Japanese Lesson Reviewer",
    template: "%s | Japanese Lesson Reviewer",
  },
  description:
    "Search and review Japanese lessons: vocabulary, grammar, kana, kanji, exercises and answer keys.",
};

export const viewport: Viewport = {
  themeColor: "#0c0e11",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ReadingProvider><AppShell>{children}</AppShell></ReadingProvider>
      </body>
    </html>
  );
}
