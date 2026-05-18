# Scraping Source Matrix

This matrix documents expected graduation-demo behavior for job sources. The
goal is honest demonstration of a scraping/import pipeline, not pretending that
every public website is reliably scrapeable.

## Source Matrix

| Source | Type | Reliability for demo | Expected status | Notes |
| --- | --- | --- | --- | --- |
| CareerCompass Demo Jobs | Demo/internal baseline | High | Available | Use as the safest baseline when external sources fail. Jobs should be clearly understood as demo/internal data, not fabricated external-source results. |
| Remotive | Public API | High to medium | Available if API is reachable | Good candidate for live demo because it exposes structured remote job data. Network/API downtime is still possible. |
| RemoteOK | Public API/feed-like source | Medium | Available if public endpoint is reachable | Useful for remote jobs, but public endpoints can change or rate-limit. |
| Arbeitnow | Public API | Medium to high | Available if API is reachable | Good structured source for demo when reachable. |
| Adzuna | Official API | Medium | Available when credentials and API access are configured | More reliable than HTML scraping, but depends on API keys, quotas, and network access. |
| Wuzzuf | Public HTML source | Low to medium | May be blocked or layout-dependent | Useful to discuss local/regional relevance, but public HTML can change or block automated access. |
| Indeed | Public HTML source | Low | Likely blocked or restricted | Treat as a limitation/demo diagnostic case. Do not bypass login, CAPTCHA, or anti-bot controls. |
| Upwork | Public/marketplace HTML source | Low | Likely blocked, restricted, or login-dependent | Should be classified honestly if inaccessible. Do not scrape logged-in pages. |
| LinkedIn | Public/professional network HTML source | Low | Likely blocked, restricted, or login-dependent | Should be discussed as future official/API partnership work, not as a reliable live scraping source. |

## Demo Baseline

Reliable API/demo sources are the graduation demo baseline. The live defense
should not depend on a public HTML source that may block automated access during
the presentation.

Recommended demo order:

1. CareerCompass Demo Jobs.
2. Remotive, Arbeitnow, RemoteOK, or Adzuna if reachable.
3. Public HTML sources only as diagnostics or limitation examples.

## Honest Source Classification

CareerCompass should classify sources honestly:

- Active and working when jobs are imported successfully.
- API unavailable when a structured API cannot be reached.
- Blocked/restricted when a site denies automated public access.
- Layout-dependent when selectors or page structure may have changed.
- Demo/internal when jobs come from CareerCompass-controlled demo data.

Blocked sources should not be displayed as successful imports.

## Boundaries

The scraping demo must follow these boundaries:

- No login scraping.
- No CAPTCHA bypass.
- No stealth/fingerprint evasion.
- No fake job generation for external sources.
- No hiding blocked source failures behind false success messages.
- No claim that public HTML sources are guaranteed to work during the defense.

These boundaries make the project stronger academically because they show
ethical engineering judgment and realistic handling of external dependencies.
