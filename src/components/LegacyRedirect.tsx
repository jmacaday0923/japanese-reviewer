"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LegacyTarget } from "@/lib/study";

type Props = {
  to: LegacyTarget; // where the whole old document went
  anchors: Readonly<Record<string, LegacyTarget>>; // where each of its old headings went
};

const noSubscribe = () => () => {};
const readHash = () => decodeURIComponent(window.location.hash.slice(1));
const noHash = () => null;

// Sends an old /lessons/3#heading link to the study page that has that
// content now, replacing the old address in the history so Back skips it.
// Without JavaScript, the link below does the same job.
export default function LegacyRedirect({ to, anchors }: Props) {
  const router = useRouter();
  const hash = useSyncExternalStore(noSubscribe, readHash, noHash);
  const target = hash && Object.hasOwn(anchors, hash) ? anchors[hash] : to;

  useEffect(() => {
    if (hash !== null) router.replace(target[0]);
  }, [hash, target, router]);

  return (
    <p className="mt-3 text-muted">
      The old documents are now part of the study pages.{" "}
      <Link href={target[0]} className="text-accent-text underline underline-offset-4">
        Go to the new page
      </Link>
    </p>
  );
}
