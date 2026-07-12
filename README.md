# 🚜 Multi-Vendor Agri-Commerce Platform

> **A full-stack B2B/B2C marketplace for Indian agriculture** — connecting vendors (agri-input sellers) with farmers through a digital platform featuring a built-in credit ledger system (KhataBook).

[![Deploy to EC2](https://github.com/your-org/multi-vendor/actions/workflows/deploy.yml/badge.svg)](https://github.com/your-org/multi-vendor/actions/workflows/deploy.yml)
[![Node.js](https://img.shields.io/badge/Node.js-22_LTS-339933?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5%2B-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

---

## 📋 Table of Contents

- [About](#about)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [API Overview](#api-overview)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## 🧭 About

This platform is purpose-built for **Indian agricultural commerce**, addressing the unique needs of rural markets where traditional credit/udhar relationships are the norm. It enables:

- **Vendors** (agri-input shops) to list seeds, fertilizers, pesticides, and equipment
- **Farmers** to browse products in their local language (Hindi), place orders, and manage credit accounts
- **Vendors & Farmers** to maintain digital KhataBooks — replacing the traditional paper ledger with real-time credit tracking

The backend implements **120+ API endpoints** across 8 route modules, with a 41-model Prisma schema covering everything from user management to GST-compliant invoicing.

---

## ✨ Key Features

### 👥 User Roles
- **FARMER** — Browse products, place orders, manage khata credit
- **VENDOR** — Manage catalog, process orders, extend credit via KhataBook
- **ADMIN** — Platform oversight, moderation, user management
- **DELIVERY** — Logistics and shipment tracking

### 📦 Product Catalog
- Hierarchical categories with Hindi/English names
- Product variants (SKU, price tiers, stock tracking)
- Multi-language support for product names and descriptions
- GST HSN codes for tax compliance
- Inventory management with low-stock alerts

### 📒 KhataBook ⭐ (Core Differentiator)
- Digital credit ledger between vendor-farmer pairs
- Track udhar (credit given) and wapsi (repayment)
- Interest calculation on overdue amounts
- Monthly statements with PDF generation
- Credit limit requests and approvals
- Overdue escalation and auto-suspension

### 🛒 Shopping & Orders
- Cart with stock validation
- Wishlist with move-to-cart functionality
- Order lifecycle: Pending → Confirmed → Processing → Shipped → Delivered
- Cancellations, returns, and refunds
- Shipment tracking with real-time events

### 💰 Payments & Financials
- Multiple payment methods: UPI, Card, Net Banking, COD, Wallet, Khata Credit
- Coupon system (percentage, fixed, free delivery)
- Wallet with transaction history
- Vendor commissions and periodic settlements (with TDS)
- Razorpay and PayU gateway support

### 📊 Analytics & Reporting
- Vendor dashboard with KPIs: revenue, orders, khata overview
- Admin platform dashboard with system-wide metrics
- Sales reports, product performance, khata overdue reports
- Audit log viewer for compliance

### 🔐 Security & Compliance
- JWT authentication (access + refresh tokens)
- Phone OTP verification (India-first, +91 numbers)
- Role-based access control (RBAC) with fine-grained permissions
- Audit logging for all critical actions
- DPDP Act compliance — data export and account deletion
- Rate limiting across 3 tiers

---

## 🛠️ Tech Stack

### Backend

| Category | Technology |
|----------|-----------|
| **Runtime** | Node.js 22 LTS |
| **Framework** | Express 5 (TypeScript) |
| **Database** | PostgreSQL 16 |
| **ORM** | Prisma 7 |
| **Cache** | Redis |
| **Auth** | JWT + Refresh Tokens + OTP |
| **Payments** | Razorpay, PayU |
| **File Storage** | Amazon S3 |
| **Real-time** | Socket.io + Redis Adapter |
| **Background Jobs** | BullMQ |
| **Email** | Resend |
| **SMS** | Twilio |
| **Error Tracking** | Sentry |
| **API Docs** | Swagger / OpenAPI |
| **DI Container** | tsyringe |

### Frontend

| Category | Technology |
|----------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript (strict) |
| **Styling** | Tailwind CSS v4 |
| **State** | Zustand v5 (client) + TanStack Query v5 (server) |
| **Forms** | React Hook Form + Zod |
| **HTTP Client** | Axios with JWT interceptor |
| **Icons** | Lucide React |
| **Charts** | Recharts |
| **Notifications** | Sonner (toast) |
| **Testing** | Vitest + Testing Library + Playwright |

### DevOps

| Category | Technology |
|----------|-----------|
| **CI/CD** | GitHub Actions |
| **Hosting** | AWS EC2 (Ubuntu 24.04) |
| **Process Manager** | PM2 |
| **Reverse Proxy** | Nginx |
| **SSL** | Let's Encrypt (Certbot) |
| **Container** | Docker / Docker Compose |

---

## 🏗️ Architecture Overview

```
Internet
    │
    ▼
┌─────────────────────┐         ┌────────────────────┐
│   AWS EC2            │         │  GitHub Actions     │
│  (Ubuntu 24.04)      │         │  (CI/CD Pipeline)   │
│                      │         │                     │
│  ┌───────────────┐  │  :80    │  push → main        │
│  │    Nginx        │  │◄────────┤  triggers build    │
│  │  (reverse proxy)│  │         │  & deploy          │
│  └───────┬───────┘  │         └────────────────────┘
│          │          │
│     ┌────┴────┐     │
│     │   PM2    │     │
│     │          │     │
│     │ ┌──────┐ │     │  :3000     ┌──────────────┐
│     │ │backend│─┼───────────►     │  PostgreSQL  │
│     │ └──────┘ │     │            └──────────────┘
│     │ ┌──────┐ │     │  :3001
│     │ │frontnd│─┼──────┐
│     │ └──────┘ │     │     │
│     └──────────┘     │     ▼
│                      │  ┌──────────────┐
└──────────────────────┘  │    Redis      │
                          └──────────────┘
```

### Data Flow

1. **Public users** browse products/categories via the frontend (Next.js SSR)
2. **Authenticated requests** go through JWT validation → role check → controller → service → Prisma → PostgreSQL
3. **Cache layer** (Redis) accelerates hot data (products, categories, khata balances)
4. **Background jobs** (BullMQ) handle: email/SMS dispatch, interest calculations, settlement generation
5. **Real-time events** (Socket.io) push notifications, order updates, and khata transactions to connected clients
6. **File uploads** go directly to Amazon S3 via pre-signed URLs

### Port Mapping

| Service  | Port | Description |
|----------|------|-------------|
| Nginx    | 80   | Reverse proxy (public HTTP) |
| Nginx    | 443  | HTTPS (with SSL) |
| Backend  | 3000 | Express API |
| Frontend | 3001 | Next.js SSR |
| Postgres | 5432 | Database |
| Redis    | 6379 | Cache / Queue |

---

## 🚀 Getting Started

### Prerequisites

```bash
# Required
node -v     # >= 22.x LTS
npm -v      # >= 10.x
docker -v   # for local PostgreSQL + Redis

# Optional
psql --version
redis-cli --version
```

### Local Development Setup

#### 1. Clone the Repository

```bash
git clone https://github.com/your-org/multi-vendor.git
cd multi-vendor
```

#### 2. Start Infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL (port 5432) and Redis (port 6379).

#### 3. Backend Setup

```bash
cd backend

# Copy environment variables
cp .env.example .env
# Edit .env with your values (database URL, JWT secrets, etc.)

# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start development server
npm run dev
```

The backend API runs on **http://localhost:3000**.

> **Note**: The backend `.env.example` file contains a `[TEMPLATE]` header at the top. Remove this line after copying — it marks the file as a template. The rest of the file is ready to use.

#### 4. Frontend Setup

```bash
cd frontend

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your values

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend runs on **http://localhost:3001**.

#### 5. Access the Application

| URL | Description |
|-----|-------------|
| http://localhost:3001 | Frontend (Next.js) |
| http://localhost:3000/api/health | Backend health check |
| http://localhost:3000/api-docs | Swagger API documentation |

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `REDIS_URL` | Redis connection string | ✅ |
| `JWT_ACCESS_SECRET` | Access token signing secret (32+ chars) | ✅ |
| `JWT_REFRESH_SECRET` | Refresh token signing secret (32+ chars) | ✅ |
| `PORT` | Server port (default: 3000) | ❌ |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | ❌ |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | ⚠️ (for SMS) |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | ⚠️ (for SMS) |
| `RESEND_API_KEY` | Resend API key for emails | ❌ |
| `AWS_REGION` | S3 bucket region | ⚠️ (for uploads) |
| `AWS_ACCESS_KEY_ID` | AWS access key | ⚠️ (for uploads) |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | ⚠️ (for uploads) |
| `AWS_S3_BUCKET` | S3 bucket name | ⚠️ (for uploads) |
| `RAZORPAY_KEY_ID` | Razorpay API key | ⚠️ (for payments) |
| `RAZORPAY_KEY_SECRET` | Razorpay API secret | ⚠️ (for payments) |
| `SENTRY_DSN` | Sentry DSN for error tracking | ❌ |

### Frontend (`frontend/.env.local`)

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_API_URL` | Backend API URL (e.g., `http://localhost:3000/api`) | ✅ |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.io server URL | ⚠️ (for real-time) |
| `NEXT_PUBLIC_APP_URL` | Application URL (for redirects) | ❌ |
| `NEXT_PUBLIC_ENABLE_SOCKET` | Enable WebSocket (`true`/`false`) | ❌ |

---

## 📁 Project Structure

```
multi-vendor/
├── backend/                          # Express API server
│   ├── prisma/
│   │   ├── schema.prisma             # 41 database models
│   │   └── migrations/               # Database migrations
│   └── src/
│       ├── common/                   # Shared utilities
│       │   ├── config/               # Swagger setup
│       │   ├── errors/               # Error classes
│       │   ├── lib/                  # DI, cache, email, etc.
│       │   ├── middleware/           # Auth, rate limiting, etc.
│       │   └── utils/               # JWT, password helpers
│       ├── modules/                  # Feature modules
│       │   ├── auth/                 # Authentication
│       │   ├── users/               # User management
│       │   ├── products/            # Product catalog
│       │   ├── orders/              # Orders & invoices
│       │   ├── payments/            # Payments & wallet
│       │   ├── khata/               # KhataBook (credit system)
│       │   ├── engagement/          # Reviews & engagement
│       │   ├── addresses/           # Address management
│       │   ├── enterprise/          # Enterprise features
│       │   └── admin/               # Admin endpoints
│       └── jobs/                     # Background workers
│
├── frontend/                         # Next.js application
│   └── src/
│       ├── app/                      # App Router pages
│       │   ├── (main)/              # Public pages
│       │   ├── auth/                # Auth pages
│       │   └── dashboard/           # Protected dashboard
│       ├── components/              # Reusable components
│       │   ├── ui/                  # Base UI components
│       │   ├── auth/                # Auth guards
│       │   ├── layout/              # Navbar, sidebar, footer
│       │   └── ...                  # Feature-specific components
│       ├── stores/                  # Zustand state stores
│       ├── lib/                     # API client, validators
│       ├── config/                  # Navigation config
│       └── types/                   # TypeScript type definitions
│
├── .github/workflows/               # CI/CD configuration
│   └── deploy.yml                   # GitHub Actions pipeline
├── ecosystem.config.cjs             # PM2 configuration
├── deploy.sh                        # Deployment script
├── DEPLOYMENT.md                    # Deployment guide
├── docker-compose.yml               # Local infrastructure
└── README.md                        # You are here
```

---

## 🌐 API Overview

The backend exposes **120+ API endpoints** organized into the following modules:

| Module | Base Path | Description |
|--------|-----------|-------------|
| Auth | `/api/auth` | Register, login, OTP, password reset, token refresh |
| Users | `/api/users` | User profiles, admin user management |
| Addresses | `/api/addresses` | Address CRUD |
| Products | `/api/products` | Product catalog, variants, images, attributes |
| Categories | `/api/categories` | Category tree and management |
| Inventory | `/api/inventory` | Stock management and logs |
| Cart | `/api/cart` | Shopping cart |
| Wishlist | `/api/wishlist` | Wishlist management |
| Orders | `/api/orders` | Order lifecycle, invoices, shipments |
| Payments | `/api/payments` | Payment processing and history |
| Wallet | `/api/wallet` | Wallet balance and transactions |
| Khata | `/api/khata` | KhataBook credit ledger |
| Coupons | `/api/coupons` | Coupon management |
| Notifications | `/api/notifications` | User notifications |
| Reviews | `/api/reviews` | Product reviews |
| Support | `/api/support/tickets` | Support ticket system |
| Reports | `/api/reports` | Sales, performance, overdue reports |
| Admin | `/api/admin` | Dashboard, cron triggers, audit logs |
| Enterprise | `/api/industries`, `/api/enterprise-tiers` | Enterprise classification |

**Response Format**:
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message",
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

## 🚢 Deployment

This project uses **GitHub Actions** for CI/CD with automatic deployment to **AWS EC2**.

### Quick Start

1. **Set up an EC2 instance** (Ubuntu 24.04)
2. **Install dependencies**: Node.js 22, PostgreSQL, Redis, Nginx, PM2
3. **Configure GitHub Secrets**:
   - `EC2_HOST`, `EC2_USERNAME`, `EC2_SSH_KEY`, `EC2_PORT`
   - `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`
4. **Push to `main`** — the CI/CD pipeline automatically:
   - Runs lint + type checks
   - Builds frontend and backend
   - Uploads artifacts to EC2 via rsync
   - Runs Prisma migrations
   - Restarts PM2 processes
   - Reloads Nginx

### Manual Deployment

```bash
ssh -i ~/.ssh/your-key.pem ubuntu@<ec2-ip>
cd ~/app
./deploy.sh
```

### Rollback

```bash
./deploy.sh --rollback
```

For detailed setup instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## 🧪 Testing

```bash
# Frontend unit tests (Vitest — 47 store tests)
cd frontend
npm test

# Backend tests (coming soon)
cd backend
npm test

# Run with coverage
cd frontend
npx vitest run --coverage
```

---

## 📊 Project Status

| Phase | Focus Area | Status |
|-------|-----------|--------|
| **P1-P3** | Scaffold, Auth, Catalog | ✅ 90-95% Complete |
| **P4** | Cart, Wishlist, Orders | ✅ 70% Complete |
| **P5** | ⭐ KhataBook (Credit System) | 🟡 55% Complete |
| **P6** | Payments, Wallet, Financials | 🟡 40% Complete |
| **P7** | Engagement, Reviews, Support | ✅ 80% Complete |
| **P8** | Enterprise & Analytics | ✅ 75% Complete |
| **P9** | Real-time, i18n, Testing | ⬜ 15% Complete |
| **P10** | Deployment & DevOps | ✅ Complete |

**Key Metrics**:
- **53** page files across the frontend
- **16** Zustand state stores
- **41** database models
- **120+** API endpoints
- **47** unit tests

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow existing code conventions (TypeScript strict mode, ESLint)
- Add Zod validation for all new frontend forms
- Write tests for new Zustand stores
- Update the API integration map in `FRONTEND_DEVELOPMENT_PLAN.md`
- Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`

---

## 📄 License

This project is licensed under the ISC License — see the [LICENSE](LICENSE) file for details (if applicable).

---

## 🙏 Acknowledgments

- Built for the Indian agriculture ecosystem
- Inspired by traditional KhataBook/udhar practices in rural India
- Aimed at digitizing the ₹6 lakh crore Indian agri-input market

---

<p align="center">
  Made with ❤️ for Indian Farmers and Agri-Vendors
</p>
