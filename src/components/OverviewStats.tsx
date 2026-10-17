type Stat = { label: string; value: number };

// Numbers come from the data arrays, so they stay right as lessons are added
export default function OverviewStats({ stats }: { stats: Stat[] }) {
  return (
    <section aria-labelledby="overview-heading" className="mt-8">
      <h2 id="overview-heading" className="sr-only">Overview</h2>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col rounded-card border border-border bg-surface p-4">
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className="order-first text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">
              {s.value.toLocaleString("en-US")}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
