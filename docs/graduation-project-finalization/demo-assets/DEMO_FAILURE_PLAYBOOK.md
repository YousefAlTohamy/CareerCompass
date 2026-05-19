# Demo Failure Playbook

Use this page during the defense if something goes wrong. Keep the explanation
calm and short, then move to the prepared fallback.

## Frontend Dynamic Import `SYSTEM_HALT`

Action:

- Click the visible refresh/reload button if the app shows one.
- Press `Ctrl+F5`.
- Open an incognito window.
- If needed, restart the frontend path:

```powershell
docker compose up -d --build frontend nginx
```

Then hard refresh the browser.

## CV Upload Timeout

Action:

- Explain that CV analysis is service-dependent and uses timeout/recovery
  handling.
- Return to the dashboard and check whether analysis completed.
- Use a pre-uploaded demo user with a previous successful analysis if time is
  limited.

## AI Analyzer Slow

Action:

- Show a previous successful analysis from the demo user.
- Explain the service-based architecture: Laravel sends the CV to the Python AI
  analyzer and handles timeout/recovery behavior.
- Mention that a richer asynchronous progress flow is future work.

## No Recommended Jobs

Action:

- Use prepared demo jobs or reliable imported API data.
- Check that the selected CV persona has skills overlapping the demo jobs.
- Run admin diagnostics only if time permits.

## External Scraping Blocked

Action:

- Explain that public HTML sources can block automated access.
- Show the source matrix and diagnostics.
- Do not treat blocked LinkedIn, Indeed, Upwork, or similar public sources as a
  full application failure.
- Do not create fake external-source results to hide blocked access.

## Admin Page Unavailable

Action:

- Confirm the admin account and role.
- Try a separate incognito session.
- If the page is still unavailable, use prepared screenshots or the admin
  documentation to explain diagnostics.

## Docker Stale Frontend

Action:

```powershell
docker compose up -d --build frontend nginx
```

- Wait for the containers to restart.
- Open a fresh browser tab or incognito window.
- Press `Ctrl+F5`.
