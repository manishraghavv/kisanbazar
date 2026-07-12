# 🚜 Multi-Vendor Agri-Commerce — Frontend Development Plan

> **Backend**: Node.js + TypeScript + Express + Prisma + PostgreSQL  
> **Target**: Indian Agriculture & Rural Commerce Platform  
> **Status**: All 7 backend phases are **complete** — ~120+ API endpoints across 8 route modules, 41 database models, Redis caching, Socket.io, JWT auth, and PDF generation.

---

## 1. Project Overview

### What the Backend Does

This is a **multi-vendor e-commerce platform** built for Indian agriculture, connecting **vendors** (agri-input sellers — seeds, fertilizers, pesticides, equipment) with **farmers** (buyers). The platform's core differentiator is the **KhataBook** — a full-fledged credit/udhar (buy-now-pay-later) ledger system between vendors and farmers, very common in Indian rural commerce.

### Main Entities / Domain Model

| Domain | Key Models | Description |
|--------|-----------|-------------|
| **Users** | `User`, `Farmer`, `Vendor` | 4 roles: FARMER, VENDOR, ADMIN, DELIVERY. Farmer has land/crop profile. Vendor has business/KYC/commission info. |
| **KhataBook** ⭐ | `KhataAccount`, `KhataTransaction`, `KhataRequest`, `KhataStatement` | Credit ledger between vendor-farmer pairs. Tracks udhar (credit given), wapsi (repayment), interest, overdue. |
| **Catalog** | `Category`, `Product`, `ProductVariant`, `ProductImage`, `ProductAttribute` | Hierarchical categories, products with multi-lingual names (Hindi/English), variants (SKU/pricing/stock), GST HSN codes. |
| **Inventory** | `Inventory` | Stock change ledger — sale, restock, return, adjustment, damage. |
| **Cart & Wishlist** | `Cart`, `CartItem`, `Wishlist`, `WishlistItem` | One cart/wishlist per user. Stock validation on add. Guest cart merge on login. |
| **Orders** | `Order`, `OrderItem`, `OrderStatusHistory` | Full lifecycle: PENDING → CONFIRMED → PROCESSING → PACKED → SHIPPED → DELIVERED, plus CANCELLED/RETURNED/REFUNDED. |
| **Payments** | `Payment`, `Wallet`, `WalletTransaction`, `Coupon` | UPI, Card, Net Banking, COD, Wallet, KHATA_CREDIT. Coupons: percentage, fixed, free delivery. |
| **Logistics** | `Shipment`, `ShipmentEvent` | Multi-partner (Shiprocket/Delhivery/Self), AWB tracking, real-time events, proof of delivery photo. |
| **Finance** | `VendorSettlement`, `VendorCommission`, `VendorBankAccount` | Periodic settlements, TDS (1%), commission calculation, UTR tracking. |
| **Engagement** | `Review`, `Notification`, `NotificationTemplate` | Product reviews (1-5 stars + photos), multi-channel notifications (in-app/SMS/email/push). |
| **Support** | `SupportTicket` | Ticket categories: ORDER, PAYMENT, KHATA, PRODUCT, OTHER. SLA-based priorities. |
| **Enterprise** | `Industry`, `EnterpriseTier` | Vendor classification by industry and revenue-based tier (Micro → Enterprise). |
| **Compliance** | `AuditLog`, `Permission`, `RolePermission` | Full audit trail, RBAC, DPDP data export. |

### Key API Base Paths

- `/api/auth` — Authentication (register, login, OTP, password reset)
- `/api/users` — User profiles & admin user management
- `/api/addresses` — Address CRUD
- `/api/khata` — KhataBook credit system
- `/api/categories`, `/api/products` — Product catalog
- `/api/inventory` — Stock management
- `/api/cart`, `/api/wishlist` — Shopping cart & wishlist
- `/api/orders` — Order management
- `/api/payments`, `/api/wallet`, `/api/coupons` — Financial
- `/api/notifications` — User notifications
- `/api/reviews` — Product reviews
- `/api/support/tickets` — Support tickets
- `/api/industries`, `/api/enterprise-tiers` — Enterprise
- `/api/vendors/me` — Vendor-specific endpoints
- `/api/admin` — Admin dashboard, cron triggers
- `/api/track` — Analytics tracking
- `/api/reports` — Sales, performance, khata overdue reports
- `/api/health` — Health check

### Auth Notes

- **Primary**: Phone-based OTP authentication (India-first, `+91` numbers)
- **Fallback**: Email + password login for admin users
- **Token Strategy**: JWT access token (15 min expiry) + refresh token (7 days, stored in DB `Session` table)
- **Role Guards**: FARMER, VENDOR, ADMIN, DELIVERY — enforced on every protected endpoint
- **All API responses** follow: `{ success: boolean, data?: any, message?: string, pagination?: {...}, error?: { code, message, details } }`

---

## 2. Tech Stack Recommendation

### Recommended Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | ✅ **Next.js 16** (App Router) | Implemented. SSR/SSG for product pages, file-based routing. |
| **Language** | ✅ TypeScript (strict mode) | Implemented. |
| **Styling** | ✅ **Tailwind CSS v4** | Implemented. |
| **State / Server Data** | ✅ **TanStack Query (React Query) v5** | Installed and available. Zustand used for client state; React Query available for server data. |
| **Client State** | ✅ **Zustand v5** | Implemented with 16 stores. |
| **Forms** | ✅ **React Hook Form + @hookform/resolvers + Zod** | All installed. Used in auth pages, forms. |
| **HTTP Client** | ✅ **axios** | Implemented with JWT interceptor. |
| **Charts** | ⬜ **Recharts** or **Chart.js** | Not installed. Dashboards use static stat cards without charts. |
| **Real-time** | ⬜ Socket.io client | Not implemented. Backend has Socket.io server. |
| **PDF Viewing** | ⬜ react-pdf | Not installed. |
| **Date Handling** | 🟡 date-fns / native | Inline `formatDate` helpers used; no dedicated library. |
| **i18n** | ⬜ **next-intl** or **react-i18next** | Not implemented. All UI is English-only. |
| **Table/Data Grid** | ⬜ TanStack Table v8 | Not installed. Tables use plain HTML `<table>` elements. |

### Why This Stack?

- **India-first UX**: Phone OTP auth, Hindi language support, INR currency formatting
- **Rural-friendly**: Build with low-bandwidth considerations (caching, pagination, optimistic updates)
- **Matches backend patterns**: The backend uses Joi validation — Zod on frontend mirrors this pattern
- **Scalable**: Next.js gives you SSR for SEO on product pages, ISR for catalog updates
- **Real-time ready**: Socket.io client pairs with existing backend socket server for notifications

---

## 3. Phase-wise Development Plan

### ✅ Phase 1: Project Scaffold, Routing & Layout (Week 1) — 95% COMPLETE

**Goal**: Set up the frontend project with routing, authentication guards, and app shell layout.

#### Tasks

1. **✅ Initialize project**
   - ✅ Next.js 16 + TypeScript strict mode, path aliases (`@/` → `src/`)
   - ✅ Core dependencies: axios, zustand, tailwindcss, lucide-react, sonner
   - ✅ Additional: @tanstack/react-query, react-hook-form, @hookform/resolvers, zod
   - ✅ Set up project folder structure (see Section 5)

2. **✅ Configure API client**
   - ✅ Create axios instance with base URL from env (`NEXT_PUBLIC_API_URL`)
   - ✅ Add request interceptor to attach JWT `Authorization: Bearer <token>` header
   - ✅ Add response interceptor for 401 → refresh token flow → retry

3. **✅ Authentication state & storage**
   - ✅ Zustand store: `useAuthStore` with `{ user, accessToken, refreshToken, isAuthenticated }`
   - ✅ Persist tokens to `localStorage`
   - ✅ On app load, attempt silent refresh using stored refresh token

4. **✅ Route structure & guards**
   ```
   ✅ / → Public landing (marketing page)
   ✅ /auth/login → Login page
   ✅ /auth/register → Registration page
   ✅ /auth/verify-otp → OTP verification
   ✅ /products → Product listing
   ✅ /products/[id] → Product detail
   ✅ /categories → Category listing (with tree navigation)
   ✅ /categories/[id] → Category detail (with products, search, filters)
   ✅ /dashboard → Authenticated dashboard (role-based)
   ```
   - ✅ `AuthGuard` component — redirects to `/auth/login` if not authenticated
   - ✅ `RoleGuard` component — checks user role (FARMER, VENDOR, ADMIN) for protected routes
   - ✅ `GuestGuard` — redirects authenticated users away from login/register

5. **✅ App layout shell**
   - ✅ Responsive sidebar navigation (collapsible on mobile)
   - ✅ Top navbar with user menu, notification bell badge (useSidebarBadges.ts)
   - ✅ Role-based sidebar menu items (30+ nav items across all roles)
   - ✅ Footer with support links
   - ⬜ `MobileNav.tsx` — dedicated mobile navigation component
   - ⬜ `Breadcrumbs.tsx` — breadcrumb navigation component

#### Deliverables
- ✅ Working authentication flow (login, register, OTP verify)
- ✅ Protected routing with role-based guards
- ✅ Responsive app shell with navigation
- ✅ API client with token refresh

---

### ✅ Phase 2: Authentication & User Management (Week 2) — 95% COMPLETE

**Goal**: Complete all auth screens and user profile management.

#### Screens to Build

| Screen | Endpoint(s) | Status | Notes |
|--------|------------|--------|-------|
| **Login** | `POST /api/auth/login` | ✅ DONE | `auth/login/page.tsx` |
| **Register** | `POST /api/auth/register` | ✅ DONE | `auth/register/page.tsx` |
| **OTP Verify** | `POST /api/auth/verify-otp` | ✅ DONE | `auth/verify-otp/page.tsx` |
| **Resend OTP** | `POST /api/auth/resend-otp` | ✅ DONE | Part of OTP page |
| **Forgot Password** | `POST /api/auth/forgot-password` → `POST /api/auth/reset-password` | ✅ DONE | `auth/forgot-password` + `auth/reset-password` |
| **My Profile** | `GET /api/users/me`, `PUT /api/users/me` | ✅ DONE | `/dashboard/settings` page |
| **Farmer Profile** | `PUT /api/users/me/farmer-profile` | ✅ DONE | `/dashboard/profile/farmer` |
| **Vendor Profile** | `PUT /api/users/me/vendor-profile` | ✅ DONE | `/dashboard/profile/vendor` |
| **Change Phone** | `PUT /api/users/me/phone` | ✅ DONE | Inline in settings page with OTP verification |
| **Delete Account** | `DELETE /api/users/me` | ✅ DONE | Inline in settings page with confirmation |
| **Admin: User List** | `GET /api/users` (admin) | ✅ DONE | `/dashboard/admin/users` |
| **Admin: User Detail** | `GET /api/users/:id` (admin) | ✅ DONE | Modal within admin/users |
| **Admin: Edit User** | `PUT /api/users/:id` (admin) | ✅ DONE | Modal within admin/users |
| **Admin: Toggle Status** | `PUT /api/users/:id/status` (admin) | ✅ DONE | Modal within admin/users |

#### Key UI Components

| Component | Status | Notes |
|-----------|--------|-------|
| **PhoneInput** | 🟡 INLINE | Embedded in auth pages |
| **OTPInput** | 🟡 INLINE | 6-digit code boxes in verify-otp page |
| **RoleSelector** | 🟡 INLINE | In registration page |
| **CropsMultiSelect** | 🟡 INLINE | In farmer profile page |
| **LanguageSelector** | ⬜ PENDING | Dropdown (हिन्दी, English, etc.) |
| **UserStatusBadge** | ✅ DONE | Inline in admin users page |

#### Deliverables
- ✅ Complete auth flow (register → OTP → login → refresh → logout)
- ✅ User profile management with role-specific forms
- ✅ Admin user management dashboard
- ✅ Phone number change with re-verification
- ✅ Soft account deletion flow

---

### ✅ Phase 3: Product Catalog & Browsing (Week 3) — 90% COMPLETE

**Goal**: Build public-facing catalog pages with search, filtering, and product detail.

#### Screens to Build

| Screen | Endpoint(s) | Status | Notes |
|--------|------------|--------|-------|
| **Home / Landing** | `GET /api/products`, `GET /api/categories` | ✅ DONE | API-integrated: featured products (newest 8) + top-level category grid + static hero/features |
| **Category Tree** | `GET /api/categories/tree` | ✅ DONE | `/categories/page.tsx` — full tree with expand/collapse, Hindi names, counts |
| **Category Products** | `GET /api/categories/:id/products` | ✅ DONE | `/categories/[id]/page.tsx` — full product grid with search, filters, pagination, sort |
| **Product Listing** | `GET /api/products` | ✅ DONE | `/products` page with search, filters, crop tags, pagination, product detail drawer |
| **Product Detail** | `GET /api/products/:id` | ✅ DONE | `products/[id]/page.tsx` — full variant selector, image gallery, specs, crops |
| **Product Images** | `GET /api/products/:id/images` | ✅ DONE | Handled inline on product detail page + gallery component |
| **Product Variants** | `GET /api/products/:id/variants` | ✅ DONE | VariantSelector component with pricing/stock display |
| **Vendor Products** | `GET /api/products?vendorId=X` | ✅ DONE | `/dashboard/vendor/products` |

#### Vendor Catalog Management

| Screen | Endpoint(s) | Status | Notes |
|--------|------------|--------|-------|
| **My Products** | `GET /api/products?vendorId=me` | ✅ DONE | `/dashboard/vendor/products` |
| **Create Product** | `POST /api/products` | ✅ DONE | `/dashboard/vendor/products/new/page.tsx` |
| **Edit Product** | `PUT /api/products/:id` | ✅ DONE | `/dashboard/vendor/products/[id]/edit/page.tsx` |
| **Submit for Approval** | `POST /api/products/:id/submit` | 🟡 INLINE | May be part of product edit/detail page |
| **Manage Variants** | `POST /api/products/:id/variants` | ✅ DONE | `/dashboard/vendor/products/[id]/variants/page.tsx` |
| **Manage Images** | `POST /api/products/:id/images` | ✅ DONE | `/dashboard/vendor/products/[id]/images/page.tsx` |
| **Manage Attributes** | `POST /api/products/:id/attributes` | ✅ DONE | `/dashboard/vendor/products/[id]/attributes/page.tsx` |
| **Inventory Low Stock** | `GET /api/inventory/low-stock` | ✅ DONE | `/dashboard/vendor/inventory` |
| **Adjust Inventory** | `POST /api/inventory/adjust` | ✅ DONE | `/dashboard/vendor/inventory` |
| **Inventory Logs** | `GET /api/inventory/logs` | ✅ DONE | `/dashboard/vendor/inventory` |

#### Admin Moderation

| Screen | Endpoint(s) | Status | Notes |
|--------|------------|--------|-------|
| **Pending Products** | `GET /api/products?status=PENDING` | ✅ DONE | `/dashboard/admin/products/moderation` |
| **Moderate Product** | `PUT /api/products/:id/moderate` | ✅ DONE | Approve/reject with notes |

#### Key UI Components

| Component | Status | Notes |
|-----------|--------|-------|
| **ProductCard** | ✅ DONE | Full card with image, crop tags, price, view details button |
| **VariantSelector** | ✅ DONE | Variant pills with pricing, stock, weight, add-to-cart |
| **PriceDisplay** | ✅ DONE | ₹ formatting, MRP strikethrough, lowest/highest price |
| **StarRating** | 🟡 INLINE | Display-only star count in product cards |
| **CategoryTree** | ✅ DONE | Recursive expandable tree with icons, Hindi names, counts |
| **FilterSidebar/Panel** | ✅ DONE | Category, crop, price range filters with clear all |
| **ImageGallery** | ✅ DONE | Thumbnail navigation, primary image selection |
| **StatusStepper** | 🟡 INLINE | Inline in admin moderation |

#### Deliverables
- ✅ Public product browsing with search, filters, and pagination
- ✅ Product detail page with variant switching and image gallery
- ✅ Category tree navigation (hierarchical, expandable)
- ✅ Category products page with search/filter/sort
- ✅ Vendor product management (CRUD: create, edit, variants, images, attributes)
- ✅ Admin moderation workflow
- 🟡 Home page with featured products and category grid (marketing page exists, needs API integration)

---

### ✅ Phase 4: Cart, Wishlist & Ordering (Week 4) — 70% COMPLETE

**Goal**: Build shopping cart, wishlist, and complete order placement flow.

#### Screens to Build

| Screen | Endpoint(s) | Status | Notes |
|--------|------------|--------|-------|
| **Cart Page** | `GET /api/cart`, `PUT/DELETE /api/cart/items/:id` | ✅ DONE | `/dashboard/cart` |
| **Add to Cart** | `POST /api/cart/items` | ✅ DONE | Logic in cartStore + product detail add button |
| **Cart Merge** | `POST /api/cart/merge` | 🟡 INLINE | On login (TBD if implemented) |
| **Wishlist Page** | `GET /api/wishlist`, `DELETE /api/wishlist/items/:id` | ✅ DONE | `/dashboard/wishlist` with move-to-cart, remove, hover overlay |
| **Add to Wishlist** | `POST /api/wishlist/items` | ✅ DONE | Logic in wishlistStore + heart button on product detail |
| **Checkout Page** | Combined | ✅ DONE | `/dashboard/cart/checkout/page.tsx` |
| **Place Order** | `POST /api/orders` | ✅ DONE | Part of checkout flow via cartStore.createOrder |
| **Coupon Apply** | `POST /api/coupons/validate` | 🟡 INLINE | May be part of checkout |
| **Order Confirmation** | `GET /api/orders/:id` | ✅ DONE | `/dashboard/orders/confirmation/page.tsx` |
| **My Orders** | `GET /api/orders` | ✅ DONE | `/dashboard/orders` with status filters |
| **Order Detail** | `GET /api/orders/:id` | ✅ DONE | `/dashboard/orders/[id]/page.tsx` |
| **Cancel Order** | `POST /api/orders/:id/cancel` | ✅ DONE | orderStore has cancelOrder method; UI in order detail page |
| **Return Order** | `POST /api/orders/:id/return` | ✅ DONE | orderStore has returnOrder method; UI in order detail page |
| **Order Status History** | `GET /api/orders/:id/status-history` | 🟡 INLINE | May be in order detail page |
| **Track Shipment** | `GET /api/orders/:id/shipments` | 🟡 INLINE | May be in order detail page |
| **Order Invoice** | `GET /api/orders/:id/invoice` | 🟡 INLINE | May be in order detail page |

#### Vendor Order Management

| Screen | Endpoint(s) | Status | Notes |
|--------|------------|--------|-------|
| **Incoming Orders** | `GET /api/orders` (vendor role) | ✅ DONE | `/dashboard/vendor/orders/page.tsx` |
| **Update Order Status** | `PUT /api/orders/:id/status` | 🟡 INLINE | May be in vendor orders page |
| **Create Shipment** | `POST /api/orders/:id/shipments` | 🟡 INLINE | May be in vendor orders page |
| **Update Shipment** | `PUT /api/shipments/:id` | ⬜ PENDING | Tracking info |
| **Add Tracking Event** | `POST /api/shipments/:id/events` | ⬜ PENDING | Location/status event |

#### Key UI Components

| Component | Status | Notes |
|-----------|--------|-------|
| **CartItemRow** | 🟡 INLINE | Inline in cart page |
| **CartSummary** | 🟡 INLINE | Inline in cart/checkout page |
| **CouponInput** | 🟡 INLINE | Inline in checkout page |
| **WishlistHeart** | ✅ DONE | Heart icon in product cards + detail page with fill state |
| **AddressSelector** | 🟡 INLINE | In checkout page |
| **PaymentMethodSelector** | 🟡 INLINE | In checkout page |
| **OrderStatusTimeline** | 🟡 INLINE | In order detail page |
| **ShipmentTracker** | ⬜ PENDING | Map-style tracking |
| **OrderHistoryFilters** | 🟡 INLINE | Status filter tabs in orders page |

#### Deliverables
- ✅ Full cart management with stock validation
- ✅ Wishlist with move-to-cart, remove, hover overlay actions
- ✅ Checkout flow: address → payment method → coupon → place order
- ✅ Order management (list, detail, confirmation, cancel, return)
- ⬜ Shipment tracking with timeline
- ✅ Vendor order processing dashboard

---

### 🟡 Phase 5: KhataBook (Credit System) — ⭐ Core Feature (Week 5) — 45% COMPLETE

**Goal**: Build the KhataBook credit ledger UI — the platform's key differentiator.

#### Screens to Build

| Screen | Endpoint(s) | Status | Notes |
|--------|------------|--------|-------|
| **My Khata Accounts** | `GET /api/khata/accounts` | ✅ DONE | `/dashboard/khata` list page |
| **Khata Account Detail** | `GET /api/khata/accounts/:id` | ✅ DONE | `/dashboard/khata/[id]/page.tsx` |
| **Create Khata Account** | `POST /api/khata/accounts` | 🟡 PARTIAL | May be inline in khata page |
| **Edit Account Terms** | `PUT /api/khata/accounts/:id` | ⬜ PENDING | Update credit limit, interest, period |
| **Transaction History** | `GET /api/khata/accounts/:id/transactions` | ✅ DONE | In khata detail page via khataStore.getTransactions |
| **Record Transaction** | `POST /api/khata/accounts/:id/transactions` | ⬜ PENDING | Vendor records debit/credit |
| **Request Credit Limit** | `POST /api/khata/accounts/:id/requests` | ⬜ PENDING | Farmer requests limit increase |
| **Review Request** | `PUT /api/khata/requests/:requestId` | ⬜ PENDING | Vendor approves/rejects |
| **Khata Statements** | `GET /api/khata/accounts/:id/statements` | ⬜ PENDING | List of generated statements |
| **Download Statement PDF** | `GET /api/khata/accounts/:id/statement/pdf` | ⬜ PENDING | PDF download |
| **Farmer Khata Dashboard** | Various | ✅ DONE | `/dashboard/khata/farmer-dashboard/page.tsx` |
| **Vendor Khata Analytics** | Various | ✅ DONE | `/dashboard/vendor/khata-analytics/page.tsx` |
| **Admin Khata Overview** | `GET /api/khata/admin/overview` | ✅ DONE | `/dashboard/admin/khata/page.tsx` |
| **Overdue Accounts** | `GET /api/khata/accounts/overdue` | ⬜ PENDING | No `/dashboard/khata/overdue` |
| **Interest & Overdue Report** | `GET /api/reports/khata-overdue` | ✅ DONE | Part of `/dashboard/reports` |

#### Key UI Components

| Component | Status | Notes |
|-----------|--------|-------|
| **KhataAccountCard** | 🟡 INLINE | Inline in khata list page |
| **OutstandingGauge** | 🟡 INLINE | Credit utilization bar in khata detail |
| **LedgerTable** | 🟡 INLINE | Inline in khata detail page |
| **TransactionForm** | ⬜ PENDING | Type selector, amount, remarks, photo |
| **KhataRequestModal** | ⬜ PENDING | Limit increase request |
| **OverdueAlert** | ⬜ PENDING | Red banner |
| **PDFPreviewButton** | ⬜ PENDING | Download statement |

#### Deliverables
- ✅ KhataBook list UI with account cards
- ✅ Khata account detail with transaction history
- ✅ Farmer Khata dashboard with credit utilization, payment history, upcoming dues
- ✅ Vendor Khata analytics with overdue tracking
- ✅ Admin Khata overview with cross-vendor analytics
- ⬜ Ledger transaction recording with proof upload
- ⬜ Credit limit request & review workflow
- ⬜ PDF statement generation & download
- ⬜ Overdue dashboard with escalation alerts

---

### 🟡 Phase 6: Payments, Wallet & Financials (Week 6) — 40% COMPLETE

**Goal**: Build payment screens, wallet management, coupons, and vendor financial dashboards.

#### Screens to Build

| Screen | Endpoint(s) | Status | Notes |
|--------|------------|--------|-------|
| **Wallet Dashboard** | `GET /api/wallet` | ⬜ PENDING | No `/dashboard/wallet` |
| **Add Money** | `POST /api/wallet/add-money` | ⬜ PENDING | Payment gateway redirect |
| **Wallet Transactions** | `GET /api/wallet/transactions` | ⬜ PENDING | Credit/debit list |
| **Pay with Wallet** | `POST /api/wallet/pay` | ⬜ PENDING | At checkout |
| **Payment History** | `GET /api/payments` | ✅ DONE | `/dashboard/payments` with detail drawer |
| **Payment Detail** | `GET /api/payments/:id` | ✅ DONE | Drawer in payments page |
| **Coupon Management (Admin)** | `GET/POST/PUT/DELETE /api/coupons` | ✅ DONE | `/dashboard/admin/coupons` |
| **Coupon List (Public)** | `GET /api/coupons` | ⬜ PENDING | Active coupons for cart |
| **Vendor Commissions** | `GET /api/vendors/me/commissions` | ✅ DONE | `/dashboard/vendor/commissions` |
| **Vendor Settlements** | `GET /api/vendors/:id/settlements` | ✅ DONE | `/dashboard/vendor/settlements` |
| **Settlement Detail** | `GET /api/settlements/:id` | ⬜ PENDING | Period, sales, commission, TDS, UTR |
| **Generate Settlement (Admin)** | `POST /api/settlements/generate` | ⬜ PENDING | Placeholder page exists ("coming soon") |
| **Mark Settlement Paid (Admin)** | `POST /api/settlements/:id/pay` | ⬜ PENDING | Placeholder page exists ("coming soon") |

#### Key UI Components

| Component | Status | Notes |
|-----------|--------|-------|
| **WalletCard** | ⬜ PENDING | Balance with eye toggle, add money |
| **TransactionRow** | ⬜ PENDING | Credit/debit icon, amount, balance |
| **CouponCard** | 🟡 INLINE | Inline in admin coupons page |
| **CouponForm (Admin)** | ✅ DONE | Inline in admin coupons page |
| **CommissionSummaryCard** | ✅ DONE | Inline in vendor commissions page |
| **SettlementProgress** | 🟡 INLINE | In vendor settlements page |
| **WalletPaymentButton** | ⬜ PENDING | Wallet balance at checkout |

#### Deliverables
- 🟡 Wallet management (not started)
- ✅ Payment history with status tracking + detail drawer
- ✅ Coupon management (admin CRUD)
- ✅ Vendor commission and settlement views
- ⬜ Admin settlement processing workflow

---

### ✅ Phase 7: Engagement, Reviews & Support (Week 7) — 80% COMPLETE

**Goal**: Build notifications, product reviews, and support ticket system.

#### Screens to Build

| Screen | Endpoint(s) | Status | Notes |
|--------|------------|--------|-------|
| **Notification Bell** | `GET /api/notifications/unread-count` | ✅ DONE | Sidebar badge + tab title updater (useSidebarBadges.ts) |
| **Notification List** | `GET /api/notifications` | ✅ DONE | `/dashboard/notifications` — full list with type filters, mark read, delete |
| **Mark Read** | `PUT /api/notifications/:id/read` | ✅ DONE | Optimistic update |
| **Delete Notification** | `DELETE /api/notifications/:id` | ✅ DONE | Optimistic removal |
| **Notification Preferences** | `POST /api/notifications/preferences` | ⬜ PENDING | Settings integration |
| **Product Reviews** | `GET /api/products/:id/reviews` | 🟡 INLINE | Part of product detail page |
| **Submit Review** | `POST /api/products/:id/reviews` | 🟡 INLINE | In product detail page |
| **Edit/Delete Review** | `PUT/DELETE /api/reviews/:id` | 🟡 INLINE | In product detail page |
| **Mark Helpful** | `POST /api/reviews/:id/helpful` | ⬜ PENDING | Toggle "helpful" |
| **Support Tickets** | `GET/POST /api/support/tickets` | ✅ DONE | `/dashboard/support` — full list, create modal, detail drawer |
| **Ticket Detail** | `GET /api/support/tickets/:id` | ✅ DONE | Drawer with messages, reply, resolve/close |
| **Add Message** | `POST /api/support/tickets/:id/messages` | ✅ DONE | Reply to ticket |
| **Admin: All Tickets** | `GET /api/support/tickets/all` (admin) | 🟡 PLACEHOLDER | Navigation entry exists with "coming soon" message |
| **Admin: Update Ticket** | `PUT /api/support/tickets/:id` | 🟡 INLINE | Status/priority via support page store |

#### Key UI Components

| Component | Status | Notes |
|-----------|--------|-------|
| **NotificationItem** | ✅ DONE | Inline in notifications page with type icons, deep links |
| **NotificationBell** | ⬜ PENDING | Dropdown with recent notifications |
| **StarRatingInput** | 🟡 INLINE | Inline in product detail page |
| **ReviewCard** | 🟡 INLINE | Inline in product detail page |
| **RatingDistribution** | ⬜ PENDING | Bar chart of star distribution |
| **TicketCard** | ✅ DONE | Inline in support page |
| **TicketConversation** | ✅ DONE | Inline in support drawer |
| **PriorityBadge** | ✅ DONE | Inline in support page |
| **StatusBadge** | ✅ DONE | Inline in support page |

#### Deliverables
- ✅ Notification polling + tab title badge
- ✅ Notification list with type filters, mark read, delete, deep links
- 🟡 Product review & rating system (inline in product detail page)
- ✅ Support ticket system with conversation threads (create, reply, resolve, close)
- 🟡 Admin support dashboard (placeholder page exists)

---

### ✅ Phase 8: Enterprise & Analytics Dashboards (Week 8) — 75% COMPLETE

**Goal**: Build analytics dashboards for vendors and admins, plus enterprise features.

#### Screens to Build

| Screen | Endpoint(s) | Status | Notes |
|--------|------------|--------|-------|
| **Vendor Dashboard** | `GET /api/vendors/me/dashboard` | ✅ DONE | Inline on `/dashboard` |
| **Admin Dashboard** | `GET /api/admin/dashboard` | ✅ DONE | Inline on `/dashboard` |
| **Sales Report** | `GET /api/reports/sales` | ✅ DONE | Tab in `/dashboard/reports` |
| **Product Performance** | `GET /api/reports/product-performance` | ✅ DONE | Tab in `/dashboard/reports` |
| **Khata Overdue Report** | `GET /api/reports/khata-overdue` | ✅ DONE | Tab in `/dashboard/reports` |
| **Audit Logs (Admin)** | `GET /api/audit-logs` | ✅ DONE | `/dashboard/admin/audit-logs` |
| **Enterprise Classification** | `GET /api/vendors/me/enterprise` | 🟡 PLACEHOLDER | "Coming soon" page exists |
| **Assign Enterprise** | `PUT /api/vendors/me/enterprise` | 🟡 PLACEHOLDER | "Coming soon" page exists |
| **Industry Management (Admin)** | `CRUD /api/industries` | 🟡 PLACEHOLDER | "Coming soon" page exists |
| **Tier Management (Admin)** | `CRUD /api/enterprise-tiers` | 🟡 PLACEHOLDER | "Coming soon" page exists |
| **Admin Settlement Processing** | `POST /api/settlements/generate`, `POST /api/settlements/:id/pay` | 🟡 PLACEHOLDER | "Coming soon" page exists |
| **Admin Support Tickets** | `GET /api/support/tickets/all` (admin) | 🟡 PLACEHOLDER | "Coming soon" page exists |
| **Data Export** | `POST /api/users/me/export` | ✅ DONE | Button in settings page |

#### Key UI Components

| Component | Status | Notes |
|-----------|--------|-------|
| **DashboardKPICard** | ✅ DONE | Inline in dashboard page |
| **RevenueChart** | ⬜ PENDING | Line/bar chart with date range |
| **PieChart** | ⬜ PENDING | Order status, payment method breakdown |
| **DataTable** | 🟡 INLINE | Basic inline tables |
| **DateRangePicker** | 🟡 INLINE | Inline in reports page |
| **TierBadge** | ⬜ PENDING | MICRO, SMALL, MEDIUM, LARGE, ENTERPRISE |
| **ExportButton** | ✅ DONE | Inline in settings page |

#### Deliverables
- ✅ Vendor analytics dashboard with KPIs
- ✅ Admin platform dashboard with system-wide metrics
- ✅ Sales, product performance, and khata overdue reports
- ✅ Khata analytics dashboard (vendor-specific)
- ✅ Admin Khata overview (cross-vendor analytics)
- 🟡 Enterprise tier assignment UI (placeholder page)
- ✅ Audit log viewer (admin)
- ✅ Data export for DPDP compliance
- 🟡 Admin settlement processing UI (placeholder page)
- 🟡 Admin support ticket UI (placeholder page)
- 🟡 Industry management UI (placeholder page)
- 🟡 Tier management UI (placeholder page)

---

### ⬜ Phase 9: Real-time Features, Polish & Testing (Week 9-10) — 15% COMPLETE

**Goal**: Add real-time WebSocket features, UI polish, i18n, responsive design, and testing.

#### Tasks

1. **⬜ Real-time WebSocket Integration**
   - Connect to Socket.io server on app mount
   - Authenticate via token from handshake
   - Join user room on connection
   - Listen for events: `notification:new`, `order:status`, `khata:transaction`, `ticket:update`
   - Show toast notifications for real-time events
   - Update badges and lists optimistically
   - **Package**: `socket.io-client` — not installed yet

2. **⬜ Multi-language Support (i18n)**
   - Setup next-intl or react-i18next
   - Languages: हिन्दी (hi), English (en), मराठी (mr), ਪੰਜਾਬੀ (pa), தமிழ் (ta)
   - Use backend's `nameHi`, `descriptionHi` for product names in Hindi
   - Locale-aware number formatting (₹ 1,23,456 for Hindi)
   - RTL support not needed (all languages are LTR)

3. **🟡 UI Polish & Responsive Design**
   - ✅ Mobile-first responsive layout (basic)
   - ⬜ Offline/fast network awareness
   - ✅ Loading skeletons for list views (spinners exist across all pages)
   - ✅ Empty states with illustrations and CTAs (exist across all pages)
   - 🟡 Error states with retry buttons (exist in most pages)
   - ✅ Toast/snackbar notification system (sonner)
   - ⬜ Keyboard accessibility (tab navigation, aria labels)
   - ⬜ Focus management for modals/dialogs

4. **🟡 Testing**
   - ✅ Unit tests: Vitest for stores — **47 tests across 6 files** (adminStore, couponStore, dashboardStore, notificationStore, ticketStore, vendorStore)
   - ⬜ Integration tests: MSW (Mock Service Worker) not set up
   - ⬜ E2E tests: Playwright not set up
   - ⬜ Accessibility tests: axe-core not set up

5. **⬜ Performance Optimization**
   - Next.js Image component for product images
   - Route-level code splitting
   - TanStack Query stale-while-revalidate caching
   - Infinite scroll / pagination for large lists
   - Bundle analysis and optimization

#### Deliverables
- ⬜ Real-time notification toasts via WebSocket
- ⬜ Multi-language support (Hindi + English + regional)
- 🟡 Polished, responsive UI with loading/empty/error states (partially done)
- 🟡 Unit test suite (47 store tests — 80%+ coverage target not yet met)
- ⬜ E2E test suite for critical flows

---

### ⬜ Phase 10: Deployment & DevOps (Week 11) — 0% COMPLETE

**Goal**: Deploy the frontend to production with CI/CD, monitoring, and security hardening.

#### Tasks

1. **⬜ Build Configuration**
   - Environment variables: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_GA_ID`
   - Production build optimization: tree-shaking, minification, compression
   - Static export vs SSR/ISR decision based on hosting

2. **⬜ Hosting Options**
   - **Vercel** (recommended for Next.js): Automatic SSR/ISR, edge functions, analytics
   - **Netlify**: Good for static export + serverless functions
   - **Docker + VPS**: Multi-stage Dockerfile, Nginx reverse proxy

3. **⬜ CI/CD Pipeline**
   - GitHub Actions workflow:
     - Lint → TypeCheck → Test → Build → Deploy
     - Preview deployments on PR (Vercel/Netlify)
     - Production deployment on main branch merge

4. **⬜ Monitoring & Analytics**
   - Vercel Analytics or Google Analytics 4
   - Error tracking: Sentry (frontend SDK)
   - Performance monitoring: Lighthouse CI, Web Vitals

5. **⬜ Security**
   - CSP headers via Next.js config
   - Environment variable management (no secrets in client bundle)
   - API call rate limit awareness (429 handling)
   - XSS prevention (React's built-in escaping + CSP)

#### Deliverables
- ⬜ Production deployment on Vercel/Netlify
- ⬜ CI/CD pipeline with preview deployments
- ⬜ Error tracking with Sentry
- ⬜ Performance monitoring setup

---

## 4. API Integration Map

### Auth Module → Screens

| Backend Endpoint | Frontend Screen / Feature | Auth Required | Status |
|-----------------|--------------------------|---------------|--------|
| `POST /api/auth/register` | Register page | No | ✅ DONE |
| `POST /api/auth/login` | Login page | No | ✅ DONE |
| `POST /api/auth/logout` | Navbar user menu, session expiry handling | Yes | ✅ DONE |
| `POST /api/auth/refresh-token` | Axios interceptor (silent refresh) | Yes (refresh token) | ✅ DONE |
| `POST /api/auth/verify-otp` | OTP Verification page | No | ✅ DONE |
| `POST /api/auth/resend-otp` | OTP page (Resend button with cooldown) | No | ✅ DONE |
| `POST /api/auth/forgot-password` | Forgot Password page (step 1) | No | ✅ DONE |
| `POST /api/auth/reset-password` | Forgot Password page (step 2) | No | ✅ DONE |

### Users Module → Screens

| Endpoint | Screen | Auth | Status |
|----------|--------|------|--------|
| `GET /api/users/me` | My Profile page, auth store initialization | Yes | ✅ DONE |
| `PUT /api/users/me` | Profile Edit page | Yes | ✅ DONE |
| `PUT /api/users/me/farmer-profile` | Farmer Profile page | Yes (FARMER) | ✅ DONE |
| `PUT /api/users/me/vendor-profile` | Vendor Profile page | Yes (VENDOR) | ✅ DONE |
| `PUT /api/users/me/phone` | Change Phone Number page | Yes | ✅ DONE | Inline in settings with OTP flow |
| `DELETE /api/users/me` | Account Deletion page | Yes | ✅ DONE | Inline in settings with confirmation |
| `GET /api/users` | Admin User List page | Yes (ADMIN) | ✅ DONE |
| `GET /api/users/:id` | Admin User Detail page | Yes (ADMIN) | ✅ DONE |
| `PUT /api/users/:id` | Admin User Edit page | Yes (ADMIN) | ✅ DONE |
| `PUT /api/users/:id/status` | Admin User Block/Activate action | Yes (ADMIN) | ✅ DONE |
| `DELETE /api/users/:id` | Admin User Delete action | Yes (ADMIN) | ✅ DONE |

### Addresses Module → Screens

| Endpoint | Screen | Auth | Status |
|----------|--------|------|--------|
| `POST /api/addresses` | Checkout (Add New Address modal), Profile (Addresses tab) | Yes | ✅ DONE |
| `GET /api/addresses` | Checkout (Address selector), Profile (Address list) | Yes | ✅ DONE |
| `GET /api/addresses/:id` | Address detail view | Yes | ✅ DONE |
| `PUT /api/addresses/:id` | Address edit form | Yes | ✅ DONE |
| `DELETE /api/addresses/:id` | Address delete action | Yes | ✅ DONE |
| `PUT /api/addresses/:id/default` | Set default address | Yes | ✅ DONE |

### Products & Categories Module → Screens

| Endpoint | Screen | Auth | Status |
|----------|--------|------|--------|
| `GET /api/categories/tree` | Home page (category tree), Categories page | No | ✅ DONE | `/categories/page.tsx` |
| `GET /api/categories` | Category Listing page | No | ✅ DONE | `/categories/page.tsx` |
| `GET /api/categories/:id` | Category Detail page | No | ✅ DONE | `/categories/[id]/page.tsx` |
| `GET /api/categories/:id/products` | Category Products page | No | ✅ DONE | Uses `/products` with `categoryId` param |
| `POST /api/categories` | Admin Category Management page | Yes (ADMIN) | ✅ DONE |
| `PUT /api/categories/:id` | Admin Category Edit page | Yes (ADMIN) | ✅ DONE |
| `DELETE /api/categories/:id` | Admin Category Delete action | Yes (ADMIN) | ✅ DONE |
| `GET /api/products` | Home (featured), Product Listing, Search Results | No | ✅ DONE |
| `GET /api/products/:id` | Product Detail page | No | ✅ DONE | `/products/[id]/page.tsx` |
| `POST /api/products` | Vendor Create Product page | Yes (VENDOR) | ✅ DONE | `/dashboard/vendor/products/new` |
| `PUT /api/products/:id` | Vendor Edit Product page | Yes (VENDOR) | ✅ DONE | `/dashboard/vendor/products/[id]/edit` |
| `DELETE /api/products/:id` | Vendor Delete Product action | Yes (VENDOR) | 🟡 INLINE | May be in edit page |
| `POST /api/products/:id/submit` | Vendor Submit for Moderation action | Yes (VENDOR) | 🟡 INLINE | May be in product edit page |
| `PUT /api/products/:id/moderate` | Admin Moderation page | Yes (ADMIN) | ✅ DONE |
| `GET /api/products/:id/variants` | Product Detail (variant selector) | No | ✅ DONE | In product detail page |
| `POST /api/products/:id/variants` | Vendor Variant Management page | Yes (VENDOR) | ✅ DONE | `/dashboard/vendor/products/[id]/variants` |
| `PUT /api/variants/:variantId` | Vendor Variant Edit page | Yes (VENDOR) | 🟡 INLINE | In variants management page |
| `DELETE /api/variants/:variantId` | Vendor Delete Variant action | Yes (VENDOR) | 🟡 INLINE | In variants management page |
| `GET /api/products/:id/images` | Product Detail (image gallery) | No | ✅ DONE | In product detail page |
| `POST /api/products/:id/images` | Vendor Image Upload form | Yes (VENDOR) | ✅ DONE | `/dashboard/vendor/products/[id]/images` |
| `PUT /api/products/:id/images/:id/primary` | Vendor Set Primary Image action | Yes (VENDOR) | 🟡 INLINE | In images management page |
| `DELETE /api/products/:id/images/:id` | Vendor Delete Image action | Yes (VENDOR) | 🟡 INLINE | In images management page |
| `POST /api/products/:id/attributes` | Vendor Attribute Management | Yes (VENDOR) | ✅ DONE | `/dashboard/vendor/products/[id]/attributes` |
| `DELETE /api/products/:id/attributes/:id` | Vendor Delete Attribute action | Yes (VENDOR) | 🟡 INLINE | In attributes management page |

### Inventory Module → Screens

| Endpoint | Screen | Auth | Status |
|----------|--------|------|--------|
| `GET /api/inventory/low-stock` | Vendor Inventory Dashboard | Yes (VENDOR) | ✅ DONE |
| `GET /api/inventory/logs` | Vendor Inventory Logs page | Yes (VENDOR) | ✅ DONE |
| `POST /api/inventory/adjust` | Vendor Stock Adjustment form (modal) | Yes (VENDOR) | ✅ DONE |

### Cart & Wishlist → Screens

| Endpoint | Screen | Auth | Status |
|----------|--------|------|--------|
| `GET /api/cart` | Cart page | Yes | ✅ DONE |
| `POST /api/cart/items` | Product Detail (Add to Cart button) | Yes | ✅ DONE |
| `PUT /api/cart/items/:id` | Cart page (quantity update) | Yes | ✅ DONE |
| `DELETE /api/cart/items/:id` | Cart page (remove item) | Yes | ✅ DONE |
| `DELETE /api/cart` | Cart page (clear all) | Yes | ✅ DONE |
| `POST /api/cart/merge` | On login (merge guest cart) | Yes | 🟡 PARTIAL |
| `GET /api/wishlist` | Wishlist page | Yes | ✅ DONE |
| `POST /api/wishlist/items` | Product Card/Detail (heart icon) | Yes | ✅ DONE |
| `DELETE /api/wishlist/items/:id` | Wishlist page (remove item) | Yes | ✅ DONE |
| `POST /api/wishlist/items/:id/move` | Wishlist page (Move to Cart button) | Yes | ✅ DONE |

### Orders Module → Screens

| Endpoint | Screen | Auth | Status |
|----------|--------|------|--------|
| `POST /api/orders` | Checkout (Place Order button) | Yes | ✅ DONE | `/dashboard/cart/checkout` |
| `GET /api/orders` | My Orders page, Vendor Orders page | Yes | ✅ DONE | `/dashboard/orders`, `/dashboard/vendor/orders` |
| `GET /api/orders/:id` | Order Detail page | Yes | ✅ DONE | `/dashboard/orders/[id]` |
| `POST /api/orders/:id/cancel` | Order Detail (Cancel button) | Yes | ✅ DONE | In order detail page via orderStore |
| `POST /api/orders/:id/return` | Order Detail (Return button + form) | Yes | ✅ DONE | In order detail page via orderStore |
| `GET /api/orders/:id/status-history` | Order Detail (Status Timeline) | Yes | 🟡 INLINE | In order detail page |
| `PUT /api/orders/:id/status` | Vendor Update Order Status actions | Yes (VENDOR) | 🟡 INLINE | In vendor orders page |
| `POST /api/orders/:id/payments` | Order Detail (Record Payment) | Yes | 🟡 INLINE | May be in order detail page |
| `GET /api/orders/:id/payments` | Order Detail (Payment Info) | Yes | 🟡 INLINE | May be in order detail page |
| `GET /api/orders/:id/shipments` | Order Detail (Shipment Tracking) | Yes | 🟡 INLINE | May be in order detail page |
| `POST /api/orders/:id/shipments` | Vendor Create Shipment form | Yes (VENDOR) | 🟡 INLINE | In vendor orders page |
| `PUT /api/shipments/:id` | Vendor Update Shipment form | Yes (VENDOR) | ⬜ PENDING |
| `POST /api/shipments/:id/events` | Vendor Add Tracking Event form | Yes (VENDOR) | ⬜ PENDING |
| `GET /api/shipments/:id/events` | Order Detail (Tracking Timeline) | Yes | ⬜ PENDING |
| `GET /api/orders/:id/invoice` | Order Detail (Download Invoice button) | Yes | 🟡 INLINE | May be in order detail page |

### Payments, Wallet & Coupons → Screens

| Endpoint | Screen | Auth | Status |
|----------|--------|------|--------|
| `POST /api/payments/initiate` | Checkout (Payment initiation) | Yes | 🟡 INLINE | In checkout page |
| `POST /api/payments/verify` | Payment callback page | Yes | ⬜ PENDING |
| `GET /api/payments` | Payment History page | Yes | ✅ DONE | `/dashboard/payments` |
| `GET /api/payments/:id` | Payment Detail page | Yes | ✅ DONE | Drawer in payments page |
| `POST /api/payments/:id/refund` | Admin Refund action | Yes (ADMIN) | ⬜ PENDING |
| `GET /api/wallet` | Wallet page | Yes | ⬜ PENDING | No `/dashboard/wallet` |
| `POST /api/wallet/add-money` | Wallet (Add Money modal) | Yes | ⬜ PENDING |
| `POST /api/wallet/pay` | Checkout (Wallet payment method) | Yes | 🟡 INLINE | In checkout page |
| `GET /api/wallet/transactions` | Wallet (Transaction History) | Yes | ⬜ PENDING |
| `GET /api/coupons` | Coupon list page, Cart (available coupons) | No | ⬜ PENDING |
| `GET /api/coupons/:id` | Coupon detail | No | ⬜ PENDING |
| `POST /api/coupons/validate` | Cart (Apply Coupon input) | No | 🟡 INLINE | In checkout page |
| `POST /api/coupons/auto-apply` | Cart (Auto-apply best coupon button) | Yes | ⬜ PENDING |
| `POST /api/coupons` | Admin Coupon Create page | Yes (ADMIN) | ✅ DONE | `/dashboard/admin/coupons` |
| `PUT /api/coupons/:id` | Admin Coupon Edit page | Yes (ADMIN) | ✅ DONE | `/dashboard/admin/coupons` |
| `DELETE /api/coupons/:id` | Admin Coupon Delete action | Yes (ADMIN) | ✅ DONE | `/dashboard/admin/coupons` |
| `GET /api/vendors/me/commissions` | Vendor Commissions page | Yes (VENDOR) | ✅ DONE | `/dashboard/vendor/commissions` |
| `GET /api/vendors/:id/settlements` | Vendor Settlements page | Yes (VENDOR/ADMIN) | ✅ DONE | `/dashboard/vendor/settlements` |
| `GET /api/settlements/:id` | Settlement Detail page | Yes | ⬜ PENDING |
| `POST /api/settlements/generate` | Admin Generate Settlement action | Yes (ADMIN) | ⬜ PENDING | Placeholder page exists |
| `POST /api/settlements/:id/pay` | Admin Mark Paid action (UTR entry) | Yes (ADMIN) | ⬜ PENDING | Placeholder page exists |

### Khata Module → Screens

| Endpoint | Screen | Auth | Status |
|----------|--------|------|--------|
| `POST /api/khata/accounts` | Vendor Create Khata Account page | Yes (VENDOR) | ✅ DONE | Inline drawer in khata list page |
| `GET /api/khata/accounts` | Khata Accounts List page (vendor/farmer) | Yes | ✅ DONE | `/dashboard/khata` |
| `GET /api/khata/accounts/:id` | Khata Account Detail page | Yes | ✅ DONE | `/dashboard/khata/[id]` |
| `PUT /api/khata/accounts/:id` | Khata Account Edit Terms page | Yes (VENDOR) | ⬜ PENDING |
| `POST /api/khata/accounts/:id/transactions` | Record Transaction modal | Yes (VENDOR) | ⬜ PENDING |
| `GET /api/khata/accounts/:id/transactions` | Transaction History page | Yes | ✅ DONE | In khata detail page |
| `POST /api/khata/accounts/:id/requests` | Farmer Request Limit Increase page | Yes (FARMER) | ⬜ PENDING |
| `PUT /api/khata/requests/:id` | Vendor Review Request modal | Yes (VENDOR) | ⬜ PENDING |
| `GET /api/khata/accounts/:id/statements` | Khata Statements list | Yes | ⬜ PENDING |
| `GET /api/khata/accounts/:id/statement/pdf` | Download Statement PDF button | Yes | ⬜ PENDING |
| `POST /api/khata/accounts/:id/statements/generate` | Generate Statement action | Yes | ⬜ PENDING |
| `GET /api/khata/accounts/overdue` | Overdue Accounts dashboard | Yes (VENDOR/ADMIN) | ⬜ PENDING |

### Engagement Module → Screens

| Endpoint | Screen | Auth | Status |
|----------|--------|------|--------|
| `GET /api/notifications` | Notification List page, Notification dropdown | Yes | ✅ DONE |
| `GET /api/notifications/unread-count` | Navbar badge (polling interval) | Yes | ✅ DONE |
| `PUT /api/notifications/:id/read` | Notification list (mark single) | Yes | ✅ DONE |
| `PUT /api/notifications/read-all` | Notification list ("Mark All Read" button) | Yes | ✅ DONE |
| `DELETE /api/notifications/:id` | Notification list (dismiss) | Yes | ✅ DONE |
| `POST /api/notifications/preferences` | Settings page (notification prefs) | Yes | ⬜ PENDING |
| `GET /api/products/:id/reviews` | Product Detail (Reviews tab) | No | 🟡 INLINE | In product detail page |
| `POST /api/products/:id/reviews` | Product Detail (Write Review modal) | Yes | 🟡 INLINE | In product detail page |
| `PUT /api/reviews/:id` | Product Detail (Edit Review) | Yes | 🟡 INLINE | In product detail page |
| `DELETE /api/reviews/:id` | Product Detail (Delete Review) | Yes | 🟡 INLINE | In product detail page |
| `POST /api/reviews/:id/helpful` | Product Detail (Helpful button) | Yes | ⬜ PENDING |
| `POST /api/support/tickets` | Support: Create Ticket page | Yes | ✅ DONE |
| `GET /api/support/tickets` | Support: My Tickets page | Yes | ✅ DONE |
| `GET /api/support/tickets/all` | Admin: All Tickets page | Yes (ADMIN/VENDOR) | 🟡 PLACEHOLDER | "Coming soon" page |
| `GET /api/support/tickets/:id` | Support: Ticket Detail page | Yes | ✅ DONE | Drawer with messages |
| `PUT /api/support/tickets/:id` | Support: Update Ticket (staff) | Yes | ✅ DONE | In ticket detail in support page |
| `POST /api/support/tickets/:id/messages` | Ticket conversation (reply) | Yes | ✅ DONE |
| `GET /api/support/tickets/:id/messages` | Ticket conversation view | Yes | ✅ DONE | In ticket detail drawer |

### Enterprise Module → Screens

| Endpoint | Screen | Auth | Status |
|----------|--------|------|--------|
| `GET /api/industries` | Register/Profile (industry selector) | No | ⬜ PENDING |
| `POST /api/industries` | Admin Industry Management | Yes (ADMIN) | 🟡 PLACEHOLDER | "Coming soon" page |
| `PUT /api/industries/:id` | Admin Industry Edit | Yes (ADMIN) | 🟡 PLACEHOLDER | "Coming soon" page |
| `GET /api/enterprise-tiers` | Register/Profile (tier display) | No | ⬜ PENDING |
| `POST /api/enterprise-tiers` | Admin Tier Management | Yes (ADMIN) | 🟡 PLACEHOLDER | "Coming soon" page |
| `PUT /api/enterprise-tiers/:id` | Admin Tier Edit | Yes (ADMIN) | 🟡 PLACEHOLDER | "Coming soon" page |
| `GET /api/vendors/me/enterprise` | Vendor Enterprise Classification page | Yes (VENDOR) | 🟡 PLACEHOLDER | "Coming soon" page |
| `PUT /api/vendors/me/enterprise` | Vendor Assign Industry/Tier page | Yes (VENDOR) | 🟡 PLACEHOLDER | "Coming soon" page |
| `GET /api/audit-logs` | Admin Audit Log page | Yes (ADMIN) | ✅ DONE |
| `POST /api/track/product-view/:productId` | Product Detail (on mount + analytics) | Yes | ⬜ PENDING |
| `POST /api/track/search` | Search page (on search submit) | Yes | ⬜ PENDING |
| `GET /api/vendors/me/dashboard` | Vendor Dashboard page | Yes (VENDOR) | ✅ DONE |
| `GET /api/admin/dashboard` | Admin Dashboard page | Yes (ADMIN) | ✅ DONE |
| `GET /api/reports/sales` | Sales Report page | Yes | ✅ DONE |
| `GET /api/reports/product-performance` | Admin Product Performance report | Yes (ADMIN) | ✅ DONE |
| `GET /api/reports/khata-overdue` | Khata Overdue Report page | Yes | ✅ DONE |
| `POST /api/users/me/export` | Settings page (Export My Data button) | Yes | ✅ DONE |

---

## 5. Actual Frontend Folder Structure

```
src/
├── app/                          # Next.js App Router pages (53 page.tsx files total)
│   ├── page.tsx                   # 🟡 Home / Landing page (static marketing page, needs API integration)
│   ├── products/
│   │   ├── page.tsx               # ✅ Product listing with drawer detail, full filter system
│   │   └── [id]/page.tsx          # ✅ Product detail with variants, gallery, specs, crops
│   ├── categories/
│   │   ├── page.tsx               # ✅ Category tree with expand/collapse, Hindi names, counts
│   │   └── [id]/page.tsx          # ✅ Category detail + products with search/filter/sort
│   │
│   ├── auth/                      # ✅ Auth pages (guest only)
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── verify-otp/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   │
│   └── dashboard/                 # Authenticated layout
│       ├── layout.tsx              # Sidebar + navbar layout
│       ├── page.tsx                # Role-based dashboard KPIs
│       │
│       ├── profile/
│       │   ├── page.tsx            # ✅ My profile
│       │   ├── farmer/page.tsx     # ✅ Farmer profile
│       │   └── vendor/page.tsx     # ✅ Vendor profile
│       ├── addresses/page.tsx      # ✅ Address book
│       ├── cart/
│       │   ├── page.tsx            # ✅ Shopping cart
│       │   └── checkout/page.tsx   # ✅ Checkout flow
│       ├── wishlist/page.tsx       # ✅ Wishlist with move-to-cart
│       ├── orders/
│       │   ├── page.tsx            # ✅ My orders list
│       │   ├── [id]/page.tsx       # ✅ Order detail with cancel/return
│       │   └── confirmation/page.tsx # ✅ Order confirmation
│       ├── payments/page.tsx       # ✅ Payment history with detail drawer
│       ├── ⬜ wallet/              # ⬜ Wallet (missing - no directory)
│       ├── khata/
│       │   ├── page.tsx            # ✅ Khata accounts list
│       │   ├── [id]/page.tsx       # ✅ Khata account detail
│       │   ├── farmer-dashboard/page.tsx # ✅ Farmer Khata dashboard
│       │   └── ⬜ overdue/         # ⬜ Overdue accounts
│       ├── support/page.tsx        # ✅ Support tickets (full CRUD)
│       ├── notifications/page.tsx  # ✅ Notifications (full CRUD + filters)
│       ├── reports/page.tsx        # ✅ Reports dashboard
│       ├── settings/page.tsx       # ✅ Settings with data export
│       │
│       ├── vendor/                 # Vendor-only pages
│       │   ├── page.tsx            # ✅ Vendor dashboard
│       │   ├── products/
│       │   │   ├── page.tsx        # ✅ My products
│       │   │   ├── new/page.tsx    # ✅ Create product
│       │   │   └── [id]/
│       │   │       ├── edit/page.tsx      # ✅ Edit product
│       │   │       ├── variants/page.tsx  # ✅ Manage variants
│       │   │       ├── images/page.tsx    # ✅ Manage images
│       │   │       └── attributes/page.tsx # ✅ Manage attributes
│       │   ├── inventory/page.tsx   # ✅ Inventory management
│       │   ├── orders/page.tsx      # ✅ Incoming orders
│       │   ├── commissions/page.tsx # ✅ Commission breakdown
│       │   ├── settlements/page.tsx # ✅ Settlement history
│       │   ├── khata-analytics/page.tsx # ✅ Khata analytics
│       │   └── enterprise/page.tsx  # 🟡 PLACEHOLDER ("coming soon")
│       │
│       └── admin/                  # Admin-only pages
│           ├── page.tsx            # ✅ Admin dashboard
│           ├── users/page.tsx       # ✅ User management
│           ├── categories/page.tsx  # ✅ Category management
│           ├── products/moderation/page.tsx # ✅ Product moderation
│           ├── coupons/page.tsx     # ✅ Coupon management
│           ├── audit-logs/page.tsx  # ✅ Audit log viewer
│           ├── khata/page.tsx       # ✅ Admin Khata overview
│           ├── settlements/page.tsx # 🟡 PLACEHOLDER ("coming soon")
│           ├── industries/page.tsx  # 🟡 PLACEHOLDER ("coming soon")
│           ├── tiers/page.tsx       # 🟡 PLACEHOLDER ("coming soon")
│           └── support/page.tsx     # 🟡 PLACEHOLDER ("coming soon")
```

**Key**: 53 page.tsx files total across the app. 6 placeholder pages showing "coming soon".

## 6. Dependencies / Setup Checklist

### Environment Variables

```env
# .env.local (frontend)

# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000/api

# Socket.io server URL (for real-time notifications)
NEXT_PUBLIC_SOCKET_URL=http://localhost:8000

# App URL (for callback/redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Feature flags
NEXT_PUBLIC_ENABLE_SOCKET=true
NEXT_PUBLIC_ENABLE_I18N=true

# Analytics (optional)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# Sentry DSN (optional)
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# Default language
NEXT_PUBLIC_DEFAULT_LANG=hi
```

### CORS Configuration (Backend)

The backend must allow the frontend origin. In `backend/src/server.ts`:

```typescript
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
  : '*';
app.use(cors({ origin: corsOrigins }));
```

Set `CORS_ORIGIN=http://localhost:5173,http://localhost:3000` in backend `.env`.

### Package Dependencies (Actual)

```json
{
  "dependencies": {
    "next": "^16.2.9", // ✅ installed
    "react": "^19.2.4", // ✅ installed
    "react-dom": "^19.2.4", // ✅ installed
    "axios": "^1.18.0", // ✅ installed
    "@tanstack/react-query": "^5.101.0", // ✅ installed
    "zustand": "^5.0.14", // ✅ installed
    "react-hook-form": "^7.80.0", // ✅ installed
    "@hookform/resolvers": "^5.4.0", // ✅ installed
    "zod": "^4.4.3", // ✅ installed
    "socket.io-client": "⬜ NOT INSTALLED",
    "date-fns": "⬜ NOT INSTALLED",
    "recharts": "⬜ NOT INSTALLED (charts use inline HTML)",
    "sonner": "^2.0.7", // ✅ installed
    "lucide-react": "^1.21.0", // ✅ installed
    "clsx": "^2.1.1", // ✅ installed
    "tailwind-merge": "^3.6.0" // ✅ installed
  },
  "devDependencies": {
    "typescript": "^5", // ✅ installed
    "@types/node": "^20", // ✅ installed
    "@types/react": "^19", // ✅ installed
    "@types/react-dom": "^19", // ✅ installed
    "tailwindcss": "^4", // ✅ installed
    "postcss": "^8.4.0", // ✅ installed (via @tailwindcss/postcss)
    "@tailwindcss/postcss": "^4", // ✅ installed
    "eslint": "^9", // ✅ installed
    "eslint-config-next": "^16.2.9", // ✅ installed
    "prettier": "⬜ NOT INSTALLED",
    "vitest": "^4.1.9", // ✅ installed
    "@testing-library/react": "^16.3.2", // ✅ installed
    "@testing-library/jest-dom": "^6.9.1", // ✅ installed
    "jsdom": "^29.1.1", // ✅ installed
    "@playwright/test": "⬜ NOT INSTALLED"
  }
}
```

### API Client Configuration

```typescript
// lib/api-client.ts
import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach JWT
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401, refresh token
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshed = await useAuthStore.getState().refreshAccessToken();
      if (refreshed) {
        // Retry original request with new token
        const token = useAuthStore.getState().accessToken;
        error.config.headers.Authorization = `Bearer ${token}`;
        return apiClient(error.config);
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

### API Response Type Definitions

```typescript
// types/api.ts

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
```

### Key Considerations

1. **JWT Token Security**: Store tokens in `localStorage` — implemented in authStore
2. **Rate Limiting**: Backend has 3 tiers. Handle 429 responses gracefully
3. **Offline Support**: Consider React Query's `networkMode`
4. **Pagination**: Backend uses offset-based pagination — implemented in all data stores
5. **Date/Time**: All timestamps UTC. Display in IST with locale formatting
6. **Currency**: All amounts in INR. Format as `₹ 1,23,456.78`
7. **Phone Numbers**: Indian mobile `+91 XXXXX XXXXX` format
8. **File Uploads**: Multipart/form-data with progress indicators
9. **Error Handling**: Consistent `{ success: false, error: { code, message } }` format
10. **Real-time Strategy**: Socket.io planned but not yet implemented

---

## Summary

This frontend plan covers **10 phases**. Current completion status:

| Phase | Status | Completion % |
|-------|--------|-------------|
| **P1** Project Scaffold & Layout | ✅ COMPLETE | 95% |
| **P2** Auth & User Management | ✅ MOSTLY COMPLETE | 95% |
| **P3** Product Catalog & Browsing | ✅ MOSTLY COMPLETE | 90% |
| **P4** Cart, Wishlist & Ordering | ✅ MOSTLY COMPLETE | 70% |
| **P5** KhataBook (Credit System) ⭐ | 🟡 PARTIALLY COMPLETE | 55% |
| **P6** Payments, Wallet & Financials | 🟡 PARTIALLY COMPLETE | 40% |
| **P7** Engagement, Reviews & Support | ✅ MOSTLY COMPLETE | 80% |
| **P8** Enterprise & Analytics | ✅ MOSTLY COMPLETE | 75% |
| **P9** Real-time, Polish & Testing | ⬜ NOT STARTED | 15% |
| **P10** Deployment & DevOps | ⬜ NOT STARTED | 0% |

**Key stats**: 16 Zustand stores (all with API integration), 6 test files (47 tests), **53 page files**, Guard components (AuthGuard, GuestGuard, RoleGuard), Layout components (Navbar, Sidebar, Footer), **Next.js 16 + React 19 + Tailwind v4**.
