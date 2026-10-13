import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { selectAnalysisCohort, serializeRun, compactRunEvidence, expandRunEvidence, createRequestLimiter, fetchWithRetry } from "./scan-contract.mjs";

test("analysis selects 50 qualified businesses while preserving exclusions and small cohorts", () => {
  const qualified = Array.from({ length: 70 }, (_, i) => ({ place_id: String(i), discovery: { outreach_eligible: i >= 10 } }));
  const cohort = selectAnalysisCohort(qualified, 50);
  assert.equal(cohort.length, 50);
  assert.equal(cohort[0].place_id, "10");
  assert.equal(cohort[49].place_id, "59");
  assert.equal(selectAnalysisCohort(qualified, 30).length, 30);
  assert.equal(selectAnalysisCohort(qualified.slice(0, 14), 50).length, 4);
});

test("50-business evidence persists without duplicating provider answers and restores exactly", () => {
  const answer = "Evidence from the model. ".repeat(150);
  const run = { run_id: "test", results: Array.from({ length: 50 }, (_, i) => ({ place_id: String(i),
    ai: { queries: Array.from({ length: 10 }, () => ({ answer_text: answer, verbatim_answer: answer,
      providers: { openai: { answer_text: answer }, anthropic: { answer_text: answer } } })) } })) };
  const compact = compactRunEvidence(run);
  assert.deepEqual(expandRunEvidence(compact), run);
  assert.equal(compact.evidence_texts.length, 1);
  assert.ok(Buffer.byteLength(JSON.stringify(compact)) < 1000000);
  assert.ok(JSON.stringify(compact).length < JSON.stringify(run).length / 10);
  assert.deepEqual(expandRunEvidence({ results: [] }), { results: [] });
});

test("pending metadata stays unknown; full cohorts and provider evidence survive serialization", () => {
  assert.equal(serializeRun({ results: [] }, 50).discovery.candidates_found, null);
  const business = { website: "https://example.com", top_review: { text: "Excellent", author: "A", relative_time: "a week ago" },
    ai: { queries: [{ query: "dentists in Highgate", status: "tested", mentioned: false,
      recommended_competitors: ["Other Dentist"], providers: {
        openai: { status: "tested", mentioned: false, recommended_competitors: ["Other Dentist", "Another Dentist"] },
        anthropic: { status: "failed", recommended_competitors: ["Invalid"] } } },
      { query: "emergency dentists", status: "failed", mentioned: false }] } };
  const output = serializeRun({ discovery: { candidates_returned: 80, qualified_candidates: 55, query_variants: ["dentists in Highgate"] },
    results: Array.from({ length: 50 }, (_, i) => ({ ...business, place_id: String(i) })) }, 50);
  assert.equal(output.results.length, 50);
  assert.equal(output.discovery.candidates_found, 80);
  assert.equal(output.discovery.candidates_qualified, 55);
  assert.deepEqual(output.results[0].competitors, ["Other Dentist", "Another Dentist"]);
  assert.equal(output.results[0].queries[1].mentioned, null);
  assert.equal(output.results[0].website, business.website);
  assert.deepEqual(output.results[0].top_review, business.top_review);
  assert.equal(business.ai.queries[1].mentioned, false);
});

test("shared queue bounds parallel work, spaces requests, and recovers after rejection", async () => {
  const limit = createRequestLimiter(2, 15);
  let active = 0, maximum = 0;
  const starts = [];
  const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => limit(async () => {
    starts.push(Date.now()); maximum = Math.max(maximum, ++active);
    await new Promise((resolve) => setTimeout(resolve, 40)); active--;
    if (i === 2) throw new Error("failed");
    return i;
  })));
  assert.equal(maximum, 2);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 7);
  assert.ok(starts.slice(1).every((time, i) => time - starts[i] >= 14));
});

test("provider requests retry throttling, stop on auth errors, and time out", async () => {
  let requests = 0;
  const server = createServer((req, res) => {
    if (req.url === "/stall") return;
    if (req.url === "/auth") { res.writeHead(401); res.end("denied"); return; }
    requests++;
    res.writeHead(requests === 1 ? 429 : 200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const limit = createRequestLimiter(2, 0);
  try {
    assert.deepEqual(await fetchWithRetry(base, {}, limit, 200), { ok: true });
    assert.equal(requests, 2);
    await assert.rejects(fetchWithRetry(`${base}/auth`, {}, limit, 200), /HTTP 401/);
    await assert.rejects(fetchWithRetry(`${base}/stall`, {}, limit, 30), /timeout/i);
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
});
