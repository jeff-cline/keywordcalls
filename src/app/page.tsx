import Link from "next/link";
import { db } from "@/lib/db";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";
const usd = (c: number) => "$" + (c / 100).toLocaleString("en-US");

export default async function Home() {
  const [plans, keywords] = await Promise.all([
    db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.keyword.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  const steps = [
    { n: "1", t: "Pick your keyword", d: "Health Insurance, Medicare, Peptides — whatever calls you want." },
    { n: "2", t: "Set your bid", d: "You control what you pay per call. Higher bids win more calls." },
    { n: "3", t: "Your routing number", d: "The phone we deliver live calls to, in real time." },
    { n: "4", t: "Your call hours", d: "Only get calls when you're ready to answer them." },
  ];

  return (
    <>
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-b from-[color:var(--soft)] to-white">
        <div className="mx-auto max-w-6xl px-5 pt-16 pb-14 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white border border-[color:var(--line)] px-3 py-1 text-xs font-semibold text-[color:var(--brand)] mb-5">🚀 High-intent calls, delivered live</div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[color:var(--ink)] max-w-3xl mx-auto">
            Get high-intent <span className="text-[color:var(--brand2)]">keyword calls</span> delivered straight to your phone — in real time.
          </h1>
          <p className="mt-5 text-lg text-[color:var(--muted)] max-w-2xl mx-auto">
            Pick a keyword, set your bid, and we route ready-to-talk callers to your line. Powered by PredictiveData.org, R0cketShip technology, TV, and digital outreach across our whole network.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/signup" className="btn btn-accent text-base !px-7 !py-3.5">Create an account & get your first call free 🚀</Link>
            <a href="https://calendly.com/jdcline/book-onboarding-call" target="_blank" rel="noreferrer" className="btn btn-ghost text-base !px-7 !py-3.5">Book an onboarding call</a>
          </div>
          <div className="mt-4 text-xs text-[color:var(--muted)]">No long-term contract to start · Pre-funded, pay only for the calls you get</div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-2xl font-bold text-center">It&apos;s this simple</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="card p-6">
              <div className="h-10 w-10 rounded-xl bg-[color:var(--brand)] text-white flex items-center justify-center font-bold text-lg">{s.n}</div>
              <div className="mt-4 font-bold">{s.t}</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Keyword prices */}
      {keywords.length > 0 && (
        <section className="bg-[color:var(--soft)]">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <h2 className="text-2xl font-bold text-center">Per-call pricing by keyword</h2>
            <p className="text-center text-sm text-[color:var(--muted)] mt-2">A bidding system — these are starting call prices. You set your own bid.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {keywords.map((k) => (
                <div key={k.id} className="card px-5 py-3 flex items-center gap-3">
                  <span className="font-semibold">{k.name}</span>
                  <span className="text-[color:var(--brand2)] font-bold">{usd(k.priceCents)}/call</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Plans */}
      <section id="pricing" className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-2xl font-bold text-center">Monthly plans</h2>
        <p className="text-center text-sm text-[color:var(--muted)] mt-2">Statewide and up include multi-agent routing.</p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => (
            <div key={p.id} className={`card p-6 ${p.scope === "regional" ? "ring-2 ring-[color:var(--brand2)]" : ""}`}>
              <div className="text-sm font-semibold text-[color:var(--muted)] uppercase tracking-wide">{p.name}</div>
              <div className="mt-2 text-3xl font-extrabold">{usd(p.priceCents)}<span className="text-base font-medium text-[color:var(--muted)]">/mo</span></div>
              <div className="mt-3 text-sm text-[color:var(--muted)]">{p.multiAgent ? "✓ Multi-agent routing" : "Single-agent routing"}</div>
              <div className="text-sm text-[color:var(--muted)]">✓ Calls included</div>
              <Link href="/signup" className="btn btn-ghost w-full mt-5">Get started 🚀</Link>
            </div>
          ))}
        </div>
      </section>

      {/* Tech blurb */}
      <section className="bg-[color:var(--brand)] text-white">
        <div className="mx-auto max-w-4xl px-5 py-16 text-center">
          <h2 className="text-2xl md:text-3xl font-bold">Real intent. Real calls. Real time. 🚀</h2>
          <p className="mt-4 text-white/85">
            We use <b>PredictiveData.org</b> and <b>R0cketShip technology</b> along with TV, internet, digital outreach, and multiple platforms to fully optimize success across our network — delivering high-intent targeted calls directly to your phone in real time.
          </p>
          <Link href="/signup" className="btn btn-accent mt-8 text-base !px-7 !py-3.5">Create an account & get your first call free</Link>
        </div>
      </section>

      <Footer />
    </>
  );
}
