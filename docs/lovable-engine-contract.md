# Goldmine engine contract — implementation reference

Status: Railway engine deployed at https://quietcrew-goldmine-production.up.railway.app. The existing bearer token is unchanged. The 13 October engine expansion has been tested against a real Highgate scan; see docs/live-verification for the saved response and remaining limitations. Do not call localhost from Lovable.

## Required deployment values

- GOLDMINE_ENGINE_URL: https://quietcrew-goldmine-production.up.railway.app (existing address).
- GOLDMINE_ENGINE_TOKEN: implemented as Authorization: Bearer <token> on every /api route; existing production provisioning is retained. Production refuses to start without a token of at least 32 characters. The existing Railway token remains configured; keep it server-side.

## Current endpoint shapes

POST /api/run
Content-Type: application/json

Request:
```json
{"location":"Highgate","category":"Restaurants and cafés","services":"SEO and AI visibility"}
```
Response (200):
```json
{"run_id":"run_example"}
```
Invalid locality returns 400 with `{ "error": "..." }`.

GET /api/run/:runId
Returns run_id, location, category, status, stage, results, timestamps and optional error. Unknown run returns 404. Poll through the Quietcrew server; never expose the engine credential in frontend requests.

Current native statuses: running, market_ready, complete, error. These are NOT four separate pending/partial/failed/completed API states. Map running with no results to pending; running/market_ready with results to partial; error to failed while preserving results; complete to completed. Completed runs can still contain failed provider checks.

Each result includes place_id, name, address, rating, review_count, quality, gold_score, score_status and ai. ai.queries contains query, status, mentioned, rank, answer_text and providers. Gemini evidence is also represented at query level; OpenAI/Claude evidence is under providers.openai and providers.anthropic. Query states include pending, tested and failed. Only tested answers belong in the denominator. A tested answer with mentioned=false is a genuine non-mention; failed/pending is unknown. Provider summaries are under ai.providers with total, mentions, visibility and status. Never turn missing totals into 0%.

POST /api/outreach/:placeId
Request:
```json
{"run_id":"run_example","services":"SEO and AI visibility"}
```
Response includes subject, body, outreach, email, source_url, place_id, name and sometimes evidence_note. This generates a draft; it sends no email. Partial Gemini results use an evidence-limited template. Email may be null. Complete-result generation still has independence verification and may return 422; both paths need a consistency audit before launch.

## Responsibilities and release blockers

Quietcrew must authenticate its customer and map paid order -> run_id. Verify ownership server-side for every status/result/draft request and verify place_id belongs to that run. Never accept an arbitrary customer-supplied run_id as ownership proof. Stripe event handling must be idempotent. The engine currently lacks scan idempotency and tenant isolation, and outreach can fall back to a stored business when a requested run does not match; these must be fixed before customer use.

Engine jobs currently execute in-process after the HTTP response. Production needs persistent storage and reliable execution/recovery; do not deploy as a short-lived request-only function and assume jobs survive. Current OpenAI/Claude checks do not use web search. Overall AI and Gold scores currently depend on Gemini, not a blended three-provider score. Label these limitations honestly or resolve them before release.

The live-verification handoff records deployed scan evidence. Customer/order ownership and purchase-flow checks remain separate release work.

## Engine expansion — 13 October 2026

- The default analysis cap is now 50 qualified businesses; MAX_ANALYSIS_CANDIDATES can set it between 30 and 50. This is an upper limit, not a guaranteed result count. The existing minimum of 20 reviews and chain exclusions are unchanged; ratings are ranked rather than filtered by an absolute minimum.
- Discovery follows up to three pages for each of the three existing search variants, deduplicating by Google Place ID. PLACES_MAX_PAGES can override pagination. candidates_found counts unique places, not duplicate search hits.
- POST /api/run still returns HTTP 200 and run_id, now with status, results and discovery. It returns immediately; discovery counts are null until known. Poll GET /api/run/:runId.
- Both responses include discovery.candidates_found, discovery.candidates_qualified, discovery.query_variants and discovery.analysis_cap. Existing candidates_returned, qualified_candidates and analysis_candidates are retained.
- Results expose website (string or null), top_review ({text, rating, author, relative_time} or null), queries, and competitors (unique names from tested provider answers). The old comparison objects are available as competitor_comparisons.
- queries aliases the detailed ai.queries evidence, adding recommended_competitors and provider-specific evidence under providers.gemini/openai/anthropic. Top-level query status and mentioned describe Gemini; read each provider separately for three-provider display. Top-level mentioned is null when pending/failed. An empty recommendation list is distinct from a failed response.
- Provider answers include tested_at and competitor names; competitor mentions are model recommendations, not independently verified Google listings. Missing reviews and websites remain null.
- Requests share bounded provider queues across runs. OpenAI/Anthropic have request deadlines and bounded retry/backoff for throttling and transient HTTP errors; malformed answers become failed checks. Successful query evidence is saved progressively.
- Repeated answer text is stored once per run in Firestore and restored before API responses, avoiding answer duplication as the cohort grows. Writes are ordered per run so an older progress write cannot overwrite a final result.
- Background jobs still run inside the server process. Polling avoids long HTTP requests, but restart-safe durable job execution remains a separate deployment requirement.

Validation: production build, TypeScript check, and focused cohort/evidence/concurrency/retry/timeout tests. A real Highgate scan has verified 50 results; see the live-verification handoff for provider completeness and evidence coverage.

Selected businesses now receive explicit Google Places Details lookups for review text and website evidence; Text Search alone did not supply reviews in the first live test. review_evidence_status is available, not_returned or unavailable. Grounded-query requests allow 45 seconds and the background Gemini stage allows 180 seconds by default.
