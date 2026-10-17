import { notFound } from "next/navigation";
import Link from "next/link";
import rawData from "@/data/lesson-data.json";
import type { LessonData } from "@/types/lesson";

const data = rawData as LessonData;

// Tell Next.js every lesson page that exists, so it can build them ahead of time
export function generateStaticParams() {
  return data.docs.map((doc) => ({ n: String(doc.n) }));
}

type Props = { params: Promise<{ n: string }> };

export default async function LessonPage({ params }: Props) {
  const { n } = await params;
  const doc = data.docs.find((d) => d.n === Number(n));
  if (!doc) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-10">
      <Link href="/" className="rounded-control text-sm text-muted transition-colors hover:text-foreground">
        ← Back to search
      </Link>

      <h1 className="mt-4 text-3xl font-bold tracking-tight">{doc.title}</h1>
      <p className="mt-1 text-sm text-subtle">
        {[doc.kind, doc.date].filter(Boolean).join(" · ")}
      </p>

      {doc.html ? (
        // The lesson content is HTML from your own data file, so it is safe to insert
        <article
          className="lesson mt-8"
          dangerouslySetInnerHTML={{ __html: doc.html }}
        />
      ) : (
        // The N5 Practice Exam has no content here; it lives on its own page
        <p className="mt-8">
          {doc.intro}{" "}
          <a href={doc.link} className="text-accent-text underline underline-offset-4">
            Open it
          </a>
        </p>
      )}
    </main>
  );
}
