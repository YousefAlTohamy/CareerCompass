# Final Smoke Test

Run this checklist on the final demo machine before the graduation defense.
These commands and checks are for demo readiness, not production deployment.

## Command Checks

```powershell
docker compose ps
curl.exe -I http://localhost/
curl.exe -I http://localhost/api/health
curl.exe -I http://localhost/api/ready
curl.exe -I http://localhost/api/v1/health
curl.exe -I http://localhost:5173/
curl.exe -I http://localhost:8000/
curl.exe -I http://localhost:8003/health
```

If `curl.exe` is not available, open the URLs in a browser and confirm they
return a successful page or health response.

## Manual Checks

- [ ] Home loads.
- [ ] Login works.
- [ ] User dashboard loads.
- [ ] CV upload works with a sample synthetic file.
- [ ] Skills appear after analysis.
- [ ] Jobs page loads.
- [ ] Gap analysis loads for a selected job.
- [ ] Tracker saves an opportunity.
- [ ] Admin dashboard loads.
- [ ] Admin sources page loads.
- [ ] Status page reflects `/ready`.
- [ ] No `SYSTEM_HALT` screen appears after hard refresh.
- [ ] No raw errors are visible to users.

## Before Entering The Defense Room

- Keep the sample CV file on the machine.
- Keep the student and admin credentials outside git.
- Keep screenshots ready as fallback.
- Avoid starting public scraping runs unless the defense specifically asks for
  that pipeline.
