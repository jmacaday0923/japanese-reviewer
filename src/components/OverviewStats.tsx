import Icon, { type IconName } from "@/components/Icon";

type Stat = { label: string; value: number; icon: IconName };

// A one-line strip of library numbers with thin separators. Still a
// description list, so each number is read with its label. Numbers come from
// the data arrays, so they stay right as lessons are added.
export default function OverviewStats({ stats }: { stats: Stat[] }) {
  return (
    <section aria-labelledby="overview-heading" className="mt-5">
      <h2 id="overview-heading" className="sr-only">Overview</h2>
      {/* Two columns on phones; one row with separators from small tablets up */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:flex sm:flex-wrap sm:items-center sm:gap-x-0">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={
              "flex min-w-0 items-center gap-1.5 sm:pr-5 " + (i > 0 ? "sm:border-l sm:border-border sm:pl-5" : "")
            }
          >
            {/* Shown as icon, number, label; read as label, then number */}
            <dt className="order-3 text-muted">{s.label}</dt>
            <dd className="order-2 font-semibold tabular-nums text-foreground">
              {s.value.toLocaleString("en-US")}
            </dd>
            <Icon name={s.icon} className="order-1 mr-0.5 size-4 text-accent-text" />
          </div>
        ))}
      </dl>
    </section>
  );
}
