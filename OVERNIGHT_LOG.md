# OVERNIGHT_LOG

> This file has two runs. **Run 2 (branch `phase-3-orders-gst`) is summarised first**; the Run 1 summary
> (Phase 1 + Phase 2) follows it, then the per-task logs for both runs.

## Run 2 — morning summary (Phase 2.5 + Phase 3)

**Branch:** `phase-3-orders-gst`, cut from `phase-2-money` (the checkout was on `main` when the run started; nothing was changed there). 17 commits (including this log), nothing pushed, no remotes touched, `main` and `backend/.env` untouched, no deploy secrets/scripts touched. `ROADMAP.md` does not exist in the repo.

**Final check results (last step of the run):**

| Check | Result |
|---|---|
| Backend eslint / prettier / tsc / tsc (tests+seed) / build | 0 errors (7 warnings, unused params in payment stubs) / clean / pass / pass / pass |
| Backend tests (empty DB → all 10 migrations → vitest) | **30 files, 240 tests pass** (unit + integration + concurrency + migration-backfill) |
| Frontend eslint / tsc / vitest / `next build` | 0 errors (66 warnings, pre-existing) / pass / 54 pass / pass |
| `scripts/check-api-contract.mjs` | OK (184 backend routes, 144 frontend calls) |
| `docker compose build` + `up` on an EMPTY database (throwaway project, then removed) | pass: migrate applied all **10** migrations (9 on first boot, the 10th — address timestamps — after the fix below), api healthy, `/health` = db up + redis up; then seeded and a real HTTP smoke test (farmer, 3-vendor cart → quote → khata order) passed against the container |
| GitHub Actions | YAML unchanged this run; not runnable locally |

**What works:**
- *Phase 2.5:* Razorpay behind a gateway interface (official SDK; fake gateway when no keys outside production), verified wallet top-ups (no direct credit path any more), one wallet debit per order across checkout / `/payments/initiate` / `/wallet/pay`, webhook event log (idempotent redelivery) handling captured / failed / refund.processed, gateway refunds in paise (Decimal math), interest cron fixed (daily, idempotent, grace from real transactions), daily ledger reconciliation + admin endpoint, lockfiles on `registry.npmjs.org`, Razorpay Checkout.js on the checkout and wallet pages.
- *Phase 3:* per-vendor sub-orders in one transaction (all Phase 2 stock/coupon/khata/wallet guarantees kept), GST engine (CGST+SGST vs IGST), vendor-scoped coupons + per-user limits, per-vendor khata, ownership-checked vendor actions, vendor reject / customer cancel per sub-order, derived parent status, gapless per-vendor invoice numbers + credit notes (PDF), full returns lifecycle with restock / gateway refund / wallet / khata reversal, frontend for all of it, seed with 3 vendors in 3 states.

**Bugs found along the way (fixed):** `GET /api/addresses` returned 500 for everybody (the table had no `createdAt`; the address page and checkout could not have worked — found only by the final Docker smoke test); any vendor could change any order's status, add shipment events to any shipment and download any invoice; payment confirmation never looked at what a refund cancelled; the old wallet top-up credited money with no payment.

**Blocked:** nothing reverted or blocked.

**Review first** (full list under "Needs human review" below): the three money-moving files (`payment.service.ts`, `order.checkout.ts`, `subOrder.service.ts`/`return.service.ts`), the Phase 3 migration backfill on a copy of real data, a Razorpay **sandbox** run (never exercised against Razorpay itself), and the breaking API changes (`/payments/verify` body, `/wallet/add-money`, removed `POST /orders/:id/return`).

**Run the stack locally** (from `backend/`; compose reads `backend/.env` for interpolation unless you pass `--env-file`):
```bash
export JWT_ACCESS_SECRET=$(openssl rand -hex 48) JWT_REFRESH_SECRET=$(openssl rand -hex 48) RAZORPAY_WEBHOOK_SECRET=$(openssl rand -hex 16)
export API_NODE_ENV=development          # no Razorpay keys needed: the fake gateway auto-completes payments
docker compose up --build -d             # postgres:5433 redis:6380 migrate api:3000
DATABASE_URL="postgresql://multivendor:multivendor_dev@localhost:5433/multivendor" npm run db:seed
#   logins (password Password@123): admin 9000000001 | vendors 9000000011 (UP) 9000000012 (MH) 9000000013 (KA) | farmers 9000000021 (UP) 22 (MH) 23 (KA)
cd ../frontend && npm ci && NEXT_PUBLIC_API_URL=http://localhost:3000/api npm run dev
# tests
cd ../backend && docker compose --profile test up -d --wait postgres-test && npm test
node ../scripts/check-api-contract.mjs
```
For production set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (all required) and register the webhook `https://<api>/api/payments/webhook/razorpay` for `payment.captured`, `payment.failed`, `refund.processed`.

**Try the GST split by hand:** log in as farmer 9000000021 (Uttar Pradesh), put one product from each of the three vendors in the cart, open checkout: the vendor in UP shows CGST+SGST, the other two IGST; pay with khata credit (that farmer has a khata with all three) or the ₹5000 seeded wallet.

---

# Per-task log

## Run 1 morning summary (details)

**Branches:** `phase-1-stabilize` (Part A, 12 tasks) → `phase-2-money` (Part B, on top of it). Nothing pushed, no remotes touched, `main` untouched, `backend/.env` untouched.

**Final check results (run on `phase-2-money`, last step of the night):**

| Check | Result |
|---|---|
| Backend eslint | 0 errors, 9 warnings (unused params in payment stubs) |
| Backend prettier / tsc / tsc (tests+seed) / build | pass |
| Backend tests (empty DB → 6 migrations → vitest) | **20 files, 137 tests pass** (unit + integration + concurrency) |
| Frontend eslint / tsc / vitest / `next build` | 0 errors, 62 warnings / pass / 47 pass / pass |
| API contract check (`scripts/check-api-contract.mjs`) | OK (167 backend routes, 135 frontend calls) |
| `docker compose build` + `up` | pass; migrate applied all 6 migrations, api healthy, `/health` shows `database: up, redis: up` |
| GitHub Actions (`ci.yml`, `deploy.yml`) | YAML parses; **not runnable locally** — first real run happens on your first PR/push |

**What works:** route mounting/auth scoping fixed (cart/wishlist/orders at `/api/cart|wishlist|orders`, admin guard no longer gates other routers), frontend cart/wishlist paths fixed, Docker/compose, seed, test harness, lint/format, root CI, real `/health` + `/ready`, `.env.example` sync + drift test, safe dependency updates (Next 16.4.2), and the Phase 2 money work (row-locked khata ledger, atomic wallet, single-transaction checkout, server-side delivery charge, CHECK constraints, concurrency tests).

**Blocked / not done:** nothing reverted, nothing BLOCKED. Deliberately left: `<img>`→`next/image` (needs your decision on allowed image hosts), `prisma` 7.8→7.10 bump, remaining dev-only audit findings, ~180 backend `any`s (lint rule off), and the open risks listed under "Not done / open risks (Part B)" below.

**Review first:**
1. **Security found & fixed along the way:** anyone could self-register as ADMIN (`0f3afce`); the admin router's unscoped `router.use(authorize('ADMIN'))` blocked invoice/upload/bulk-import for non-admins; khata checkout let any user charge any khata account.
2. Migrations `20261020180000_money_integrity` and `20261020181000_order_number_sequence`: on a real/prod DB read the output for `WARNING … left NOT VALID` (dirty negative rows) before relying on the CHECKs.
3. Behaviour changes: khata can only pay for items of that khata's vendor; interest postings no longer move the due date; debits no longer reset OVERDUE→ACTIVE; double-submitting a cart now returns 409.
4. `deploy.yml` now runs CI first (`needs: ci`). Check the first PR run; the lockfiles resolve through `registry.npmmirror.com` (pre-existing).
5. `114c784` is a whole-backend Prettier reformat; use `git diff -w` / skip it when reviewing.

**Run locally** (from `backend/`; compose reads `backend/.env` for interpolation unless you pass `--env-file`):
```bash
export JWT_ACCESS_SECRET=$(openssl rand -hex 48) JWT_REFRESH_SECRET=$(openssl rand -hex 48) RAZORPAY_WEBHOOK_SECRET=$(openssl rand -hex 16)
docker compose up --build -d          # postgres:5433, redis:6380, migrate, api:3000
DATABASE_URL="postgresql://multivendor:multivendor_dev@localhost:5433/multivendor" npm run db:seed   # dev logins: 9000000001 (admin) / 9000000011 / 9000000021, password Password@123
curl localhost:3000/health
cd ../frontend && npm ci && NEXT_PUBLIC_API_URL=http://localhost:3000/api npm run dev
# tests
docker compose --profile test up -d --wait postgres-test && npm test
node ../scripts/check-api-contract.mjs
```
(Compose runs the API with `NODE_ENV=production`; set `API_NODE_ENV=development` for dev behaviour.)

---

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

---

# Run 2 — branch `phase-3-orders-gst` (from `phase-2-money`)

**Assumptions:** `ROADMAP.md` does not exist in the repo (read AUDIT.md + this log instead). The checkout was on `main` when run 2 started; nothing was changed there, the new branch was cut from `phase-2-money`.

## Part A — Phase 2.5

### A1–A3. Payments (wallet top-up, wallet idempotency, real Razorpay) — DONE (a986263)
- `payments/gateway.ts`: `PaymentGateway` interface; `RazorpayGateway` (official `razorpay` SDK, injectable client), `FakeGateway` (no network, records calls), `getGateway()` (keys set → Razorpay; unset outside production → Fake with a warning; unset in production → error, and env validation makes the keys mandatory in production). Decimal → paise only here (`toPaise`/`fromPaise`, half-up, exact; unit-tested on values that break floats).
- `POST /wallet/add-money` no longer credits. It creates a `Payment(purpose=WALLET_TOPUP)` + gateway order and returns Checkout details. The wallet is credited only inside `applyCapture` (called by `POST /payments/verify` after the HMAC `order_id|payment_id` check, or by the verified `payment.captured` webhook), idempotent on `topup:<paymentId>`. There is no other credit path (`WalletService.addMoney` was removed).
- `/payments/initiate` creates a gateway order (reuses an open one), `paymentId` in order notes. `/payments/verify` body is now `{paymentId, razorpay_order_id, razorpay_payment_id, razorpay_signature}` (**breaking API change**, frontend updated). Unique `gatewayOrderId`/`gatewayPaymentId` columns stop one gateway payment confirming two rows (409).
- Webhook: signature (unchanged) + `payment_webhook_events` table (unique `eventId` = `x-razorpay-event-id`, body hash fallback), insert and processing in one transaction ⇒ redelivery is a no-op and a crash rolls the insert back. Handles `payment.captured`/`order.paid`, `payment.failed`, `refund.processed`/`refund.failed`.
- Refunds: `RefundService.refundPayment` — reserves a `Refunds` row (PENDING) under a payment lock, never beyond the payment amount, moves money OUTSIDE the DB transaction (gateway refund in paise / wallet credit / COD recorded), idempotency key supported, finalised by `refund.processed` if the gateway answers "pending".
- Wallet double charge: one wallet debit per order via key `order-wallet:<orderNumber>` shared by checkout, `/payments/initiate` and `/wallet/pay` (order row locked; existing SUCCESS payment short-circuits). Checkout with WALLET now also records the SUCCESS payment and confirms the order. `/wallet/pay` requires the amount (if sent) to equal the order total.
- Migration `20261021090000_payments_gateway` (payments.orderId nullable, userId, purpose, gateway ids, refunds.paymentId/idempotencyKey, webhook event table; backfills userId from orders).
- Tests: `gateway.test.ts` (HMAC fixtures, paise, SDK payload shape), `tests/integration/payments.test.ts` (16 tests: no credit on add-money, bad/foreign signature, verify+webhook race ⇒ one credit, duplicate event ids, failed→retry, paise in gateway order, partial/full refunds, pending refund webhook, parallel wallet-payment flows).
- **Needs human review:** the verify path marks a payment SUCCESS on a valid signature without calling Razorpay's `fetch payment` API (standard Checkout flow; the webhook later confirms). Existing `payments.transactionId` values were left as is; the migration copies `pay_…` ids into `gatewayPaymentId` for SUCCESS rows.

### A4. Interest — DONE (3862568)
- Bug: every interest posting set `lastTransactionAt`, so with a grace period of N days interest posted once per N days at the daily rate. Now interest postings do not touch `lastTransactionAt`; grace is measured from the last real transaction. Daily compounding at `outstanding × rate ÷ 365 ÷ 100`, one posting per account per UTC day (key `interest:<acct>:<date>`). Documented in code and README. `runInterestCalculation({now, graceDays})` is injectable; tests simulate 5 consecutive days, same-day reruns, grace boundary, skipped statuses.

### A5. Reconciliation — DONE (52e9117)
- `runKhataReconciliation` (cron `CRON_RECONCILE_SCHEDULE`, default `30 2 * * *`): logs `[RECONCILE] DRIFT …` as an error and notifies every admin; `GET /api/admin/reconciliation/khata` (ADMIN only) returns `{ok, driftCount, drift[]}`. Tests cover detection, alerting, authorisation.

### A6. Registry — DONE (8f187a7)
- Both lockfiles: `registry.npmmirror.com` → `registry.npmjs.org` (host rewrite only; integrity hashes untouched). Verified with a clean `npm ci --ignore-scripts` of each lockfile in a scratch directory (integrity-checked against npmjs). Versions unchanged.

### A7. Frontend Razorpay — DONE (f0ef091)
- `lib/razorpay.ts` (Checkout.js loader, `runCheckout`, `verifyPayment`; auto-completes against the fake backend gateway in dev). Checkout page: online methods (UPI/card/net-banking) create the order then pay via Checkout, with a "Payment not completed" screen (retry / view order) for cancel and failure; COD records the payment; wallet and khata are settled server-side at checkout. Wallet top-up page uses the real flow (no direct credit). Unit tests for the helpers.


## Part B — Phase 3 (multi-vendor sub-orders, GST, invoices, returns)

### B1. GST engine — DONE (41f8d37)
- `backend/src/modules/gst/gst.ts` (pure, no I/O): intra-state → CGST+SGST (each at half the rate, rounded independently), inter-state → IGST; per-line rounding to 2 dp half-up; discount reduces taxable value; `allocateProportionally` (largest remainder in paise ⇒ parts always sum to the discount). `states.ts`: GST state codes, GSTIN format + state-prefix check. `orders/orderPricing.ts`: cart → per-vendor sub-orders, vendor-scoped coupon eligibility, per-sub-order delivery charge, commission on discounted taxable value.
- Rules are written at the top of `gst.ts` and in the README. Tests: 34 unit tests (same-state, cross-state, mixed rates, rounding edge cases such as 0.10 @5 %, discount allocation, vendor-scoped coupons, FREE_DELIVERY per vendor).

### B2. Schema + migrations — DONE (1a572f7)
- `20261022090000_suborders_gst_invoices`: `sub_orders`, `invoices`, `invoice_counters`, `return_items`, `coupon_usages`; columns on addresses (`stateCode`), vendors (`stateCode`, `businessAddress`, `invoicePrefix`), orders (GST summary), order_items (sub-order link + GST snapshot, `returnedQuantity`), shipments/vendor_commissions/returns/order_status_history (`subOrderId`), coupons (`vendorId`). **Backfill**: one sub-order per (order, vendor) — every existing single-vendor order gets exactly one; mixed-vendor legacy orders are split by vendor with delivery/discount shared pro rata (≤ 1 paisa drift possible); address/vendor state codes derived from the state name / GSTIN prefix (unmatched left NULL, never guessed); the new NOT NULL links are applied only after a check that nothing is orphaned (fails loudly otherwise). `20261022100000_vendor_invoice_prefix_seq`: sequence for vendor invoice prefixes.
- Verified three ways: `prisma migrate diff` after deploy = no drift; applied on the populated test DB (116 legacy orders, totals reconcile); automated scratch-DB test `migrationBackfill.test.ts` with legacy single- and two-vendor orders.

### B3. Checkout / sub-orders — DONE (2d12b11)
- `order.checkout.ts`: ONE interactive transaction keeps every Phase 2 guarantee — cart claim (double-submit ⇒ 409), conditional stock decrement (lock order: variants → coupon → khata accounts → wallet), coupon total limit + per-user limit under the coupon row lock (unique `(coupon,user,seq)` as a safety net), khata per vendor (each vendor's own account, `ORDER_LINKED` entry per sub-order, one failure rolls back all), wallet debit once, server-side delivery per sub-order. `POST /api/orders/quote` = same pricing, read-only.
- Vendor-scoped coupons (`applicableTo=VENDOR` + `vendorId`) discount only that vendor's lines; coupon discount distributed proportionally; tax is computed on the discounted value.
- Behaviour change vs Phase 2: the "khata only for single-vendor carts" restriction is gone (per-vendor accounts instead); a vendor without a GST state blocks checkout with a clear message; an address without a state is rejected.

### B4. Status, ownership, cancel/reject, shipments — DONE (2d12b11)
- `subOrder.service.ts`: vendors act only on their own sub-orders (403 otherwise) on `/api/sub-orders/*`; legacy `PUT /orders/:id/status` now acts on the caller's own sub-order only; shipments + events are ownership-checked via their sub-order (customers can read their own, other sellers cannot). Transition machine (`orderStatus.ts`): PENDING→CONFIRMED→PROCESSING→PACKED→SHIPPED→DELIVERED; vendor reject/cancel allowed up to PROCESSING (reason required), customer cancel only PENDING/CONFIRMED, per sub-order; online-paid orders cannot be accepted before payment. Parent order status is derived (least advanced active sub-order). Cancel returns stock, drops the commission, reverses khata with a reversing entry (clamped; excess to wallet), refunds the sub-order's share through `RefundService` (gateway/wallet) after commit. A payment captured after the order was cancelled is refunded automatically.
- Order detail for a vendor shows only their sub-order(s); settlement generation now works per sub-order.

### B5. Invoices + credit notes — DONE (2d12b11)
- Tax invoice per sub-order, issued when it ships (time of supply). Gapless per vendor / financial year / series via `invoice_counters` (row-locking upsert in the invoice's own transaction ⇒ a rolled-back invoice returns its number). Format `V001/2627/000001` (≤16 chars); credit notes `V001C/2627/00001`. Fields: seller name/GSTIN/state/address, buyer, place of supply, CGST/SGST/IGST, HSN per line. PDF via pdfkit (all money from Decimal strings, no Number). Access: customer, owning seller, admin. The old order-level invoice code had a bug where **any vendor could read any invoice**; fixed.

### B6. Returns — DONE (2d12b11)
- `REQUESTED → APPROVED → RECEIVED → REFUNDED | CREDITED` (+ `REJECTED`), per sub-order, item/quantity level, within `RETURN_WINDOW_DAYS`. Receive can restock (Inventory log either way). Resolve issues the credit note (pro rata, exact remainder on the last units so notes sum to the invoice) and refunds: gateway (paise) for online, wallet for wallet/COD, a reversing `WAIVER` khata entry for khata (old entries never edited; already-repaid part goes to the wallet). Gateway failure keeps the return RECEIVED; retrying resolves with one credit note and one refund (refund idempotency key; a FAILED refund row is retried in place). Commission shrinks with credited value.

### B7. Frontend — DONE (2de7f14)
- Checkout: quote-driven per-seller cards with CGST/SGST/IGST lines, per-seller delivery, totals from the server; khata shown per seller (usable only if every seller has an active account). Order detail: one card per seller with status, tracking, GST lines, invoice download, cancel-this-part and a return dialog (items + quantities + reason), returns with credit-note download. Vendor orders page now lists/acts on the seller's own sub-orders (accept, process, pack, ship with AWB, tracking updates, reject with reason, invoice). New vendor Returns page (approve/reject/receive/refund) + nav entry. Address form uses a state (GST code) dropdown; vendor profile gets state + business address with GSTIN/state consistency check.
- `scripts/check-api-contract.mjs` stays green (184 backend routes / 144 frontend calls).

### B8. Seed — DONE (97a4394)
- 3 vendors in Uttar Pradesh / Maharashtra / Karnataka with valid-format GSTINs and addresses (`9000000011-13`), 3 farmers each with an address in the same three states and a ₹5000 wallet (`9000000021-23`), products at 0/5/12/18 % across vendors, per-vendor khata for farmer 0 with all three vendors, and a vendor-scoped coupon `GREENVALLEY50`. Idempotent (run twice on a DB that already had the old seed).

### B9. Tests
- New: `subOrders.test.ts` (26), `invoices.test.ts` (9), `returns.test.ts` (12), `migrationBackfill.test.ts` (4), plus unit tests for GST, order pricing, order status; Phase 2 concurrency tests (khata, orders, wallet, inventory) all still pass (two were updated for the new per-vendor khata and cancel semantics).

---


### B10. Address timestamps — DONE (found by the final Docker smoke test)
- `GET /api/addresses` failed with HTTP 500 for every caller: the service sorts by `createdAt` but `addresses` had no such column, so the addresses page and checkout could not have worked end to end. Migration `20261022110000_address_timestamps` adds `createdAt`/`updatedAt`; `checkoutHttp.test.ts` drives the whole farmer journey over HTTP (address → cart → quote → order → detail → seller views).

## ASSUMPTIONS (run 2)
1. `ROADMAP.md` does not exist; AUDIT.md + this log were the references. The checkout was on `main` when the run started (nothing changed there); `phase-3-orders-gst` was cut from `phase-2-money`.
2. Delivery charge: per sub-order (each vendor ships separately), free at subtotal ≥ ₹500 (before tax/discount), else ₹40; no GST on delivery; not refunded on returns.
3. Prices are GST-exclusive (as before); vendors collect GST at the product's `gstRate` regardless of GSTIN (unregistered-vendor "bill of supply" is out of scope).
4. Invoice is issued at SHIPPED (time of supply). The financial year is 1 Apr–31 Mar in IST. Vendor prefixes are `V` + 3 base-36 characters from a sequence.
5. COD payments are recorded at checkout (PENDING) and flipped to SUCCESS when every vendor has delivered; COD returns are refunded to the customer's wallet.
6. A wallet-paid order is CONFIRMED immediately (the wallet leg is the payment).
7. Parent order status = least advanced active sub-order (RETURNED/REFUNDED count as delivered for progress).
8. Coupon redemptions are not given back when an order is cancelled.
9. `/payments/verify` trusts a valid Checkout signature (does not call "fetch payment"); the webhook confirms again idempotently.
10. Existing vendors have no GST state until they set it (profile page) — until then their products cannot be ordered.

## Needs human review (money / migrations / security)
- **Migrations** (`20261021090000_payments_gateway`, `20261022090000_suborders_gst_invoices`, `20261022100000_vendor_invoice_prefix_seq`, plus run-1's `…money_integrity` / `…order_number_sequence`): rehearse on a copy of production data. The Phase 3 backfill splits legacy multi-vendor orders and can drift by a paisa against the parent total for those; it also raises an exception (instead of guessing) if any item/shipment/commission cannot be linked.
- **Existing vendors must set their GST state** (profile page or a GSTIN) before they can sell; addresses with free-text states that do not match a real state are left without a state code and must be re-entered by the customer.
- **Real Razorpay**: never exercised against Razorpay itself (tests use a fake + HMAC fixtures; the SDK payload shapes are asserted). Do a sandbox run: `payment.captured`, `payment.failed`, `refund.processed` webhooks and a refund. The refund/late-capture paths call the SDK outside DB transactions by design.
- **Money-moving code to read first:** `payments/payment.service.ts` (`applyCapture`, `RefundService`), `payments/wallet.ledger.ts`, `khata/khata.ledger.ts`, `orders/order.checkout.ts`, `orders/subOrder.service.ts` (cancel effects), `orders/return.service.ts` (resolve), `orders/invoice.service.ts` (numbering).
- **Security-relevant changes:** vendor ownership checks on order status / shipments / invoices (previously any vendor could change any order's status, add shipment events, or download any invoice); `POST /wallet/add-money` no longer credits; `/payments/verify` is bound to the caller's own payment and gateway order.
- **Breaking API changes:** `/payments/verify` body (`razorpay_*` fields); `/wallet/add-money` returns checkout details instead of crediting; `POST /orders/:id/return` removed (use `POST /sub-orders/:id/returns`); `GET /orders/:id/invoice` returns 409 when the order has several invoices; order payloads gain `subOrders` (flat `items` kept).
- Cancel/refund of a paid sub-order happens AFTER commit; if the gateway fails the cancellation stands and the response says `refund: "FAILED"` (a FAILED `refunds` row exists; an admin can retry via `POST /payments/:id/refund` with the same idempotency key).

## Not done / open risks (run 2)
- Per-vendor settlement/TDS/TCS logic is only adapted to sub-orders, not redesigned. Coupons scoped by category are still ignored. Vendor-side "partial" cancellation of individual lines is not supported (whole sub-order only). No admin UI for refunds/reconciliation (API only). `<img>`→`next/image` still pending your host decision.
- Interest cron: daily compounding with grace measured from the last real transaction (documented); back-filling of missed days is intentionally not done.
