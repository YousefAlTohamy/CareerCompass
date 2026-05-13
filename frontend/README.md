# CareerCompass Frontend

React + Vite frontend for the CareerCompass user and admin experience.

## Runtime Role

- Served through the Docker Nginx reverse proxy at `http://localhost`.
- Calls the backend through an environment-based API base URL.
- Defaults to `/api/v1`, which lets browser traffic go through Nginx without hardcoded container addresses.
- Includes retry handling for idempotent API requests and request ID propagation.

## Environment

`frontend/.env.example`:

```env
VITE_API_URL=/api/v1
VITE_API_PROXY_TARGET=http://localhost:8000
```

In Docker Compose, `VITE_API_PROXY_TARGET` is overridden to `http://nginx` for container networking.

## Docker Usage

From the repository root:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build frontend nginx
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f frontend
```

Open:

```text
http://localhost
```

## Optional Local Development

Only use this if you intentionally want host-based frontend development:

```bash
npm ci
npm run dev
npm run lint
npm run build
```

Docker operation does not require host `node_modules`.

## Production Build Notes

- `Dockerfile.prod` builds static Vite assets in a Node stage.
- Static assets are served by `nginxinc/nginx-unprivileged`.
- Vite manual chunks split React, UI libraries, charts, animation, i18n, and Spline.
- Keep `VITE_API_URL=/api/v1` for the Docker/Nginx path.

## Troubleshooting

- If the frontend cannot reach the backend, check `VITE_API_URL`, Nginx logs, and `http://localhost/api/v1/health`.
- If local Vite proxy fails, check `VITE_API_PROXY_TARGET`.
- If a rebuild seems stale, run `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build frontend nginx`.
