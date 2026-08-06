import { db } from "@/lib/db";
import { resultsFor, usd } from "@/lib/results";

export const dynamic = "force-dynamic";

export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ t?: string; ltv?: string }> }) {
  const sp = await searchParams;
  let name = "your business", ltvCents = Math.round((parseFloat(sp.ltv || "0") || 0) * 100);
  if (sp.t) {
    const c = await db.customer.findFirst({ where: { resultsToken: sp.t }, include: { account: true } });
    if (c) { name = `${c.account.firstName} ${c.account.lastName}`.trim() || "your business"; ltvCents = c.ltvCents; }
  }
  if (!ltvCents) ltvCents = 300000; // sensible preview default ($3,000)
  const r = resultsFor(ltvCents);
  const pdfHref = sp.t ? `/api/results/pdf?t=${sp.t}` : `/api/results/pdf?ltv=${(ltvCents / 100).toFixed(0)}`;

  return (
    <div className="min-h-screen bg-[color:var(--soft)]">
      <div className="bg-[color:var(--brand)]">
        <div className="mx-auto max-w-3xl px-5 py-6 flex items-center justify-between">
          <img src="/logo.png" alt="KeywordCalls" className="h-9 w-auto brightness-0 invert" />
          <a href={pdfHref} className="btn !bg-[color:#ff7a1a] text-white !border-0 text-sm">⬇ Download PDF</a>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-5 py-10 space-y-10">
        <section className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-[color:#ff7a1a]/15 text-[color:#ff7a1a] px-4 py-1.5 text-sm font-bold">🚀 Your results</div>
          <h1 className="mt-4 text-3xl md:text-4xl font-extrabold">Results for {name}</h1>
          <p className="mt-3 text-[color:var(--muted)]">Inbound calls are <b className="text-[color:var(--brand2)]">33× more valuable</b> than clicks. Here&apos;s what that means for you.</p>
        </section>

        <section className="card p-6">
          <div className="text-xs uppercase tracking-widest text-[color:var(--muted)] mb-3">Here&apos;s your results</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div><div className="text-3xl font-extrabold text-[color:var(--brand2)]">{r.calls}</div><div className="text-xs uppercase text-[color:var(--muted)]">Calls</div></div>
            <div><div className="text-3xl font-extrabold">{usd(r.costCents)}</div><div className="text-xs uppercase text-[color:var(--muted)]">Cost</div></div>
            <div><div className="text-3xl font-extrabold text-[color:var(--brand2)]">{usd(r.revenueCents)}</div><div className="text-xs uppercase text-[color:var(--muted)]">Value created</div></div>
            <div><div className="text-3xl font-extrabold text-[color:#16a34a]">{r.roas.toFixed(1)}×</div><div className="text-xs uppercase text-[color:var(--muted)]">ROAS</div></div>
          </div>
          <p className="mt-4 text-sm text-[color:var(--muted)]">Based on a lifetime value of <b className="text-[color:var(--ink)]">{usd(ltvCents)}</b>: 10 high-intent calls, one becomes a customer = {usd(r.revenueCents)} created for {usd(r.costCents)} — a {r.roas.toFixed(1)}× return.</p>
        </section>

        <section className="grid gap-5 sm:grid-cols-2">
          <div className="card p-6"><div className="font-bold mb-2">How to get started</div><ol className="text-sm text-[color:var(--muted)] space-y-1 list-decimal pl-4"><li>Create your account &amp; pick your keyword.</li><li>Set what you&apos;ll pay per call.</li><li>Give us the phone to ring.</li><li>Fund &amp; go live — first call free.</li></ol></div>
          <div className="card p-6"><div className="font-bold mb-2">How it works</div><p className="text-sm text-[color:var(--muted)]">PredictiveData + R0cketShip technology across TV, digital, and outreach find people actively looking for what you sell, then route them to your phone live. You only pay for calls you receive.</p></div>
        </section>

        {/* Exit Optimization featured */}
        <section className="rounded-3xl bg-[#0b1020] text-white p-8 text-center">
          <div className="text-sm font-bold uppercase tracking-widest text-white/50">Featured partner</div>
          <div className="mt-2 text-2xl font-extrabold tracking-tight">EXIT OPTIMIZATION</div>
          <p className="mt-3 text-white/80">When you scale, the next move is your exit. Exit Optimization helps owners <b className="text-[color:#16d6a5]">double — even triple</b> their exit valuation: business valuation, sell-side readiness, QoE &amp; due-diligence prep.</p>
          <a href="https://exitoptimization.com" target="_blank" rel="noopener" className="btn btn-accent mt-5">Visit ExitOptimization.com →</a>
        </section>

        {/* Talk to a geek */}
        <section className="card p-6 text-center">
          <div className="font-bold text-lg">What would it look like to have a custom tech stack?</div>
          <p className="text-sm text-[color:var(--muted)] mt-1">We build custom calling, routing, and data systems end to end.</p>
          <a href="/book" className="btn btn-ghost mt-4">🧑‍💻 Talk to a geek</a>
        </section>

        <section className="rounded-3xl bg-[color:#ff7a1a] text-white p-8 text-center">
          <div className="text-2xl font-extrabold">Ready to get these calls? 🚀</div>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <a href="/signup" className="btn !bg-white !text-[color:#ff7a1a] !border-0">Create your account</a>
            <a href={pdfHref} className="btn btn-ghost !text-white !border-white/40">⬇ Download your PDF</a>
          </div>
        </section>
      </main>
    </div>
  );
}
