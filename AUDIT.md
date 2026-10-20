# AUDIT.md — Multi-Vendor Agri-Commerce Platform

Audit date: 2026-10-20. Branch `main`, clean tree. **No application code was changed**; this file is the only addition.
Method: read README, Prisma schema, all route files, key services (khata, orders, payments, auth), server/index/jobs, Dockerfile, CI workflows, and the frontend page tree. Ran typecheck/build/lint/tests for both apps. Legend: **Complete** = works per code reading, **Partial** = works but missing parts or has bugs, **Stub** = placeholder logic, **Missing** = absent. "Untested" applies to all backend code (zero tests).

---

## 1. Build / lint / typecheck / test results

| Check | Result |
|---|---|
| Backend `tsc --noEmit` | Pass |
| Backend `tsc` build | Pass |
| `prisma validate` | Pass |
| Backend tests | **None exist.** `npm test` is `echo "Error: no test specified" && exit 1`, so the CI test job would fail if it ever ran |
| Backend lint | **No ESLint configured** |
| Frontend `tsc --noEmit` | Pass |
| Frontend `eslint` | 0 errors, **125 warnings** (unused vars, `<img>`, etc.) |
| Frontend `next build` | Pass |
| Frontend `vitest` | 6 files / 47 tests pass (stores only; no component, API or E2E tests; Playwright is installed but unused) |
| Migrations / seed | 4 migrations; **no seed script** (`prisma/seed` absent, no `seed` entry in prisma config); not applied against a live DB in this audit (no DB available) |

---

## 2. Critical findings (fix first)

1. **Backend CI never runs.** The workflow lives at `backend/.github/workflows/ci.yml`; GitHub only reads the repo-root `.github/workflows/`. Even if moved, its `test` job fails (no test script).
2. **Docker image cannot start the API.** `CMD ["node", "dist/server.js"]`, but `server.ts` only exports the app; the entry point is `dist/index.js`. The container would exit without listening. The production stage also runs `npx prisma generate` after `npm ci --production` (Prisma CLI is a devDependency, so it fails), and the builder uses `npm run build || npx tsc --noEmit`, which masks build failures.
3. **Payment webhook is unauthenticated.** `POST /api/payments/webhook/:gateway` has no signature verification; anyone can POST `{paymentId, status:"paid"}` and mark a payment SUCCESS and the order CONFIRMED. No idempotency, no amount check.
4. **Razorpay is a stub.** `RazorpayGateway` only `console.log`s, with no SDK or real order creation. `verifyPayment` behaviour must be treated as untrusted. PayU is validated in Joi but not implemented. The frontend has no Razorpay checkout.
5. **Insecure secret fallbacks.** JWT secrets fall back to `'access_secret'` / `'refresh_secret'` when env vars are missing, so a misconfigured production deploy would accept forgeable tokens.
6. **Rate limiter exists but is not applied anywhere.** `common/middleware/rateLimiter.ts` has no importers. Auth, OTP and login endpoints are unthrottled. CORS defaults to `*` when `CORS_ORIGIN` is unset.
7. **Khata ledger integrity (race conditions).** `KhataService.addTransaction` reads the balance, computes the new balance in JS, then writes in a batched `$transaction([...])`. Two concurrent requests both read the same balance, so a lost update corrupts `outstandingAmount` and `balanceAfter`. Same pattern in `OrderService.create` (limit check outside the transaction). Fix: `SELECT … FOR UPDATE` or atomic `increment` inside an interactive transaction. Also:
   - Ledger entries are not enforced append-only (no DB trigger/guard).
   - No reconciliation job (sum of entries vs. `outstandingAmount`).
   - `status` is forced to `ACTIVE` on any debit, overwriting `OVERDUE`.
   - The cron interest job should be checked for idempotency (it can double-charge if run twice a day).
8. **Order creation bugs** (`order.service.ts` `create`):
   - Stock decrement also decrements `reservedQty`, which is never incremented, so it can go negative.
   - Availability check and decrement are not atomic (oversell risk).
   - Coupon `usedCount` is incremented outside the order transaction (a failed order burns a use).
   - Khata credit check is outside the transaction.
   - Delivery charge is client-supplied (`deliveryCharge` in the body), so a client can set 0 or a negative value (check the Joi min).
   - GST is a flat `gstRate` per product, with **no CGST/SGST/IGST split by state**.
   - **No multi-vendor order splitting**: one `Order` holds items from many vendors; only `VendorCommission` rows are per-vendor. `PUT /orders/:id/status` is vendor-only and acts on the whole order, so one vendor can move another vendor's items.
   - Coupon discount is applied to an order but not distributed per vendor.
9. **Auth gaps.** `authenticate` only verifies the JWT, with no DB check of user status. A BLOCKED/DELETED user keeps access until the access token expires. Logout/refresh use a `Session` table (good), but access tokens can't be revoked. A dev OTP is logged via `console.log` (`auth.service.ts:177`); confirm it is gated by `NODE_ENV`. No input sanitization layer (XSS/HPP); Joi validates but `stripUnknown` isn't global.
10. **Uploads are local-disk only** (`/uploads`, multer, 5 MB, image types by mimetype only, not by magic bytes). S3 env vars exist, but there is no S3 code. Not viable on multi-instance or ephemeral containers. Any authenticated user can upload.

---

11. **Global auth leak from router order.** `order.routes.ts` calls `router.use(authenticate)` and is mounted with `app.use('/api', orderRoutes)`. Every `/api/*` request that reaches it gets 401 unless it carries a token, and the routers mounted after it in `server.ts` (payments, engagement, enterprise, admin, invoice, upload, bulk-import) are only reached by authenticated requests. Consequences: the **payment webhook can never be called by the gateway** (no bearer token), and the intended public endpoints `GET /coupons`, `GET /industries`, `GET /enterprise-tiers`, `GET /products/:id/reviews` are effectively auth-only. (Static reading, to be confirmed by a request against a running server.) Fix: scope auth per route or mount order routes at specific prefixes.

---

## 3. Backend modules and endpoints (163 route registrations)

| Module | Endpoints | Status | Notes |
|---|---|---|---|
| **auth** | register, login, logout, refresh-token, verify-otp, resend-otp, forgot/reset-password | Partial | Works end to end. SMS/email fall back to console logs without keys. No rate limit, no account lockout, no 2FA. Vendor KYC not tied to registration |
| **users** | `/me` CRUD, phone change, delete account, farmer/vendor profile, admin list/get/update/status/delete | Complete (unverified) | `GET /users` has no pagination validation (`listUsers` has no validator) |
| **addresses** | CRUD + set default | Complete | Does not store/validate state code needed for GST place-of-supply |
| **products / categories** | categories tree/CRUD, products CRUD, moderation, variants, images (URL based), attributes | Complete (unverified) | Hindi fields present. No batch/lot/expiry, no unit conversion, no fertilizer/pesticide licence or compliance fields |
| **inventory** | low-stock, logs, adjust | Partial | No batch/expiry tracking, no reservation flow (`reservedQty` unused correctly), no restock/transfer |
| **bulk-import** | CSV product import | Partial | Single route, in-memory CSV, no dry-run or error report file |
| **cart / wishlist** | cart CRUD, merge, wishlist + move to cart | Complete (unverified) | Cart does not re-price or re-validate stock until checkout |
| **orders** | create, list, get, cancel, return, status, status-history, shipments + events | Partial | See §2 item 8. Lifecycle PENDING→…→DELIVERED exists with a transition map. Return flow is request-only (no RETURNED/REFUNDED transitions, no restock, no credit note). Cancel is allowed only for the owner; vendor cancel/reject is missing |
| **invoices** | invoice PDF, invoice-data, bulk ZIP (admin) | Partial | PDFKit invoice shows HSN and flat GST. No CGST/SGST/IGST, no invoice numbering series, no credit notes, no seller GSTIN/place of supply |
| **payments** | initiate, verify, list, get, refund (admin), webhook | **Stub/Partial** | See §2 items 3–4. Refund updates DB but calls a stub gateway. No COD collection flow, no partial-refund accounting, no idempotency key on `initiate` |
| **wallet** | balance, add-money, pay, transactions | Partial | `add-money` must be confirmed to require a verified gateway payment (it credits via the payment service). Wallet math uses read-then-write in places (race) |
| **coupons** | list, get, validate, auto-apply, CRUD (admin) | Partial | Per-user usage limits and per-vendor scoping not enforced |
| **commissions / settlements** | vendor commissions, list/generate/pay settlements | Partial | Generate and mark-paid exist. No payout integration (RazorpayX), no TDS/TCS, `VendorBankAccount` unused |
| **khata** | accounts CRUD, transactions, requests (create/review), statements (list/get/generate/PDF), analytics, overdue, trends, admin overview | Partial | Core works. **Missing:** farmer repayment submission flow with vendor confirmation (only vendor/admin can record), CSV export, dispute handling, append-only enforcement, reconciliation. Credit-request approval sets limit; credit-based checkout exists but is racy |
| **engagement** | notifications, reviews (+helpful), support tickets + messages | Complete (unverified) | In-app notifications only via DB + Socket.io `notification:new` |
| **enterprise** | industries, tiers, vendor tier, audit logs, vendor/admin dashboards, reports, market intelligence, tracking, data export | Partial | Analytics are present. Audit logging is not confirmed to be written by mutating endpoints |
| **admin** | cron triggers, cron status, Bull Board | Complete | Bull Board mounted in `initBullBoard` (check it sits behind admin auth) |
| **upload** | `/upload` | Partial | See §2 item 10 |
| **health/metrics** | `/health`, `/metrics` | Partial | `/health` doesn't check DB/Redis. `/metrics` is public |
| **jobs** | cron: interest, overdue, reminders, cart cleanup, price alerts; BullMQ queues: email, sms, push, interest, statement, settlement, invoice | Partial | Workers start only if Redis reachable. No documented retry/backoff and dead-letter policy. Need to verify every queue has a consumer |
| **Socket.io** | init + `notification:new` | Partial | Used only for notifications. No order/shipment realtime events, no auth on socket handshake confirmed |

### Missing entirely (backend)
- **DELIVERY role features**: no routes at all authorise `DELIVERY` (it exists only in enums and validators). There is no assignment, no delivery-person task list, no proof of delivery, and no shipment status updates by delivery staff (shipment routes are VENDOR/ADMIN only).
- Vendor KYC (document upload and approval): `VendorDocument` model unused.
- Hindi/English **server-side** localisation for messages, notifications and invoices: partial Hindi fields on products only. `NotificationTemplate` unused.
- RBAC via `Permission` / `RolePermission` tables: unused (role checks are hardcoded, which is acceptable).
- Seed data, Postgres backups, structured logging (morgan `dev` plus `console.*`; Sentry is optional).

---

## 4. Schema review (64 enums+models; 41 models listed, 53 indexes)

- **Unused models** (zero Prisma usage in `src`): `VendorDocument`, `VendorBankAccount`, `NotificationTemplate`, `Permission`, `RolePermission`.
- **Flows without models**: product batches/expiry/lot numbers; per-vendor sub-orders (`Order` is one-per-checkout); GST breakup fields (CGST/SGST/IGST amounts on `Order`/`OrderItem`, seller/buyer GSTIN, place of supply); credit notes; invoice number sequence; khata dispute and repayment-confirmation entities; delivery-agent assignment (`Shipment` lacks an agent FK to `User`/DELIVERY) and proof-of-delivery; idempotency/webhook event log (`Payment.webhookPayload` exists, no event-id uniqueness); i18n for category/notification content beyond `nameHi`/`descriptionHi`.
- **Money**: schema uses `Decimal` (50 occurrences) and no `Float`. Good. Application code converts to `Number` in analytics (display only) and in `processRefund` (`Math.min(data.amount, Number(payment.amount))`) and `createPaymentLink(Number(order.totalAmount))`; these should stay Decimal or convert to paise via Decimal.
- **Concurrency/integrity**: no CHECK constraints (e.g., `outstandingAmount >= 0`, `stockQuantity >= 0`, `reservedQty >= 0`).
- Migrations: two `add_review_helpful_count` migrations (…172832 and …172837) look duplicated, so verify against a fresh DB (`migrate deploy` on empty DB) before relying on them.

---

## 5. Frontend pages by role (Next.js app router, 123 source files)

| Area | Pages | Status |
|---|---|---|
| Public | `/`, `/products`, `/products/[id]`, `/categories`, `/categories/[id]` | Partial (reviews component exists; no search/filter verification) |
| Auth | login, register (2-step), verify-otp, forgot/reset password | Done |
| Farmer | dashboard, cart, checkout, orders list/detail/confirmation, wishlist, addresses, wallet, payments, notifications, profile + farmer profile, support, settings, khata (farmer-dashboard, account detail, requests) | Partial: checkout has no real online-payment step (no Razorpay SDK); order tracking is basic; no returns UI confirmed; no repayment-submit UI |
| Vendor | dashboard, products list/new/edit/variants/images/attributes, inventory, orders, khata (+analytics, overdue, reports), commissions, settlements, analytics, enterprise, profile + vendor profile, bulk import modal | Partial: no batch/expiry UI, no earnings payout view beyond settlements, no KYC upload |
| Admin | overview, users, categories, industries, tiers, coupons, product moderation, settlements, khata, audit-logs, support | Partial: **no vendor KYC approval, no platform analytics beyond overview, no order/refund oversight** |
| Delivery | none | **Missing** (no pages, no navigation entries) |
| Cross-cutting | `AuthGuard` / `RoleGuard`, Zustand stores, axios client, react-query provider | Partial |

Other frontend gaps:
- **i18n**: no i18n framework (no next-intl/react-i18next); Hindi appears only as data fields (`nameHi`) and some hardcoded labels. Full Hindi/English toggle is **missing**.
- 11 `placeholder.ts` files in `components/`, `hooks/`, `styles/`, `config/` are empty scaffolds (cart, dashboard, khata, notifications, orders, payments, products, shared, support, ui, hooks, config, styles).
- Mobile-first/low-bandwidth: not audited visually; 13 committed PNG screenshots in `frontend/` root should be removed. Several uses of raw `<img>` instead of `next/image`.
- Route guards are client-side only (acceptable only if the backend enforces roles; it does for most routes).
- **Confirmed contract mismatch**: the backend serves cart/wishlist at `/api/cart`, `/api/wishlist` (`order.routes.ts` mounted at `/api`), but `cartStore` and the wishlist store call `/orders/cart…` and `/orders/wishlist…`. These calls 404, so cart and wishlist are broken end to end. Other store paths still need checking against a running API.

---

## 6. Security, validation and error handling gaps

- Rate limiting unused; `helmet()` default only; CORS `*` fallback; `morgan('dev')` in production; request-size limit 1 MB (fine).
- No input sanitization; no CSRF concern for bearer tokens, but tokens are stored client-side (check localStorage use → XSS exposure).
- Webhook signature, idempotency, replay protection: missing (see §2).
- Errors: `AppError` hierarchy + global handler are good. Inconsistent response shapes (`{success,message}` from auth middleware vs `{success,error:{code,message}}` from the global handler). Validation failures return 422 for the coupon route but must be checked elsewhere.
- Authorization: role checks present on nearly every route. Ownership checks are in services (khata `_assertAccess`, order `getById`). `PUT /orders/:id/status` and shipment routes need per-vendor item ownership checks (not seen).
- `GET /metrics` and `/api/docs` are public in production.
- `.env.example` is present; verify it matches code (it lists `OVERDUE_AUTO_SUSPEND_DAYS` while code reads `OVERDUE_SUSPEND_DAYS`; code also reads `CRON_ENABLED`, `CART_EXPIRY_DAYS`, etc. which are not documented).
- No audit of dependency vulnerabilities was run (`npm audit`); both `bull` and `bullmq` are installed (dedupe), and `@types/helmet` is obsolete.

---

## 7. Test coverage and CI status

- Backend: 0 tests, no test runner, no coverage. Frontend: 47 store unit tests only; no E2E.
- CI: root `deploy.yml` (push to main: typecheck → build → deploy to EC2) is the only active pipeline; it has no test or lint gate for the backend and runs on `push` only (no PR checks). The backend `ci.yml` is dead (wrong location).
- Deployment docs/scripts (`DEPLOYMENT.md`, `deploy.sh`, `ecosystem.config.cjs`) exist; not verified against a real host.

---

## 8. Suggested priority (input to ROADMAP.md)

1. **Stabilise**: move CI to the root with lint/typecheck/test gates, add the Vitest/Jest harness for the backend, fix the Dockerfile, add a seed script, de-duplicate migrations, remove JWT/CORS fallbacks, wire the rate limiter, remove committed PNGs, clear the 125 lint warnings.
2. **Money correctness before features**: ledger/stock/coupon atomicity (§2 items 7–8), webhook signature + idempotency, real Razorpay.
3. Then follow the 12-phase order in the task brief.
