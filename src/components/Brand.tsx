import Link from "next/link";

// The site name with its mark: 学 (study) on a blue square. At the top of the
// desktop sidebar the name takes two lines; in the phone header, one.
export default function Brand({ stacked = false }: { stacked?: boolean }) {
  return (
    <Link
      href="/"
      className="flex min-h-10 items-center gap-3 rounded-control px-2 font-semibold leading-tight tracking-tight text-foreground"
    >
      {/* Decorative: the words beside it name the link */}
      <span
        aria-hidden="true"
        className={
          "flex shrink-0 items-center justify-center rounded-[0.5rem] bg-accent font-medium leading-none text-accent-foreground " +
          (stacked ? "size-9 text-lg" : "size-7 text-[0.9375rem]")
        }
      >
        学
      </span>
      {stacked ? (
        <span className="text-[0.9375rem]">
          <span className="block">Japanese</span> <span className="block">Lesson Reviewer</span>
        </span>
      ) : (
        <span>Japanese Lesson Reviewer</span>
      )}
    </Link>
  );
}
