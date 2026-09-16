# Goldmine engine contract — implementation reference

Status: NOT DEPLOYED. This document describes the current local code, not a ready production service. Hosted URL and server authentication must be supplied before integration. Do not call localhost from Lovable. Do not enable purchases based on this document alone.

## Required deployment values

- GOLDMINE_ENGINE_URL: pending verified deployment (HTTPS).
- GOLDMINE_ENGINE_TOKEN: implemented as Authorization: Bearer <token> on every /api route; secure production provisioning remains pending. Production refuses to start without a token of at least 32 characters.

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

Next handoff must replace the pending URL/auth entries, include deployed request/response examples and record a real authenticated scan plus ownership/failure tests. No live endpoint has been verified by this document.
