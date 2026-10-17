import { notFound } from "next/navigation";
import rawData from "@/data/lesson-data.json";
import type { LessonData } from "@/types/lesson";
import { documentOutline } from "@/lib/toc";
import ReaderLayout from "@/components/ReaderLayout";
import LessonContent from "@/components/LessonContent";

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

  const meta = [doc.kind, doc.date].filter(Boolean).join(" · ");

  return (
    <ReaderLayout
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Documents", href: "/#documents" },
        { label: doc.title },
      ]}
      title={doc.title}
      meta={meta || undefined}
      outline={documentOutline(doc.toc)}
    >
      {doc.html ? (
        <LessonContent as="article" html={doc.html} className="mt-8" />
      ) : (
        // A document with no content here: show its intro, and a link only if there is one
        <p className="mt-8">
          {doc.intro || "This document has no content here yet."}
          {doc.link && (
            <>
              {" "}
              <a href={doc.link} className="text-accent-text underline underline-offset-4">
                Open it
              </a>
            </>
          )}
        </p>
      )}
    </ReaderLayout>
  );
}
