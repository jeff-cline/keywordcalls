"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Plan = { id: string; name: string; scope: string; priceCents: number; multiAgent: boolean };

const US = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const usd = (c: number) => "$" + (c / 100).toLocaleString("en-US");

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
  const pickState = (s: string) => {
    if (geoType === "statewide") setGeoStates([s]);
    else if (geoType === "regional") { if (geoStates.includes(s)) setGeoStates(geoStates.filter((x) => x !== s)); else if (geoStates.length < 3) setGeoStates([...geoStates, s]); }
  };

  const next = () => {
    setErr(null);
    if (step === 1) { if (!a.firstName || !a.email || a.password.length < 8) { setErr("First name, email, and an 8+ character password are required."); return; } }
    if (step === 2) {
      if (kw.length === 0) { setErr("Add at least one keyword (your money word)."); return; }
      if (kw.some((w) => !bids[w] || parseFloat(bids[w]) <= 0)) { setErr("Set what you'll pay per call for each keyword."); return; }
      if (!routingNumber.trim()) { setErr("Enter the number to route calls to."); return; }
      if (geoType === "local" && zips.length === 0) { setErr("Add at least one ZIP code for a local campaign."); return; }
      if (geoType === "statewide" && geoStates.length !== 1) { setErr("Pick one state for a statewide campaign."); return; }
      if (geoType === "regional" && (geoStates.length < 1 || geoStates.length > 3)) { setErr("Pick 1–3 states for a regional campaign."); return; }
    }
    setStep((s) => s + 1);
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

  return (
    <div className="min-h-screen bg-[color:var(--soft)] px-5 py-10">
      <div className="mx-auto max-w-xl">
        <a href="/" className="flex justify-center mb-6"><img src="/logo.png" alt="KeywordCalls" className="h-11 w-auto" /></a>
        <div className="card p-7">
          <div className="flex items-center gap-2 mb-5 text-xs font-semibold">
            {["Account", "Campaign", "Launch"].map((t, i) => (
              <div key={t} className={`flex-1 text-center rounded-full py-1.5 ${step === i + 1 ? "bg-[color:var(--brand)] text-white" : step > i + 1 ? "bg-[color:var(--brand2)]/15 text-[color:var(--brand2)]" : "bg-[color:var(--soft)] text-[color:var(--muted)]"}`}>{i + 1}. {t}</div>
            ))}
          </div>

          {err && <div className="mb-4 rounded border border-red-300 bg-red-50 text-red-700 text-sm px-3 py-2">{err}</div>}

          {step === 1 && (
            <div className="space-y-3">
              <h1 className="text-xl font-bold">Create your account <span className="text-[color:var(--brand2)]">— first call free 🚀</span></h1>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="label">First name*</label><input className="input" value={a.firstName} onChange={(e) => setField("firstName", e.target.value)} /></div>
                <div><label className="label">Last name</label><input className="input" value={a.lastName} onChange={(e) => setField("lastName", e.target.value)} /></div>
                <div className="sm:col-span-2"><label className="label">Email*</label><input className="input" type="email" value={a.email} onChange={(e) => setField("email", e.target.value)} /></div>
                <div className="sm:col-span-2"><label className="label">Password* (8+ chars)</label><input className="input" type="password" value={a.password} onChange={(e) => setField("password", e.target.value)} /></div>
                <div><label className="label">Phone</label><input className="input" value={a.phone} onChange={(e) => setField("phone", e.target.value)} /></div>
                <div><label className="label">City</label><input className="input" value={a.city} onChange={(e) => setField("city", e.target.value)} /></div>
              </div>
              <button className="btn w-full mt-2" onClick={next}>Continue →</button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h1 className="text-xl font-bold">Build your campaign</h1>

              {/* 1 · Pick keyword */}
              <div>
                <label className="label">1 · Pick your keyword — type your money word*</label>
                <input className="input" value={kwInput} placeholder="e.g. Heart Insurance, Regenerative Medicine, Roofing…"
                  onChange={(e) => setKwInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commitKw(kwInput); } }}
                  onBlur={() => commitKw(kwInput)} />
                <div className="text-xs text-[color:var(--muted)] mt-1">Type a keyword and press Enter. Add as many as you want.</div>
                {kw.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {kw.map((w) => (
                      <span key={w} className="rounded-full bg-[color:var(--brand)] text-white text-sm font-medium px-3 py-1">{w}<button type="button" className="ml-2" onClick={() => removeKw(w)}>×</button></span>
                    ))}
                  </div>
                )}
              </div>

              {/* 2 · Pick what you'll pay per call */}
              {kw.length > 0 && (
                <div>
                  <label className="label">2 · Pick what you&apos;re willing to pay per call*</label>
                  <div className="space-y-2">
                    {kw.map((w) => (
                      <div key={w} className="flex items-center gap-2 rounded-lg border border-[color:var(--line)] p-2">
                        <span className="flex-1 text-sm font-medium">{w}</span>
                        <span className="flex items-center gap-1 text-sm">$<input className="input !py-1 w-24" value={bids[w] ?? ""} onChange={(e) => setBids((p) => ({ ...p, [w]: e.target.value }))} placeholder="per call" /><span className="text-[color:var(--muted)]">/call</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3 · Coverage */}
              <div>
                <label className="label">3 · Coverage <span className="text-[color:var(--muted)] font-normal">(monthly)</span></label>
                <div className="flex flex-wrap gap-2">
                  {plans.map((p) => (
                    <button key={p.id} type="button" onClick={() => { setGeoType(p.scope); setGeoStates([]); setGeoExclude([]); }} className={`rounded-lg px-3 py-1.5 text-sm border ${geoType === p.scope ? "bg-[color:var(--brand2)] text-white border-[color:var(--brand2)]" : "border-[color:var(--line)] hover:bg-[color:var(--soft)]"}`}>{p.name} · {usd(p.priceCents)}/mo</button>
                  ))}
                </div>
              </div>

              {geoType === "local" && (
                <div>
                  <label className="label">Your ZIP code(s)*</label>
                  <input className="input" value={zipInput} placeholder="e.g. 75201, 75204"
                    onChange={(e) => setZipInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commitZip(zipInput); } }}
                    onBlur={() => commitZip(zipInput)} />
                  <div className="text-xs text-[color:var(--muted)] mt-1">We route by ZIP — you&apos;re billed for calls from area codes tied to your ZIP(s).</div>
                  {zips.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{zips.map((z) => <span key={z} className="rounded-full bg-[color:var(--brand)] text-white text-xs font-semibold px-2.5 py-1">{z}<button type="button" className="ml-1" onClick={() => setZips(zips.filter((x) => x !== z))}>×</button></span>)}</div>}
                </div>
              )}
              {geoType === "statewide" && (
                <div>
                  <label className="label">Pick your state*</label>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {US.map((s) => <button key={s} type="button" onClick={() => pickState(s)} className={`rounded px-2 py-1 text-xs border ${geoStates.includes(s) ? "bg-[color:var(--brand)] text-white border-[color:var(--brand)]" : "border-[color:var(--line)]"}`}>{s}</button>)}
                  </div>
                </div>
              )}
              {geoType === "national" && (
                <div>
                  <label className="label">Nationwide — exclude any states you don&apos;t want</label>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {US.map((s) => <button key={s} type="button" onClick={() => toggle(geoExclude, s, setGeoExclude)} className={`rounded px-2 py-1 text-xs border ${geoExclude.includes(s) ? "bg-red-500 text-white border-red-500 line-through" : "border-[color:var(--line)]"}`}>{s}</button>)}
                  </div>
                  <div className="text-xs text-[color:var(--muted)] mt-1">{geoExclude.length ? `Excluding: ${geoExclude.join(", ")}` : "All 50 states included."}</div>
                </div>
              )}

              {/* 4 · Calendar */}
              <div>
                <label className="label">4 · When do you want to receive calls?</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {DAYS.map((d) => <button key={d} type="button" onClick={() => toggle(hours.days, d, (x) => setHours((h) => ({ ...h, days: x })))} className={`rounded px-2.5 py-1 text-xs border ${hours.days.includes(d) ? "bg-[color:var(--brand)] text-white border-[color:var(--brand)]" : "border-[color:var(--line)]"}`}>{d}</button>)}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <input className="input !w-auto" type="time" value={hours.start} onChange={(e) => setHours((h) => ({ ...h, start: e.target.value }))} />
                  <span className="text-[color:var(--muted)]">to</span>
                  <input className="input !w-auto" type="time" value={hours.end} onChange={(e) => setHours((h) => ({ ...h, end: e.target.value }))} />
                </div>
              </div>

              {/* 5 · Route number */}
              <div><label className="label">5 · Route calls to this number*</label><input className="input" placeholder="(555) 123-4567" value={routingNumber} onChange={(e) => setRouting(e.target.value)} /></div>
              <div className="flex gap-2">
                <button className="btn btn-ghost flex-1" onClick={() => setStep(1)}>← Back</button>
                <button className="btn flex-1" onClick={next}>Continue →</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h1 className="text-xl font-bold">Launch 🚀</h1>
              <div className="rounded-xl bg-[color:var(--soft)] p-4 text-sm text-[color:var(--muted)] leading-relaxed space-y-2">
                <div className="font-bold text-[color:var(--ink)]">Terms of service</div>
                <p><b className="text-[color:var(--ink)]">All calls are billable.</b> We charge your card at the end of each cycle, and on your cycle for your monthly service.</p>
                <p>Our technology is based on the ZIP code. If you have a local account and someone with an area code connected to that ZIP code calls, you will be billed.</p>
                <p><b className="text-[color:var(--ink)]">There are no refunds — please budget accordingly.</b></p>
              </div>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" /> <span>I agree to the terms above — all calls are billable, my card is charged each cycle, and there are no refunds.</span></label>
              <div className="flex gap-2">
                <button className="btn btn-ghost flex-1" onClick={() => setStep(2)}>← Back</button>
                <button className="btn flex-1" disabled={busy} onClick={submit}>{busy ? "Creating…" : "Create account & claim my free call 🚀"}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
