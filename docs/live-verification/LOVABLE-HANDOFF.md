# Goldmine engine — live handoff, 13 October 2026

Railway URL: https://quietcrew-goldmine-production.up.railway.app
The existing GOLDMINE_ENGINE_TOKEN is unchanged. Keep using the existing server-side connection.

Deployed engine commit: bdabd12. Railway deployment: 015995cd-478b-4b42-acd2-d567983afe74.
Repository: https://github.com/neelanjanabasu13/quietcrew-goldmine

## Verified real scan

- Run ID: run_4jc9ltbmwm9
- Highgate, Restaurants and cafés
- Completed in 38.96 seconds; HTTP creation and polling completed without gateway timeouts.
- 52 unique businesses discovered, 51 qualified by the existing review-volume rule, 6 chain exclusions, 45 analysed. Configured analysis cap: 50.
- Every analysed business has 10 tested queries for each of Gemini, OpenAI and Anthropic. Queries are shared across the market cohort; this is not 1,350 independent model requests.
- 35 businesses have website URLs.
- Query text, provider answers, mention state and recommended competitor names are present in the response.
- An earlier real scan confirmed 50 analysed businesses, but had partial Gemini coverage. Longer deadlines fixed the observed timeout issue in this repeat scan.

## Files

- highgate-restaurants-start.json: actual POST /api/run response.
- highgate-restaurants-sample.json: two real results with all the new evidence fields, excerpted from the final scan.
- verification-summary.json: final counts and provider completeness.
- highgate-restaurants-complete.json: full 45-business response, saved locally (not committed because of size).
- railway-verification.jpg: screenshot of the live verification.

## Review limitation

The engine explicitly requests Google Places Details reviews. Google returned HTTP 200 with ratings, review counts and website data, but omitted review text. All 45 top_review values are null and review_evidence_status is not_returned. A direct diagnostic lookup reproduced this. The legacy API is not enabled for this existing Google project. The cause of missing text is not established; do not invent review highlights or imply the business has no reviews. Hide the highlight or explain that review text was not returned.

## UI integration

- Render actual results.length and discovery counts. A cap of 50 is not a guarantee of 50 results.
- The initial response has null counts while discovery is pending; poll the existing run endpoint.
- top_review and website are nullable.
- results[].queries aliases detailed query evidence. Top-level status/mentioned refer to Gemini. Read providers.gemini, providers.openai and providers.anthropic for the per-assistant display. Failed/pending Gemini mentioned values are null.
- results[].competitors is now an array of names from tested model recommendations; previous comparison objects are retained under competitor_comparisons. These recommendations are not independently verified competitor identities.
- Free preview and paid unlock remain Lovable responsibilities.

## Remaining engine boundaries

Qualification currently requires at least 20 reviews and ranks ratings; it does not enforce an absolute minimum star rating. Independence verification remains deferred and outreach_eligible_candidates is 0 in this scan. Jobs still execute in-process; this scan does not establish restart recovery. OpenAI/Anthropic checks do not use web search, and the aggregate score remains Gemini-based.
