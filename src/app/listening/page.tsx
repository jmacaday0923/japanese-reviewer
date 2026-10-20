import type { Metadata } from "next";
import Breadcrumbs from "@/components/Breadcrumbs";
import ListeningShelf from "@/components/ListeningShelf";
export const metadata: Metadata = { title: "Listening exams" };
export default function ListeningPage() {
  return <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-10">
    <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Listening" }]} />
    <h1 className="mt-8 text-3xl font-semibold tracking-tight">Listening exams</h1>
    <p className="mt-3 max-w-2xl text-muted">Work through recorded conversations and picture questions at your own pace. Submit when you are ready to review your answers.</p>
    <ListeningShelf />
  </main>;
}
