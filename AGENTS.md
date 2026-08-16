# Project Guidelines & Memory Rules

## 1. Absolute Truth & Live Verification (Strict Requirement)
- Never assume a video, workflow, or cron schedule is functioning without testing the live HTTP endpoints, checking external platform response bodies (Zernio, Cloudflare R2, D1), and confirming direct output.
- Never state that an automated cron, job, or trigger worked until the execution logs, timestamps, and actual posted media on the target platform are verified.
- Statuses shown in the UI (e.g. `PUBLISHED` vs `QUEUED`) must reflect the real-time source of truth from Zernio and the underlying databases, not optimistic local variables or speculative flags.

## 2. No Half-Baked Implementations
- When integrating external APIs (Zernio, TikTok Scraper, RapidAPI, Cloudflare Workers AI):
  1. Audit request and response headers thoroughly (Content-Type, CORS, Referer, Accept-Ranges).
  2. Test every failure path and platform validation constraint (e.g. TikTok CDN anti-hotlinking, resolution requirements).
  3. Ensure all links passed to downstream webhooks or posting services are resolvable, unblocked, and directly streamable by automated bots.

## 3. High Attention to Detail & Execution
- Check exact timezones (UTC vs EEST / Cyprus / GMT) when setting up schedules and communicating timelines.
- Persist verified benchmarks and live performance data accurately.
