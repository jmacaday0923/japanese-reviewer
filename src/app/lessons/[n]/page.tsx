import { notFound } from "next/navigation";
import rawLinks from "@/data/legacy-links.json";
import type { LegacyLinks } from "@/lib/study";
import LegacyRedirect from "@/components/LegacyRedirect";

// The old document pages, /lessons/1 to /lessons/20. Their content now lives
// in the chapter, kana, kanji and practice pages, so each address just sends
// you on. The #heading part of an old link never reaches the server, so the
// browser picks the exact spot from this document's map.
// JSON arrays come in as plain arrays, so the [href, anchor, label] shape is asserted here
const links = rawLinks as unknown as LegacyLinks;

export function generateStaticParams() {
  return Object.keys(links).map((n) => ({ n }));
}

// Like the study pages, this page is all URL data, so it can't come from the
// shared shell that links prefetch. It's prerendered, so the wait is short.
export const instant = false;

type Props = { params: Promise<{ n: string }> };

export default async function OldDocumentPage({ params }: Props) {
  const { n } = await params;
  const doc = Object.hasOwn(links, n) ? links[n] : undefined;
  if (!doc) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">This page has moved</h1>
      {/* Only this document's map reaches the browser */}
      <LegacyRedirect to={doc.to} anchors={doc.anchors} />
    </main>
  );
}
