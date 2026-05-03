# syntax=docker/dockerfile:1.7

FROM oven/bun:1.3-alpine@sha256:4de475389889577f346c636f956b42a5c31501b654664e9ae5726f94d7bb5349 AS base
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
RUN find .next/standalone/.next -name "*.map" -delete \
 && find .next/server         -name "*.map" -delete

# ---- runner ----
FROM oven/bun:1.3-alpine@sha256:4de475389889577f346c636f956b42a5c31501b654664e9ae5726f94d7bb5349 AS runner
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
