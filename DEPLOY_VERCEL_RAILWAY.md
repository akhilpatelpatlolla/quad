# QUAD Go-Live (Vercel + Railway + Postgres)

This guide deploys:
- Web: Vercel (`apps/web`)
- API: Railway (`apps/api`)
- DB: Railway Postgres plugin (or external Postgres with SSL)

## 1) Generate secure secrets

Use a 64-char JWT secret:

- PowerShell:
  - `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

Save it as `JWT_SECRET`.

## 2) Railway setup (API + Postgres)

1. Create a new Railway project.
2. Add a **Postgres** service.
3. Add your repo service (root of this repo).
4. Set service root to repository root (default), `railway.json` handles build/start.
5. Add environment variables to API service:
   - `DATABASE_URL` -> from Railway Postgres `DATABASE_URL` (must include SSL params when required)
   - `JWT_SECRET` -> generated strong secret
   - `CLIENT_URL` -> your Vercel production URL (later update with real URL)
   - `ALLOWED_ORIGINS` -> comma-separated origins:
     - `https://<your-vercel-app>.vercel.app`
   - `NODE_ENV=production`
6. Deploy API.

Health check endpoint:
- `/api/health`

## 3) Apply database schema in production

Because current local history has drift, first production bootstrap should use:

- `npm run prisma:push`

Then, for later releases, move to migration-based deploys (`prisma migrate deploy`) once migration history is cleaned and baseline is established.

## 4) Vercel setup (Web)

1. Import this repository into Vercel.
2. Set **Root Directory** to `apps/web`.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add environment variables:
   - `VITE_API_URL=https://<railway-api-domain>/api`
   - `VITE_SOCKET_URL=https://<railway-api-domain>`
6. Deploy.

`apps/web/vercel.json` already includes SPA rewrite support.

## 5) Backlink API to web origin

After Vercel deploy gives you URL:

1. Update Railway API vars:
   - `CLIENT_URL=https://<vercel-url>`
   - `ALLOWED_ORIGINS=https://<vercel-url>`
2. Redeploy Railway service.

## 6) Post-deploy smoke checks

- Web loads and routes work (`/`, `/login`, `/register`, `/app`)
- Auth register/login
- Publish in all modules with allowed roles
- Mentorship create/list
- Notifications mark-read
- Realtime batch messages
- Group join/approve/reject
- Owner console controls
- `/api/health` returns `{ ok: true }`

## 7) Security defaults already integrated

- Strict env validation (process exits on missing/weak values)
- JWT secret length enforcement (>=32 chars)
- CORS allowlist support + Vercel preview allowance
- Helmet + compression + request rate limiter
- Graceful shutdown with Prisma disconnect

## 8) Recommended next hardening

- Add Sentry for API + web
- Add structured logging (pino) and request IDs
- Add Redis rate-limit store for multi-instance API
- Add CI pipeline for build + Prisma checks + deployment gates
