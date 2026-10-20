# OVERNIGHT_LOG

(Final summary goes at the top when the run finishes. Task log below is updated after every task.)

## Branch note
`phase-1-stabilize` did not exist; it was created from `phase-0-security` (HEAD `2518a8a`). `AUDIT.md` was untracked and is committed with this log. No `ROADMAP.md` exists.

## Part A — Phase 1

### 1. Route mounting — DONE (4deeedb)
- `order.routes.ts` now exports `cartRouter`, `wishlistRouter`, `orderRouter`, `shipmentRouter`, mounted at `/api/cart`, `/api/wishlist`, `/api/orders`, `/api/shipments`. Global `router.use(authenticate)` removed; `authenticate` applied per route.
- Same leak existed in `admin.routes.ts` (`router.use(authenticate); router.use(authorize('ADMIN'))` on a router mounted at `/api` gated invoice/upload/bulk-import for non-admins). Scoped to `/admin`; Bull Board mount moved from `/queues` to `/admin/queues` to match its `setBasePath`.
- Webhook mount untouched.
- Verify: integration tests (task 6).

### 2. Contract check — DONE
- `scripts/check-api-contract.mjs` (run `node scripts/check-api-contract.mjs`): statically lists backend routes (route files + mounts in `server.ts`) and diffs against every `apiClient.<verb>(...)` call in `frontend/src`; exits 1 on drift. Wired into CI in task 8.
- Found only the known mismatches: `cartStore` / `wishlistStore` used `/orders/cart…` and `/orders/wishlist…`; fixed in the frontend.
- Added `typecheck` script to frontend.
- Limit: only literal/template-string paths in `apiClient|api.<verb>(` calls are seen.

### 3. Dockerfile + compose — DONE (d18ae6d)
- `backend/Dockerfile`: multi-stage; builder runs `prisma generate` + `npm run build` (no `|| tsc --noEmit` masking); production stage `npm ci --omit=dev`, copies `node_modules/.prisma` + `dist` + `prisma`, runs as `node` user, `HEALTHCHECK` on `/health`, `CMD node dist/index.js`. Added `.dockerignore`.
- `backend/docker-compose.yml`: `postgres` (host 5433), `redis` (host 6380), one-shot `migrate` (builder stage, `prisma migrate deploy`), `api` (waits for migrate + redis), `postgres-test` (profile `test`, tmpfs, host 5434). Host ports are offset so it does not clash with a local Postgres/Redis.
- `package-lock.json` was out of sync with `package.json` (`npm ci` failed in Docker); regenerated with `npm install --package-lock-only`. **The old `deploy.yml` `npm ci` would have failed the same way.**
- Verified: `docker compose build` OK; `up -d` → migrate exit 0, api healthy, `/health` 200, public GETs 200, protected 401.
- Gotcha: compose auto-reads `backend/.env` for `${VAR}` interpolation; I always used `--env-file <scratch file with fake secrets>`.
- Required env for compose: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (the API runs with NODE_ENV=production by default; set `API_NODE_ENV=development` for local).

### 4. Migrations — DONE (no new migration needed)
- `prisma migrate deploy` on an empty Postgres applies all 4 migrations cleanly. The second `…172837_add_review_helpful_count` is an empty no-op migration (the first adds the column), so no idempotent fix migration was required; applied migrations untouched.
- `prisma migrate diff --from-config-datasource --to-schema` after deploy: "No difference detected" (schema == migrations).

### 5. Seed — DONE (48fc85f)
- `backend/prisma/seed.ts` + `migrations.seed` in `prisma.config.ts`; run `npm run db:seed`. Upserts on natural keys (idempotent; verified twice). Admin 9000000001, vendors 9000000011-12, farmers 9000000021-23, 4 categories, 6 products / 8 variants, 3 coupons, 3 khata accounts, farmer wallets.
- Passwords: `SEED_<ADMIN|VENDOR|FARMER>_PASSWORD` or `SEED_PASSWORD`, else documented dev default `Password@123`. Refuses to run with `NODE_ENV=production`. Existing users' passwords are never reset.

### 6. Backend test harness — DONE (0f3afce, ebbe170)
- Vitest 2 projects: `unit` (src, no DB) and `integration` (`tests/integration`, real Postgres via `TEST_DATABASE_URL`, default `postgresql://test:test@localhost:5434/multivendor_test`, global setup runs `prisma migrate deploy`, refuses non-local hosts). Supertest against the real `app`.
- Tests: health + 404, auth (register/login/me/duplicate/wrong password/blocked user), public endpoints without token, router-scoping regression (non-admin reaches invoice route; `/api/admin/*` still ADMIN-only), cart + wishlist full flows, old `/orders/cart` gone.
- Run: `docker compose --profile test up -d postgres-test` then `npm test` (96 tests incl. 47 pre-existing unit tests).
- Found & fixed while writing tests: **anyone could self-register as ADMIN** (`registerSchema` allowed ADMIN/DELIVERY). Now only FARMER/VENDOR (0f3afce). Admins come from the seed / DB; there is still no admin-provisioning endpoint.
- `npm run typecheck:tests` typechecks `tests/` and `prisma/seed.ts`.
