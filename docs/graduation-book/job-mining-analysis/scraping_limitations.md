# Scraping Limitations, Ethics, and Future Work

The AI Job Miner is a graduation/demo subsystem. Its purpose is to show an honest, maintainable design for importing job opportunities, not to claim whole-market reach or production-grade crawling.

## Current Limitations

| Limitation | Why It Matters | Current Mitigation |
|---|---|---|
| External websites change HTML | HTML parsers can break without code changes. | Adapter classifications and admin diagnostics surface failed/empty/blocked outcomes. |
| APIs require keys and quotas | Adzuna and similar services may require credentials and enforce limits. | Missing credentials are reported as configuration-required rather than fake success. |
| Rate limits and blocking can occur | Public websites may throttle or deny automated requests. | Conservative Scrapy settings, delays, retry handling, and honest failure reporting. |
| Robots/terms constraints are source-specific | Legal/ethical permission cannot be inferred from code alone. | Document compliance expectations and avoid bypassing login/CAPTCHA/private areas. |
| Proxy quality is variable | Proxies can fail, be slow, or violate source terms. | Proxies are optional and served only through protected configuration. |
| Duplicate detection is demo-suitable | URL and title/company checks may miss source-specific duplicates or changed postings. | DB uniqueness plus transaction-based update/create; future hash/source IDs recommended. |
| Data can become stale | Stored jobs may expire or change. | Future work should add freshness expiration and review queues. |
| Job descriptions can be noisy | Imported text may omit skills or contain boilerplate. | Laravel validates required fields and SkillSyncService normalizes extracted skills. |
| Coverage is partial | Source templates do not equal complete job-market access. | Use local demo source and label external adapters honestly. |
| Admin retry is limited | Current retry action marks failures as retried rather than dispatching targeted re-fetch. | Document as operational visibility and future DLQ work. |

## Ethical Boundaries

- Respect robots.txt, website terms, API terms, and local law before enabling any external source.
- Do not bypass login walls, CAPTCHAs, private data controls, or anti-abuse systems.
- Use official APIs when available and prefer stable, documented contracts.
- Keep rate limits conservative and record source health honestly.
- Do not store more job data than needed for student recommendations and academic demonstration.
- Avoid presenting scraped data as exhaustive, assured, or always current.

## Future Work

| Future Work | Benefit |
|---|---|
| Add more source-specific adapters | Improves parser accuracy while keeping each source maintainable. |
| Add source-specific canonical IDs and content hashes | Strengthens duplicate detection beyond URL/title/company. |
| Add freshness expiration and archived-job states | Reduces stale recommendation data. |
| Add compliance-aware source policy fields | Lets admins record permission, robots review, and rate-limit settings per source. |
| Add targeted DLQ reprocessing | Turns failed URL records into controlled retry jobs with attempt counts. |
| Add source health scoring dashboard | Helps admins distinguish reliable sources from noisy ones. |
| Add human review queue | Allows review before exposing uncertain imported jobs. |
| Add live-source evaluation script | Provides reproducible source-health evidence without inflating claims. |
| Add API-key and secret rotation process | Improves operational security. |
