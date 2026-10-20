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

### 7. Backend ESLint + Prettier — DONE (e385b2d, 114c784)
- `eslint.config.mjs` (typescript-eslint recommended + eslint-config-prettier), `.prettierrc.json` (single quotes, 120 cols, trailing commas), scripts `lint`, `lint:fix`, `format`, `format:check`.
- Fixed 3 errors (lazy `require`s now carry a justified disable) and unused imports. **0 errors, 9 warnings** (unused params in payment stubs / dead analytics vars in enterprise service, left for the phases that rewrite them).
- `no-explicit-any` is OFF (≈180 legacy `any`s in services/repositories) — tracked tech debt, not hidden.
- 114c784 is a pure Prettier reformat of the backend (no functional change) — review with `git diff -w` or skip it.

### 9. /health + /ready — DONE (edcc0aa)
- `/health`: 200 only if DB `SELECT 1` is up and Redis (if `REDIS_URL` is set) answers PING; otherwise 503 with `{checks:{database,redis}}`; Redis reports `disabled` when unconfigured. `/ready`: same checks, plus 503 once SIGTERM/SIGINT marks shutdown. Unit tests (injected checkers) + integration tests. Redis path verified manually against the docker Redis (up) and a dead port (down).
- Docker HEALTHCHECK uses `/health`, so a Redis outage marks the container unhealthy (intentional: queues need it).

### 8. Root CI — DONE (65aeda5)
- `.github/workflows/ci.yml`: on `pull_request`, push to non-main branches, and `workflow_call`. Jobs: backend (Postgres 16 service; `prisma generate`, `prisma validate`, eslint, prettier check, tsc, tsc for tests, vitest unit+integration, build), frontend (eslint, tsc, vitest, next build), contract (`scripts/check-api-contract.mjs`).
- `deploy.yml`: only change is a new `ci` job (`uses: ./.github/workflows/ci.yml`) and `needs: ci` on `lint-and-build`. Triggers/steps/secrets untouched. Removed dead `backend/.github/workflows/ci.yml`.
- Not verifiable locally (needs GitHub): YAML parses; every command in the workflow was run locally.

### 10. .env.example — DONE (f078bf9)
- Rewritten from a grep of every `process.env.X` the code reads; unused vars moved to a "reserved" section; `OVERDUE_AUTO_SUSPEND_DAYS` → `OVERDUE_SUSPEND_DAYS` (what the code reads). Unit test `envExample.test.ts` fails if source reads a variable that is not documented.

### 11. Housekeeping — DONE (def9ef4)
- Removed 13 committed PNGs in `frontend/`, 14 empty `placeholder.ts`, `bull` (unused; `bullmq` kept, `ioredis` added as an explicit dep since `queues.ts` imports it), `@types/helmet`.
- `npm audit` (real registry; the default registry here is a mirror without audit): backend 22 → 9, frontend 19 → 7 via in-range updates only (csv-parse, joi, morgan, multer, axios, qs, socket.io-parser, engine.io, proxy-addr, fast-uri, js-yaml, brace-expansion, hono, undici, browserslist, tailwind postcss) and **Next 16.2.9 → 16.4.2 (+ eslint-config-next)** for a critical advisory; frontend build/tests/lint verified on it.
- Left: backend `prisma` 7.8.0 → 7.10.1 (CLI/dev-tooling chain; bumping pinned prisma+client+adapter was not "safe" unattended), `vitest` (dev), eslint-config-next→braces chain (dev). `npm audit fix` itself crashes on this tree (npm arborist bug with vitest peers), so updates were done package by package.
- Both lockfiles resolve through `registry.npmmirror.com` (already the case before tonight). Works, but regenerate with the default registry when convenient.

### 12. Frontend — DONE (67abbfe)
- ESLint warnings 125 → 62 (0 errors): removed 53 unused imports/vars/params, fixed alt-text false positives (lucide `Image` icon renamed), `useMemo` dep. **Not changed: 20 `<img>` → `next/image`** because product images are user-supplied URLs from unknown hosts (needs `images.remotePatterns` decided by you) and ~40 destructured-but-unused pagination values.
- Review fixes: (1) session no longer wiped on a network/5xx error during silent refresh (only 400/401/403); (2) checkout delivery estimate honours FREE_DELIVERY coupons; (3) register role enum matches the backend (FARMER/VENDOR).
- **Found, not fixed in Phase 1 (fixed server-side in Part B if reached):** checkout shows a ₹40 delivery charge for subtotal < ₹500 but the backend charged whatever the client sent (nothing) → displayed total ≠ charged total; no online payment step exists (Razorpay out of scope).
