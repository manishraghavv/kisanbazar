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
