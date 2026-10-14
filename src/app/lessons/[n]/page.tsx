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
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-100">
          ← Back to search
        </Link>

        <h1 className="mt-4 text-3xl font-bold">{doc.title}</h1>
        <p className="mt-1 text-sm text-neutral-500">
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
            <a href={doc.link} className="underline">
              Open it
            </a>
          </p>
        )}
      </div>
    </main>
  );
}
