import Link from "next/link";
import rawData from "@/data/lesson-data.json";
import type { LessonData } from "@/types/lesson";
import Search from "@/components/Search";

const data = rawData as LessonData;

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold">Japanese Lesson Reviewer</h1>
        <p className="mt-2 text-neutral-400">
          {data.docs.length} documents, {data.items.length} searchable items
        </p>

        <Search />

        <section className="mt-12">
          <h2 className="text-xl font-semibold">Lessons</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {data.docs.map((doc) => (
              <li key={doc.n}>
                <Link
                  href={`/lessons/${doc.n}`}
                  className="block h-full rounded-lg bg-neutral-900 p-4 border border-transparent hover:border-neutral-600"
                >
                  <p className="text-xs text-neutral-500">
                    {[doc.kind, doc.date].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-1 font-medium">{doc.title}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
