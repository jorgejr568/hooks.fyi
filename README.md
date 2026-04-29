# hooks.fyi

Disposable HTTP request bins. Create a URL, send any request to it (any method, any body, files), watch every byte show up in real time.

## Stack

- Next.js 16 (App Router) + TypeScript
- Postgres 16 + Prisma 7 (with `@prisma/adapter-pg`)
- S3-compatible object storage (MinIO locally, any S3 in prod)
- shadcn/ui (base-ui) on Tailwind v4 with a deep-dark theme
- Vitest, busboy multipart parser

## Local development

Prereqs: Node 22+, pnpm 9+, Docker.

```bash
pnpm install
cp .env.example .env.local       # already populated for local docker
pnpm db:up                       # starts postgres + minio in docker
pnpm db:migrate                  # applies prisma migrations
pnpm dev                         # http://localhost:3000
```

MinIO console: http://localhost:9101 (creds from `.env.local`).
Postgres: `postgres://hooks:hooks@localhost:5433/hooksfyi`.

## Tests

```bash
pnpm test                        # vitest (uses .env.test against the same docker postgres)
```

## How it works

- `POST /api/hooks` creates a hook with a UUID id.
- Anything sent to `/h/{hookId}` (any HTTP method, any sub-path) gets parsed and persisted:
  - text/JSON/form bodies → `Request.body` in Postgres (truncated past `MAX_BODY_BYTES`, default 1 MB)
  - multipart files → uploaded to S3, metadata stored as `Attachment`, served at `/api/files/{hookId}/{attachmentId}.{ext}`
- The dashboard at `/{hookId}` subscribes to an SSE stream and renders new requests as they arrive.
- The body viewer auto-decodes JSON / form-urlencoded / multipart text fields into a collapsible tree, and previews image / PDF / audio / video bodies inline. A `Decoded ↔ Raw` toggle is always available.

## Production deployment

### Option 1 — self-contained docker compose

```bash
cp .env.example .env
$EDITOR .env                     # set strong POSTGRES_PASSWORD + S3_*
docker compose -f compose.prod.yml up -d --build
```

This builds two images (the app and a one-shot migrator), brings up Postgres + MinIO, creates the bucket, runs `prisma migrate deploy`, then starts the app on port `${APP_PORT:-3000}`. Data persists in named volumes. To re-run migrations later (after pulling new schema changes), do:

```bash
docker compose -f compose.prod.yml up --build migrate
```

### Option 2 — bring your own Postgres + S3

Build the image and run it against managed services:

```bash
docker build -t hooksfyi:latest .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e S3_ENDPOINT=https://s3.us-east-1.amazonaws.com \
  -e S3_REGION=us-east-1 \
  -e S3_BUCKET=hooks-fyi-prod \
  -e S3_ACCESS_KEY_ID=... \
  -e S3_SECRET_ACCESS_KEY=... \
  -e S3_FORCE_PATH_STYLE=false \
  -e NEXT_PUBLIC_APP_URL=https://hooks.fyi \
  -e HOOK_PUBLIC_HOST=hooks.fyi \
  hooksfyi:latest
```

Run migrations against your managed Postgres before the first boot. Either locally with `pnpm db:deploy` (needs `DATABASE_URL` set), or by building and running the dedicated migrator image:

```bash
docker build -f Dockerfile.migrate -t hooksfyi-migrate:latest .
docker run --rm -e DATABASE_URL="postgresql://..." hooksfyi-migrate:latest
``` The image uses Next.js [standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) so it ships only the runtime files it actually needs (`server.js` + the minimal `node_modules` slice, plus `.next/static` and `public/`). Final image is roughly 200 MB.

| var | example |
| --- | --- |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db?schema=public` |
| `S3_ENDPOINT` | `https://s3.us-east-1.amazonaws.com` |
| `S3_REGION` | `us-east-1` |
| `S3_BUCKET` | `hooks-fyi-prod` |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | IAM creds |
| `S3_FORCE_PATH_STYLE` | `false` (real S3) / `true` (MinIO) |
| `NEXT_PUBLIC_APP_URL` | `https://hooks.fyi` |
| `HOOK_PUBLIC_HOST` | `hooks.fyi` |
| `MAX_BODY_BYTES` | `1048576` |
| `MAX_FILE_BYTES` | `52428800` |

The app is single-process, so SSE pub/sub uses an in-memory `EventEmitter`. To run multiple instances behind a load balancer, swap `src/lib/events/hook-events.ts` for a Redis or Postgres `LISTEN/NOTIFY`-backed implementation.

## License

MIT — see [LICENSE](./LICENSE).
