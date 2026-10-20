# ─────────────────────────────────────────────────────────────
#  Multi-Vendor E-commerce Backend — multi-stage Dockerfile
#  Targets: builder (build + prisma CLI, used for migrations) and production (default)
# ─────────────────────────────────────────────────────────────

# ── Stage 1: build ───────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json prisma.config.ts ./
COPY prisma/ ./prisma/
COPY src/ ./src/

# The Prisma config reads DATABASE_URL, but generate never connects to the database.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate
RUN npm run build

# ── Stage 2: production ──────────────────────────────────────
FROM node:22-alpine AS production

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Generated Prisma client (lives in node_modules/.prisma, next to the @prisma/client runtime)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

RUN mkdir -p uploads && chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT:-3000}/health || exit 1

CMD ["node", "dist/index.js"]
