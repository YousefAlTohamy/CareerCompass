# Scraping Credentials And External Access

Date: 2026-05-15

CareerCompass keeps source templates visible even when a provider needs credentials or may block scraping. Diagnostics and Run Extractions should classify those sources honestly instead of deleting them or pretending they succeeded.

## Adzuna

Adzuna requires developer credentials.

1. Create an Adzuna developer account and application.
2. Copy the application ID and key into local environment files:

```env
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
```

These values are read by Laravel for preflight and by `ai-job-miner` for the actual API call.

Docker Compose passes them into the relevant containers from the root `.env`.

After changing credentials:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d backend-api backend-worker-scraping ai-job-miner
```

Do not commit real keys.

If credentials are missing, diagnostics returns `CONFIG_REQUIRED` with:

```text
Set ADZUNA_APP_ID and ADZUNA_APP_KEY to enable Adzuna.
```

## Internal Import Rate Limit

Manual extraction can import many jobs quickly. The Laravel internal scraper callback is token-protected and has a higher machine-to-machine limit than normal user APIs:

```env
SCRAPER_RATE_LIMIT_PER_MINUTE=600
```

Increase this only for trusted internal networks and keep the scraper token private.

## Proxies

External-risk sources such as LinkedIn may use the existing internal proxy feed.

```env
SCRAPER_USE_PROXIES=true
```

Set it to `false` for local demos or diagnostics when no working proxies are available:

```env
SCRAPER_USE_PROXIES=false
```

Proxy behavior is not a guarantee. LinkedIn, Indeed, Upwork, and other public job boards can still block automated access.

## No Login Scraping

Do not add account credentials for LinkedIn, Indeed, Upwork, or similar sites.

The scraper must not:

- bypass CAPTCHA;
- bypass paywalls;
- use stealth login automation;
- scrape behind authenticated user sessions.

If a source blocks public access, diagnostics should return `EXTERNAL_BLOCKED` or `EXTERNAL_FAILED`.

## Demo-Safe Mode

For presentations and reliable local demos, use:

- CareerCompass Demo Jobs;
- Remotive Remote Jobs;
- RemoteOK Remote Jobs if the public endpoint is reachable;
- Arbeitnow Job Board if the public endpoint is reachable;
- Adzuna only after credentials are configured.

The Demo source does not use the public internet and proves:

source + target -> scrape -> import -> store jobs -> Admin Jobs/User Jobs.
