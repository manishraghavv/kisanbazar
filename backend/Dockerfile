# ─────────────────────────────────────────────────────────────
#  Multi-Vendor E-commerce Backend — Multi-Stage Dockerfile
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Dependencies & Build ────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY prisma/ ./prisma/
COPY src/ ./src/

# Generate Prisma client and build TypeScript
RUN npx prisma generate
RUN npm run build || npx tsc --noEmit

# ── Stage 2: Production ──────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --production

# Copy built output from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Generate Prisma client for production
RUN npx prisma generate

# Create non-root user
RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
