# QUAD

Premium interactive full-stack MVP for India's verified student ecosystem.

## Local Runtime (working now)
- Frontend: http://localhost:5173
- API: http://localhost:4000/api/health
- Database: PostgreSQL (see `apps/api/.env` → `DATABASE_URL`). The web app proxies `/api` and `/socket.io` to port **4000** in dev (see `apps/web/vite.config.ts`); set `VITE_API_URL` empty in `apps/web/.env` to use the proxy.
- `JWT_SECRET` must be at least **32 characters** or the API will not start.

## What is implemented
- Student signup and login with JWT
- Verified identity gate (read-only until approved)
- Admin verification command center
- Campus Wall, Batch Room (realtime), Bazaar, Opportunities, Perks, Resources, Events, Study Rooms
- Premium UI redesign with motion, quick command palette (`Ctrl/Cmd+K`), live stats, contextual search
- API hardening with compression, in-memory rate limiting, pagination for key list APIs

## Run from scratch
1. `npm install`
2. `npm run prisma:generate`
3. `npm run prisma:migrate -- --name init`
4. `npm run seed`
5. `npm run dev`

## Seeded admin
- Email: admin@quad.in
- Password: Admin@123

## Production architecture templates
- [infra/docker-compose.production.yml](infra/docker-compose.production.yml)
- [infra/nginx/default.conf](infra/nginx/default.conf)
- [infra/DEPLOYMENT.md](infra/DEPLOYMENT.md)
- [DEPLOY_VERCEL_RAILWAY.md](DEPLOY_VERCEL_RAILWAY.md)

## Docker status on this machine
- Docker Desktop installation was attempted via winget but failed because administrator elevation is required.
- Once installed with admin privileges, use the infra templates to run load-balanced multi-service deployment.
