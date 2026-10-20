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

## Part B — Phase 2 (money correctness) — branch `phase-2-money` (from `phase-1-stabilize`)

Part A was fully green before starting (backend lint/tsc/build/tests, frontend lint/tsc/vitest/build, docker build + up, contract check).

### B1. Khata ledger — DONE (72ef8dc schema, 368310e code)
- `src/modules/khata/khata.ledger.ts` → `postKhataEntry(tx, …)` is now the ONLY writer of `outstandingAmount`: `SELECT … FOR UPDATE` on the account, `balanceAfter` computed from the locked row, entry + balance written in the caller's interactive transaction. `KhataService.addTransaction`, the order flow and the interest cron all go through it.
- `idempotencyKey` (new nullable UNIQUE column on `khata_transactions`): a repeated key returns the original entry (`replayed: true`). The HTTP endpoint accepts an `Idempotency-Key` header or `idempotencyKey` body field (namespaced per account).
- Status rules: a posting only moves ACTIVE↔SETTLED; it never overwrites OVERDUE/SUSPENDED (old code forced ACTIVE on every debit). A full repayment settles an OVERDUE account. SUSPENDED/WRITTEN_OFF still reject postings (unchanged). Credits larger than the balance are rejected (balance cannot go negative); interest may exceed the credit limit, other debits may not.
- Due date: only UDHAR_DIYA/ORDER_LINKED restart the repayment clock; interest postings no longer push `dueDateNextPayment` out (old code did).
- Interest cron: key `interest:<accountId>:<UTC date>` → running it twice in a day posts once; amount rounded to 2 dp.
- `reconcileKhata(accountId?)`: compares `outstandingAmount` with the signed ledger sum (debits − credits), returns only mismatches. **Not wired to a cron/endpoint yet** (call it from a script/REPL or add an admin route); it is read-only.

### B2. Order creation — DONE (1908956)
- `OrderService.create` is a single interactive transaction (`maxWait 15s / timeout 30s`): (0) claim the cart items by deleting them (a double-submit/second tab now fails with 409 instead of ordering twice), (1) conditional stock decrement via `UPDATE … WHERE stock - reservedQty >= qty RETURNING sellingPrice` (price taken from the locked row; 0 rows ⇒ "Insufficient stock" and everything rolls back), (2) coupon `usedCount` conditional increment inside the same transaction (limit can't be exceeded; a failed order no longer burns a use), (3) khata/wallet legs under row locks, (4) the order, items, status history, vendor commissions.
- `reservedQty`: no longer touched at checkout (stock is decremented immediately; the old code decremented a counter that nothing ever incremented and drove it negative). Availability is `stockQuantity - reservedQty`.
- Delivery charge computed server-side (`orders/pricing.ts`): free at subtotal ≥ `DELIVERY_FREE_THRESHOLD` (default 500) or with a FREE_DELIVERY coupon, else `DELIVERY_CHARGE` (default 40) — the same rule the checkout page displays. `deliveryCharge` was removed from the request schema. Coupon discount is capped at the subtotal.
- Order numbers come from a Postgres sequence (`order_number_seq`, new migration `20261020181000…`, initialised past the highest existing `KB-yyyy-nnnnnn`) — the old "read last + 1" gave concurrent checkouts the same number.
- Khata checkout hardening (not asked, but it was a money hole): the khata account must belong to the caller's farmer profile, be ACTIVE, and every item must be sold by the khata's vendor (a vendor-A khata can no longer pay for vendor-B goods). **Behaviour change:** mixed-vendor carts can't be paid on khata.
- `cancel()`: conditional status transition (two concurrent cancels ⇒ one wins), stock restored once, wallet refund / khata reversal once (idempotency keys). Khata reversal is clamped to what is still owed (a partly repaid order is not over-credited).
- `InventoryService.adjust` (vendor stock adjustments) is now an atomic conditional update (was read-then-write) — aae3309.

### B3. Wallet — DONE (58a4a35)
- `payments/wallet.ledger.ts` `creditWallet/debitWallet`: lock the wallet row, then atomic `UPDATE … RETURNING` (debit carries `balance >= amount` in WHERE). Used by add-money, wallet payment, order wallet leg, cancel refund. Optional `idempotencyKey` (new column on `wallet_transactions`).

### B4. CHECK constraints — DONE (72ef8dc), migration `20261020180000_money_integrity`
- `outstandingAmount >= 0`, `stockQuantity >= 0`, `reservedQty >= 0`, `wallets.balance >= 0`. Safe on populated DBs: `reservedQty < 0` rows are reset to 0 (known artefact of the old bug); each constraint is added `NOT VALID` (enforced for all new writes immediately) and `VALIDATE`d only if no existing row violates it, otherwise a `WARNING` names the table. Tested on a scratch DB seeded with negative stock/wallet rows: migration succeeds, constraints stay NOT VALID for the dirty tables.
- **Before production:** check the migration output for `WARNING … left NOT VALID` and repair those rows.

### B5. Concurrency tests — DONE (96ff8dd, aae3309)
`tests/integration/khataLedger.concurrency.test.ts`, `orders.concurrency.test.ts` on real Postgres, all passing:
100 parallel khata debits → exact balance, distinct balanceAfter set, reconciles; limit 500 with 100×10 → exactly 50 succeed; mixed debits/repayments net exactly; idempotency key ×10 parallel → 1 entry; overpayment rejected; OVERDUE not overwritten; interest cron idempotent; reconciliation detects tampering; DB rejects negative outstanding/wallet/stock/reserved.
50 parallel orders for stock 10 → exactly 10 succeed, stock 0; failed order rolls back stock/coupon/cart; coupon limit 5 with 20 parallel orders → exactly 5; same cart submitted 5× → 1 order; khata limit via orders; khata ownership/vendor checks; double-cancel; server delivery charge (client value ignored, negative ignored, free ≥ 500); 50 parallel wallet debits of 10 on 100 → exactly 10; parallel credits + idempotency; 20 parallel stock adjustments on 10 → exactly 10.

### Not done / open risks (Part B)
- **Not touched by design:** real Razorpay, GST split, sub-orders.
- Wallet payment is still double-chargeable by flow design: `POST /orders` with `WALLET` debits immediately, and `POST /payments/initiate`/`/wallet/pay` with WALLET debits again for the same order (each leg is atomic, but nothing links them). Needs the payments redesign.
- `POST /wallet/add-money` still credits without a verified gateway payment (audit item; out of scope).
- Per-user coupon limits (`perUserLimit`), coupon scoping (`applicableTo`) are still not enforced.
- Interest cron semantics unchanged: it skips accounts whose last transaction is within `INTEREST_GRACE_PERIOD_DAYS`, and each posting counts as a transaction, so with the default grace of 7 days interest effectively posts weekly at the *daily* rate. Looks like a pre-existing business-logic bug; I did not change the rate semantics.
- Vendor-initiated `PUT /orders/:id/status` → CANCELLED/REFUNDED still does not reverse khata/restore stock (only the farmer cancel path does).
- Lost-update protection for the cart quantity between read and claim is not handled (claim checks row identity, not quantity).
