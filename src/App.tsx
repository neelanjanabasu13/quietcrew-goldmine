import { FormEvent, useEffect, useRef, useState } from "react";

type Result = { place_id: string; name: string; address: string; website?: string | null; rating?: number; review_count?: number; ai?: { visibility?: number; mentions?: number; total?: number; providers?: Record<string, { visibility?: number; mentions?: number; total?: number; status?: string }> } };
type Run = { run_id: string; status: string; stage: string; category: string; location: string; stage_counts?: Record<string, number>; results?: Result[]; error?: string };
const stages = ["discovering", "qualifying", "auditing", "testing", "comparing", "complete"];

export default function App() {
  const [category, setCategory] = useState("Restaurants and cafés");
  const [location, setLocation] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<number | undefined>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function poll(runId: string): Promise<void> {
    try {
      const response = await fetch(`/api/run/${runId}`); const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to read scan status.");
      setRun(data);
      if (["complete", "error"].includes(data.status)) { setBusy(false); return; }
      timer.current = window.setTimeout(() => void poll(runId), 1200);
    } catch (err) { setError(err instanceof Error ? err.message : "The scan status could not be loaded."); setBusy(false); }
  }

  async function startScan(event: FormEvent) {
    event.preventDefault(); setError(""); setRun(null); setBusy(true);
    try {
      const response = await fetch("/api/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, location }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "The scan could not be started."); await poll(data.run_id);
    } catch (err) { setError(err instanceof Error ? err.message : "The scan could not be started."); setBusy(false); }
  }

  const stageIndex = stages.indexOf(run?.stage || ""); const results = run?.results || [];
  return <main className="app-shell">
    <header className="masthead"><span className="logo">Quietcrew <b>Goldmine</b></span><span className="tag">AI visibility prospecting</span></header>
    <section className="hero"><p className="eyebrow">Instant local discovery scan</p><h1>Find respected local businesses that AI search still misses.</h1><p className="lede">Choose a category and a focused area. Goldmine automatically finds the local cohort, ranks the strongest opportunities, and tests how often AI search mentions them.</p>
      <form className="scan-form" onSubmit={startScan}><label>Business category<select value={category} onChange={(e) => setCategory(e.target.value)}><option>Restaurants and cafés</option><option>Beauty and aesthetics</option><option>Dental</option><option>Fitness</option><option>Legal</option><option>Home services</option><option>Estate agencies</option><option>Hair</option></select></label><label>Area or neighbourhood<input required value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Muswell Hill" /></label><button disabled={busy}>{busy ? "Scanning…" : "Start free scan"}</button></form>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
    {run && <section className="results" aria-live="polite"><div className="run-heading"><div><p className="eyebrow">{run.category} · {run.location}</p><h2>{run.status === "complete" ? "Your prospect list is ready" : run.status === "error" ? "Scan stopped" : "Building your prospect list"}</h2></div>{run.stage_counts?.discovering ? <strong>{run.stage_counts.discovering} found</strong> : null}</div>
      <div className="stages">{stages.map((stage, index) => <div className={`stage ${index <= stageIndex && run.status !== "error" ? "done" : ""} ${stage === run.stage ? "current" : ""}`} key={stage}><span>{index + 1}</span>{stage === "complete" ? "ready" : stage}</div>)}</div>{run.error && <p className="error">{run.error}</p>}
      {results.length > 0 && <div className="table-wrap"><table><thead><tr><th>Business</th><th>Rating</th><th>Gemini</th><th>OpenAI / ChatGPT</th><th>Claude</th><th>Website</th></tr></thead><tbody>{results.map((business) => <tr key={business.place_id}><td><strong>{business.name}</strong><small>{business.address}</small></td><td>{business.rating ? `${business.rating.toFixed(1)} ★` : "—"}<small>{business.review_count || 0} reviews</small></td>{["gemini", "openai", "anthropic"].map((provider) => { const result = business.ai?.providers?.[provider]; return <td key={provider}><b className={Number(result?.visibility || 0) < 40 ? "gap" : "visible"}>{result?.status === "unavailable" ? "Unavailable" : result?.visibility != null ? `${result.visibility}%` : "Testing…"}</b><small>{result?.mentions ?? 0} of {result?.total ?? 10} prompts</small></td>; })}<td>{business.website ? <a href={business.website} target="_blank" rel="noreferrer">Visit site ↗</a> : "No website"}</td></tr>)}</tbody></table></div>}{run.status === "complete" && results.length === 0 && <p className="empty">No matching businesses were returned for this area. Try a nearby neighbourhood.</p>}
    </section>}<footer>Goldmine is a Quietcrew product. Results are a prospecting signal, not a market census.</footer>
  </main>;
}
