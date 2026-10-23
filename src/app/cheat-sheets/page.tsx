import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import CheatSheetTabs from "@/components/CheatSheetTabs";
import { FORM_LABELS, PARTICLE_ROWS, PARTICLE_RULE, SENTENCE_EXAMPLE, VERB_GROUPS } from "@/lib/cheat-sheets";

export const metadata: Metadata = { title: "Cheat sheets" };

const CARD = "rounded-card border border-border bg-surface p-4 sm:p-6";

// Plain reference tables, one cheat sheet per tab.
// The lesson class gives the tables the same look and phone scrolling as study pages.
export default function CheatSheetsPage() {
  return <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-10">
    <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Cheat sheets" }]} />
    <h1 className="mt-8 text-3xl font-semibold tracking-tight">Cheat sheets</h1>
    <p className="mt-3 max-w-2xl text-muted">Quick reference for particles and verb forms. Choose a sheet below.</p>
    <CheatSheetTabs sheets={[
      { id: "particles", label: "Particles", content: <Particles /> },
      { id: "verbs", label: "Verb groups", content: <VerbGroups /> },
    ]} />
  </main>;
}

function Particles() {
  return <>
    <p className="text-sm text-muted">From sensei&apos;s note. The note column is in sensei&apos;s own words.</p>
    <div className="lesson"><div className="tw">
      <table data-cheat-sheet="particles">
        <thead><tr><th scope="col">Use</th><th scope="col">Particle</th><th scope="col">Note</th><th scope="col">Example</th></tr></thead>
        <tbody>{PARTICLE_ROWS.map(row => <tr key={row.role + row.particle}>
          <td>{row.role}</td>
          <td lang="ja" className="text-xl font-semibold">{row.particle}</td>
          <td className="text-sm text-muted">{row.note}</td>
          <td><span lang="ja" className="block text-lg">{row.example.japanese}</span>
            <span className="block text-sm text-accent-text">{row.example.romaji}</span>
            <span className="block text-sm text-muted">{row.example.english}</span></td>
        </tr>)}</tbody>
      </table>
    </div></div>
    <p className={CARD + " mt-4"}><span className="font-semibold">Repeating a particle: </span>{PARTICLE_RULE}</p>

    <div className={CARD + " mt-6"} data-cheat-sheet="sentence">
      <h2 className="text-lg font-semibold">Building a sentence like a list</h2>
      <p className="mt-2 text-sm text-muted">Sensei&apos;s example. Each numbered phrase carries its own particle, so the phrases can change places. The verb part stays at the end.</p>
      <p className="mt-4">{SENTENCE_EXAMPLE.english}</p>
      <ol className="mt-3 space-y-2" style={{ listStyle: "none", paddingLeft: 0 }}>
        {SENTENCE_EXAMPLE.phrases.map(p => <li key={p.mark} className="flex flex-wrap items-baseline gap-x-3">
          <span lang="ja" className="text-xl">{p.mark}{p.japanese}</span><span className="text-sm text-muted">{p.role}</span>
        </li>)}
      </ol>
      <p lang="ja" className="mt-3 text-xl">{SENTENCE_EXAMPLE.ending}</p>
    </div>
  </>;
}

function VerbGroups() {
  return <>
    <p className="text-sm text-muted">The book splits verbs into five groups by their last sound, plus Regular and Special verbs. In each box the top form is formal (ます) and the <span className="text-accent-text">blue form</span> is casual (the dictionary, ない, た and なかった forms).</p>
    {VERB_GROUPS.map(group => <article key={group.id} id={group.id} data-verb-group={group.id} className={CARD + " mt-5"}>
      <h2 className="text-xl font-semibold">{group.name}: <span lang="ja">{group.endings}</span></h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{group.rules.map(rule => <li key={rule}>{rule}</li>)}</ul>
      <div className="lesson"><div className="tw">
        <table>
          <thead><tr><th scope="col">Verb</th>{FORM_LABELS.map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{group.verbs.map(verb => <tr key={verb.verb}>
            <th scope="row" className="text-left"><span lang="ja" className="block text-lg font-semibold text-foreground">{verb.verb}</span><span className="block font-normal">{verb.romaji} · {verb.english}</span></th>
            {FORM_LABELS.map((label, i) => <td key={label}>
              <span lang="ja" className="block text-lg">{verb.formal[i]}</span>
              <span lang="ja" className="block text-lg text-accent-text">{verb.casual[i]}</span>
            </td>)}
          </tr>)}</tbody>
        </table>
      </div></div>
      {group.watch && <p className="mt-3 text-sm"><span className="font-semibold">Watch out: </span>{group.watch}</p>}
      <Link href={group.lesson} className="mt-2 inline-flex min-h-11 items-center text-sm text-accent-text hover:underline">Open the lesson →</Link>
    </article>)}
  </>;
}
