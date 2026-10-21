import { notFound } from "next/navigation";
import type { Metadata } from "next";
import CheckpointPage from "@/app/checkpoints/[id]/page";

export const instant = false;
export const metadata: Metadata = {
  title: "Chapter 5 checkpoint",
  alternates: { canonical: "/checkpoints/chapter-5" },
};
export function generateStaticParams() { return [{ id: "1" }]; }
type Props = { params: Promise<{ id: string }> };

// Keep old search results, bookmarks and /lessons/3 links usable.
// Both addresses load the same exam, answers and history.
export default async function PracticePage({ params }: Props) {
  if ((await params).id !== "1") notFound();
  return <CheckpointPage params={Promise.resolve({ id: "chapter-5" })} />;
}
