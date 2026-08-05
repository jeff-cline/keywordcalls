"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type KW = { id: string; name: string; priceCents: number };
type Plan = { id: string; name: string; scope: string; priceCents: number; multiAgent: boolean };

const US = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const usd = (c: number) => "$" + (c / 100).toLocaleString("en-US");

export default function SignupWizard({ keywords, plans, refSlug }: { keywords: KW[]; plans: Plan[]; refSlug: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [a, setA] = useState({ firstName: "", lastName: "", email: "", password: "", phone: "", city: "", state: "", zip: "" });
  const [kw, setKw] = useState<string[]>([]);
  const [geoType, setGeoType] = useState("local");
  const [geoStates, setGeoStates] = useState<string[]>([]);
  const [hours, setHours] = useState({ days: ["Mon", "Tue", "Wed", "Thu", "Fri"], start: "09:00", end: "17:00" });
  const [routingNumber, setRouting] = useState("");
  const [agreed, setAgreed] = useState(false);
  const setField = (k: string, v: string) => setA((p) => ({ ...p, [k]: v }));
  const toggle = (arr: string[], v: string, set: (x: string[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const next = () => {
    setErr(null);
    if (step === 1) { if (!a.firstName || !a.email || a.password.length < 8) { setErr("First name, email, and an 8+ character password are required."); return; } }
    if (step === 2) { if (kw.length === 0 || !routingNumber.trim()) { setErr("Pick at least one keyword and enter the number to route calls to."); return; } }
    setStep((s) => s + 1);
  };

  const submit = async () => {
    if (!agreed) { setErr("Please agree to the billing terms to continue."); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...a, keywords: kw, geoType, geoStates, hours, routingNumber, agreed, ref: refSlug || undefined }),
      });
      const data = await res.json().catch(() => ({}));
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
                <div><label className="label">State</label>
                  <select className="input" value={a.state} onChange={(e) => setField("state", e.target.value)}><option value="">—</option>{US.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                </div>
                <div><label className="label">ZIP</label><input className="input" value={a.zip} onChange={(e) => setField("zip", e.target.value)} /></div>
              </div>
              <button className="btn w-full mt-2" onClick={next}>Continue →</button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h1 className="text-xl font-bold">Build your campaign</h1>
              <div>
                <label className="label">Pick your keyword(s)*</label>
                <div className="flex flex-wrap gap-2">
                  {keywords.map((k) => (
                    <button key={k.id} onClick={() => toggle(kw, k.name, setKw)} className={`rounded-full px-3 py-1.5 text-sm border ${kw.includes(k.name) ? "bg-[color:var(--brand)] text-white border-[color:var(--brand)]" : "border-[color:var(--line)] hover:bg-[color:var(--soft)]"}`}>{k.name} · {usd(k.priceCents)}/call</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Coverage</label>
                <div className="flex flex-wrap gap-2">
                  {plans.map((p) => (
                    <button key={p.id} onClick={() => setGeoType(p.scope)} className={`rounded-lg px-3 py-1.5 text-sm border ${geoType === p.scope ? "bg-[color:var(--brand2)] text-white border-[color:var(--brand2)]" : "border-[color:var(--line)] hover:bg-[color:var(--soft)]"}`}>{p.name} · {usd(p.priceCents)}/mo</button>
                  ))}
                </div>
              </div>
              {geoType !== "national" && (
                <div>
                  <label className="label">Target state(s)</label>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {US.map((s) => <button key={s} onClick={() => toggle(geoStates, s, setGeoStates)} className={`rounded px-2 py-1 text-xs border ${geoStates.includes(s) ? "bg-[color:var(--brand)] text-white border-[color:var(--brand)]" : "border-[color:var(--line)]"}`}>{s}</button>)}
                  </div>
                </div>
              )}
              <div>
                <label className="label">When do you want to receive calls?</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {DAYS.map((d) => <button key={d} onClick={() => toggle(hours.days, d, (x) => setHours((h) => ({ ...h, days: x })))} className={`rounded px-2.5 py-1 text-xs border ${hours.days.includes(d) ? "bg-[color:var(--brand)] text-white border-[color:var(--brand)]" : "border-[color:var(--line)]"}`}>{d}</button>)}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <input className="input !w-auto" type="time" value={hours.start} onChange={(e) => setHours((h) => ({ ...h, start: e.target.value }))} />
                  <span className="text-[color:var(--muted)]">to</span>
                  <input className="input !w-auto" type="time" value={hours.end} onChange={(e) => setHours((h) => ({ ...h, end: e.target.value }))} />
                </div>
              </div>
              <div><label className="label">Route calls to this number*</label><input className="input" placeholder="(555) 123-4567" value={routingNumber} onChange={(e) => setRouting(e.target.value)} /></div>
              <div className="flex gap-2">
                <button className="btn btn-ghost flex-1" onClick={() => setStep(1)}>← Back</button>
                <button className="btn flex-1" onClick={next}>Continue →</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h1 className="text-xl font-bold">Launch 🚀</h1>
              <div className="rounded-xl bg-[color:var(--soft)] p-4 text-sm text-[color:var(--muted)] leading-relaxed">
                Because our technology has a short delay and consumers can call any time during your campaign, <b className="text-[color:var(--ink)]">you agree to pay for all calls that are created</b>. Your account is pre-funded — calls are charged against your balance, and if it runs low or hits zero you&apos;ll be billed as needed.
              </div>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" /> <span>I understand and agree that all calls are charged against my account balance, and any overage will be billed additionally as needed.</span></label>
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
