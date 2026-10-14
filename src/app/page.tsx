import rawData from "@/data/lesson-data.json";
import type { LessonData } from "@/types/lesson";
import Search from "@/components/Search";

const data = rawData as LessonData;

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
      <h1 className="text-3xl font-bold">Japanese Lesson Reviewer</h1>
      <p className="mt-2 text-neutral-400">
        {data.docs.length} documents, {data.items.length} searchable items
      </p>
      <Search />
    </main>
  );
}