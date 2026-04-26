# QUAD Production Deployment Blueprint

## What this adds
- Nginx load balancer
- Two API instances behind least-connection routing
- PostgreSQL for transactional data
- Redis for cache/rate-limit/session patterns
- MongoDB for future analytics/content/event streams
- Web container served through Nginx reverse proxy

## Run (after Docker Desktop is installed)
1. Open terminal in `infra`
2. `docker compose -f docker-compose.production.yml up -d`
3. Run migrations inside api container:
   - `docker exec -it quad-api-1 sh`
   - `npm run prisma:migrate -w apps/api -- --name init`
   - `npm run seed -w apps/api`

## Notes
- Current codebase runs locally with SQLite for immediate development.
- For production Postgres, update Prisma datasource provider and migration plan before go-live.
- This file is a deployment architecture starting point; add observability (Prometheus/Grafana/Sentry), secrets manager, and CI pipeline next.
