export function selectAnalysisCohort(qualified, cap) {
  return qualified.filter((business) => business.discovery?.outreach_eligible !== false).slice(0, cap);
}

export function serializeBusiness(business) {
  const queries = (business.ai?.queries || []).map((entry) => {
    const providers = { ...(entry.providers || {}) };
    providers.gemini = { ...entry, ...providers.gemini };
    delete providers.gemini.providers;
    const recommended_competitors = [...new Set(Object.values(providers)
      .filter((provider) => provider.status === "tested")
      .flatMap((provider) => provider.recommended_competitors || []))];
    return { ...entry, mentioned: entry.status === "tested" ? entry.mentioned : null,
      recommended_competitors, providers };
  });
  return { ...business, website: business.website || null, top_review: business.top_review || null,
    queries, competitor_comparisons: business.competitors || [],
    competitors: [...new Set(queries.flatMap((query) => query.recommended_competitors))] };
}

export function serializeRun(run, cap) {
  const discovery = run.discovery || {};
  return { ...run, discovery: { ...discovery,
    candidates_found: discovery.candidates_returned ?? null,
    candidates_qualified: discovery.qualified_candidates ?? null,
    query_variants: discovery.query_variants || [], analysis_cap: cap },
    results: (run.results || []).map(serializeBusiness) };
}

// Provider answers are shared across the cohort. Persist each answer once so
// a 50-business run does not duplicate long responses in one Firestore record.
export function compactRunEvidence(run) {
  if (!Array.isArray(run.results)) return run;
  const texts = [];
  const indexes = new Map();
  function visit(value) {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      if (["answer_text", "verbatim_answer"].includes(key) && typeof item === "string" && item) {
        if (!indexes.has(item)) { indexes.set(item, texts.length); texts.push(item); }
        return [key, { evidence_text_index: indexes.get(item) }];
      }
      return [key, visit(item)];
    }));
  }
  return { ...run, results: visit(run.results), evidence_texts: texts };
}

export function expandRunEvidence(run) {
  if (!Array.isArray(run.evidence_texts)) return run;
  function visit(value) {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== "object") return value;
    if (Number.isInteger(value.evidence_text_index)) return run.evidence_texts[value.evidence_text_index] || "";
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item)]));
  }
  const { evidence_texts, ...rest } = run;
  return { ...rest, results: visit(run.results || []) };
}

// One queue per provider across all runs, with bounded concurrency and spacing.
export function createRequestLimiter(concurrency, intervalMs) {
  let active = 0;
  let nextStart = 0;
  const queue = [];
  function drain() {
    if (!queue.length || active >= concurrency) return;
    const delay = Math.max(0, nextStart - Date.now());
    if (delay) { setTimeout(drain, delay); return; }
    const { work, resolve, reject } = queue.shift();
    active++;
    nextStart = Date.now() + intervalMs;
    Promise.resolve().then(work).then(resolve, reject).finally(() => { active--; drain(); });
    drain();
  }
  return (work) => new Promise((resolve, reject) => { queue.push({ work, resolve, reject }); drain(); });
}

export async function fetchWithRetry(url, options, limiter, timeoutMs = 20000) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await limiter(async () => {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
      const text = await response.text();
      return { response, text };
    });
    if (result.response.ok) return JSON.parse(result.text);
    if (![429, 500, 502, 503, 504].includes(result.response.status) || attempt === 2)
      throw new Error(`Provider returned HTTP ${result.response.status}`);
    const retryAfter = result.response.headers.get("retry-after");
    const seconds = Number(retryAfter);
    const requestedDelay = retryAfter ? (Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now()) : 0;
    await new Promise((resolve) => setTimeout(resolve, Math.min(10000, Math.max(1000 * 2 ** attempt, requestedDelay || 0))));
  }
}
