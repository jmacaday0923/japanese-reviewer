type Stat = { label: string; value: number };

// A one-line strip of library numbers. Still a description list, so each
// number is read with its label. Numbers come from the data arrays, so they
// stay right as lessons are added.
export default function OverviewStats({ stats }: { stats: Stat[] }) {
  return (
    <section aria-labelledby="overview-heading">
      <h2 id="overview-heading" className="sr-only">Overview</h2>
      <dl className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {stats.map((s) => (
          <div key={s.label} className="flex items-baseline gap-1.5">
            <dt className="text-muted">{s.label}</dt>
            <dd className="order-first font-semibold tabular-nums text-foreground">
              {s.value.toLocaleString("en-US")}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
