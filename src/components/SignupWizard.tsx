"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Plan = { id: string; name: string; scope: string; priceCents: number; multiAgent: boolean };

const US = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const usd = (c: number) => "$" + (c / 100).toLocaleString("en-US");
const STEPS = ["Account", "Keyword", "Price", "Coverage", "Hours", "Route", "Launch"];
const TOTAL = STEPS.length;

export default function SignupWizard({ plans, refSlug }: { plans: Plan[]; refSlug: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [a, setA] = useState({ firstName: "", lastName: "", email: "", password: "", phone: "", city: "", state: "", zip: "" });
  const [kw, setKw] = useState<string[]>([]);
  const [kwInput, setKwInput] = useState("");
  const [bids, setBids] = useState<Record<string, string>>({});
  const [geoType, setGeoType] = useState("local");
  const [geoStates, setGeoStates] = useState<string[]>([]);
  const [geoExclude, setGeoExclude] = useState<string[]>([]);
  const [zips, setZips] = useState<string[]>([]);
  const [zipInput, setZipInput] = useState("");
  const [hours, setHours] = useState({ days: ["Mon", "Tue", "Wed", "Thu", "Fri"], start: "09:00", end: "17:00" });
  const [routingNumber, setRouting] = useState("");
  const [agreed, setAgreed] = useState(false);
  const setField = (k: string, v: string) => setA((p) => ({ ...p, [k]: v }));
  const toggle = (arr: string[], v: string, set: (x: string[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  function commitKw(raw: string) {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const nextKw = [...kw]; const nextBids = { ...bids };
    for (const p of parts) { if (!nextKw.some((x) => x.toLowerCase() === p.toLowerCase())) { nextKw.push(p); nextBids[p] = nextBids[p] ?? ""; } }
    setKw(nextKw); setBids(nextBids); setKwInput("");
  }
  const removeKw = (w: string) => { setKw(kw.filter((x) => x !== w)); setBids((p) => { const n = { ...p }; delete n[w]; return n; }); };
  function commitZip(raw: string) {
    const parts = raw.split(",").map((s) => s.replace(/[^0-9]/g, "").slice(0, 5)).filter((s) => s.length >= 3);
    if (!parts.length) return;
    setZips([...new Set([...zips, ...parts])]); setZipInput("");
  }
  const pickState = (s: string) => { if (geoType === "statewide") setGeoStates([s]); };

  const next = () => {
    setErr(null);
    if (step === 1 && (!a.firstName || !a.email || a.password.length < 8)) { setErr("First name, email, and an 8+ character password are required."); return; }
    if (step === 2 && kw.length === 0) { setErr("Add at least one keyword (your money word)."); return; }
    if (step === 3 && kw.some((w) => !bids[w] || parseFloat(bids[w]) <= 0)) { setErr("Set what you'll pay per call for each keyword."); return; }
    if (step === 4) {
      if (geoType === "local" && zips.length === 0) { setErr("Add at least one ZIP code."); return; }
      if (geoType === "statewide" && geoStates.length !== 1) { setErr("Pick one state."); return; }
    }
    if (step === 5 && hours.days.length === 0) { setErr("Pick at least one day."); return; }
    if (step === 6 && !routingNumber.trim()) { setErr("Enter the number to route calls to."); return; }
    setStep((s) => Math.min(TOTAL, s + 1));
  };

  const submit = async () => {
    if (!agreed) { setErr("Please agree to the terms to continue."); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...a, keywords: kw, bids, geoType, geoStates, geoExcludeStates: geoExclude, geoZips: zips, hours, routingNumber, agreed, ref: refSlug || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.existing) { setErr(data.message || "You already have an account — we emailed a password reset. Taking you to login…"); setTimeout(() => router.push(data.redirect || "/login"), 2200); return; }
      if (!res.ok) throw new Error(data.error || "Could not create your account.");
      router.push("/dashboard?welcome=1");
    } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  };

  const bigInput = "input !text-base !py-3.5";
  const chip = (active: boolean) => `rounded-full px-3 py-2 text-sm border ${active ? "bg-[color:var(--brand)] text-white border-[color:var(--brand)]" : "border-[color:var(--line)]"}`;

  return (
    <div className="min-h-screen bg-[color:var(--soft)] px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-lg">
        <a href="/" className="flex justify-center mb-6"><img src="/logo.png" alt="KeywordCalls" className="h-12 w-auto" /></a>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs font-semibold text-[color:var(--muted)] mb-1.5">
            <span>Step {step} of {TOTAL} · <span className="text-[color:var(--brand)]">{STEPS[step - 1]}</span></span>
            <span>{Math.round((step / TOTAL) * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-[color:var(--line)] overflow-hidden"><div className="h-full bg-[color:var(--brand)] transition-all" style={{ width: `${(step / TOTAL) * 100}%` }} /></div>
        </div>

        <div className="card p-6 sm:p-8">
          {err && <div className="mb-4 rounded-lg border border-red-300 bg-red-50 text-red-700 text-sm px-3 py-2.5">{err}</div>}

          {/* 1 · Account */}
          {step === 1 && (
            <div className="space-y-4">
              <h1 className="text-2xl font-extrabold">Create your account <span className="text-[color:var(--brand2)]">— first call free 🚀</span></h1>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="label">First name*</label><input className={bigInput} value={a.firstName} onChange={(e) => setField("firstName", e.target.value)} /></div>
                <div><label className="label">Last name</label><input className={bigInput} value={a.lastName} onChange={(e) => setField("lastName", e.target.value)} /></div>
              </div>
              <div><label className="label">Email*</label><input className={bigInput} type="email" inputMode="email" value={a.email} onChange={(e) => setField("email", e.target.value)} /></div>
              <div><label className="label">Password* (8+ characters)</label><input className={bigInput} type="password" value={a.password} onChange={(e) => setField("password", e.target.value)} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="label">Phone</label><input className={bigInput} type="tel" inputMode="tel" value={a.phone} onChange={(e) => setField("phone", e.target.value)} /></div>
                <div><label className="label">City</label><input className={bigInput} value={a.city} onChange={(e) => setField("city", e.target.value)} /></div>
              </div>
            </div>
          )}

          {/* 2 · Keyword */}
          {step === 2 && (
            <div className="space-y-4">
              <h1 className="text-2xl font-extrabold">What&apos;s your keyword?</h1>
              <p className="text-[color:var(--muted)]">Type your money word — the kind of call you want. Add as many as you like.</p>
              <input className={bigInput} value={kwInput} placeholder="e.g. Heart Insurance, Roofing, Diabetes Care…"
                onChange={(e) => setKwInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commitKw(kwInput); } }}
                onBlur={() => commitKw(kwInput)} />
              <div className="text-xs text-[color:var(--muted)]">Press Enter after each keyword.</div>
              {kw.length > 0 && <div className="flex flex-wrap gap-2">{kw.map((w) => <span key={w} className="rounded-full bg-[color:var(--brand)] text-white text-sm font-medium px-3 py-1.5">{w}<button type="button" className="ml-2" onClick={() => removeKw(w)}>×</button></span>)}</div>}
            </div>
          )}

          {/* 3 · Price per call */}
          {step === 3 && (
            <div className="space-y-4">
              <h1 className="text-2xl font-extrabold">What will you pay per call?</h1>
              <p className="text-[color:var(--muted)]">Set your price for each keyword. Higher bids win more calls.</p>
              <div className="space-y-2">
                {kw.map((w) => (
                  <div key={w} className="flex items-center gap-2 rounded-xl border border-[color:var(--line)] p-3">
                    <span className="flex-1 font-medium">{w}</span>
                    <span className="flex items-center gap-1 text-lg">$<input className="input !text-lg !py-2 w-28" inputMode="decimal" value={bids[w] ?? ""} onChange={(e) => setBids((p) => ({ ...p, [w]: e.target.value }))} placeholder="per call" /><span className="text-[color:var(--muted)] text-sm">/call</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4 · Coverage */}
          {step === 4 && (
            <div className="space-y-4">
              <h1 className="text-2xl font-extrabold">Coverage <span className="text-[color:var(--muted)] text-lg font-normal">(monthly)</span></h1>
              <div className="grid gap-2">
                {plans.map((p) => (
                  <button key={p.id} type="button" onClick={() => { setGeoType(p.scope); setGeoStates([]); setGeoExclude([]); }} className={`flex items-center justify-between rounded-xl px-4 py-3.5 border text-left ${geoType === p.scope ? "bg-[color:var(--brand2)] text-white border-[color:var(--brand2)]" : "border-[color:var(--line)]"}`}>
                    <span className="font-semibold">{p.name}</span><span>{usd(p.priceCents)}/mo</span>
                  </button>
                ))}
              </div>
              {geoType === "local" && (
                <div>
                  <label className="label">Your ZIP code(s)*</label>
                  <input className={bigInput} inputMode="numeric" value={zipInput} placeholder="e.g. 75201, 75204"
                    onChange={(e) => setZipInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commitZip(zipInput); } }} onBlur={() => commitZip(zipInput)} />
                  <div className="text-xs text-[color:var(--muted)] mt-1">We route by ZIP — billed for calls from area codes tied to your ZIP(s).</div>
                  {zips.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{zips.map((z) => <span key={z} className="rounded-full bg-[color:var(--brand)] text-white text-xs font-semibold px-2.5 py-1">{z}<button type="button" className="ml-1" onClick={() => setZips(zips.filter((x) => x !== z))}>×</button></span>)}</div>}
                </div>
              )}
              {geoType === "statewide" && (
                <div><label className="label">Pick your state*</label><div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">{US.map((s) => <button key={s} type="button" onClick={() => pickState(s)} className={chip(geoStates.includes(s))}>{s}</button>)}</div></div>
              )}
              {geoType === "national" && (
                <div><label className="label">Exclude any states you don&apos;t want</label><div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">{US.map((s) => <button key={s} type="button" onClick={() => toggle(geoExclude, s, setGeoExclude)} className={`rounded-full px-3 py-2 text-sm border ${geoExclude.includes(s) ? "bg-red-500 text-white border-red-500 line-through" : "border-[color:var(--line)]"}`}>{s}</button>)}</div><div className="text-xs text-[color:var(--muted)] mt-1">{geoExclude.length ? `Excluding: ${geoExclude.join(", ")}` : "All 50 states included."}</div></div>
              )}
            </div>
          )}

          {/* 5 · Hours */}
          {step === 5 && (
            <div className="space-y-4">
              <h1 className="text-2xl font-extrabold">When do you want calls?</h1>
              <div className="flex flex-wrap gap-2">{DAYS.map((d) => <button key={d} type="button" onClick={() => toggle(hours.days, d, (x) => setHours((h) => ({ ...h, days: x })))} className={chip(hours.days.includes(d))}>{d}</button>)}</div>
              <div className="flex items-center gap-3 text-base"><input className="input !text-base !py-3 !w-auto" type="time" value={hours.start} onChange={(e) => setHours((h) => ({ ...h, start: e.target.value }))} /><span className="text-[color:var(--muted)]">to</span><input className="input !text-base !py-3 !w-auto" type="time" value={hours.end} onChange={(e) => setHours((h) => ({ ...h, end: e.target.value }))} /></div>
            </div>
          )}

          {/* 6 · Route */}
          {step === 6 && (
            <div className="space-y-4">
              <h1 className="text-2xl font-extrabold">Where should calls ring?</h1>
              <p className="text-[color:var(--muted)]">The number we deliver your live calls to.</p>
              <input className={bigInput} type="tel" inputMode="tel" placeholder="(555) 123-4567" value={routingNumber} onChange={(e) => setRouting(e.target.value)} />
            </div>
          )}

          {/* 7 · Launch */}
          {step === 7 && (
            <div className="space-y-4">
              <h1 className="text-2xl font-extrabold">Launch 🚀</h1>
              <div className="rounded-xl bg-[color:var(--soft)] p-4 text-sm text-[color:var(--muted)] leading-relaxed space-y-2">
                <div className="font-bold text-[color:var(--ink)]">Terms of service</div>
                <p><b className="text-[color:var(--ink)]">All calls are billable.</b> We charge your card at the end of each cycle, and on your cycle for your monthly service.</p>
                <p>Our technology is based on the ZIP code. If you have a local account and someone with an area code connected to that ZIP code calls, you will be billed.</p>
                <p><b className="text-[color:var(--ink)]">There are no refunds — please budget accordingly.</b></p>
              </div>
              <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 w-5 h-5" /> <span>I agree — all calls are billable, my card is charged each cycle, and there are no refunds.</span></label>
            </div>
          )}

          {/* Nav */}
          <div className="mt-6 flex gap-3">
            {step > 1 && <button className="btn btn-ghost !py-3.5 flex-1" onClick={() => setStep((s) => s - 1)}>← Back</button>}
            {step < TOTAL
              ? <button className="btn btn-primary !py-3.5 text-base flex-[2]" onClick={next}>Continue →</button>
              : <button className="btn btn-primary !py-3.5 text-base flex-[2]" disabled={busy} onClick={submit}>{busy ? "Creating…" : "Create account & claim my free call 🚀"}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
