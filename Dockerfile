# syntax=docker/dockerfile:1.7

ARG BUN_VERSION=1.3-alpine

FROM oven/bun:${BUN_VERSION} AS base
WORKDIR /app

# ---- dependencies ----
FROM base AS deps
COPY package.json bun.lock ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile

# ---- builder ----
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bunx prisma generate
RUN bun run build

# ---- runner ----
FROM oven/bun:${BUN_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Standalone server (server.js + minimal node_modules) + static assets + public/
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public
# Prisma schema + migrations so `migrate deploy` can run at boot via entrypoint
COPY --from=builder --chown=nextjs:nodejs /app/prisma          ./prisma

USER nextjs
EXPOSE 3000

CMD ["bun", "server.js"]
