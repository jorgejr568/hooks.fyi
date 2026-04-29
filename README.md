# hooks.fyi

Disposable HTTP request bins. Create a URL, send any request to it (any method, any body, files), watch every byte show up in real time.

## Stack

- Next.js 15 (App Router) + TypeScript
- Postgres 16 + Prisma
- S3-compatible object storage (MinIO locally, any S3 in prod)
- shadcn/ui on Tailwind v4 with a deep-dark theme
- Vitest

## Local development

Prereqs: Node 20+, pnpm 9+, Docker.

```bash
pnpm install
cp .env.example .env.local       # already populated for local docker
pnpm db:up                       # starts postgres + minio in docker
pnpm db:migrate                  # applies prisma migrations
pnpm dev                         # http://localhost:3000
```

MinIO console: http://localhost:9101 (`hooksminio` / `hooksminio`).
Postgres: `postgres://hooks:hooks@localhost:5433/hooksfyi`.

## Tests

```bash
pnpm test                        # runs Vitest (uses .env.test against the same docker postgres)
```

## How it works

- `POST /api/hooks` creates a hook with a UUID id.
- Anything sent to `/h/{hookId}` (any HTTP method) gets parsed and persisted:
  - text/JSON/form bodies → `Request.body` in Postgres (truncated past `MAX_BODY_BYTES`, default 1 MB)
  - multipart files → uploaded to S3, metadata stored as `Attachment`
- The dashboard at `/{hookId}` subscribes to an SSE stream and renders new requests as they arrive.

## Production deployment

Set in your environment:

| var | example |
| --- | --- |
| `DATABASE_URL` | `postgresql://...` (managed Postgres) |
| `S3_ENDPOINT` | `https://s3.us-east-1.amazonaws.com` |
| `S3_REGION` | `us-east-1` |
| `S3_BUCKET` | `hooks-fyi-prod` |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | IAM creds |
| `S3_FORCE_PATH_STYLE` | `false` (real S3) / `true` (MinIO) |
| `NEXT_PUBLIC_APP_URL` | `https://hooks.fyi` |
| `HOOK_PUBLIC_HOST` | `hooks.fyi` |

The app is single-process, so SSE pub/sub uses an in-memory `EventEmitter`. To run multiple instances, swap `src/lib/events/hook-events.ts` for a Redis or Postgres `LISTEN/NOTIFY`-backed implementation.
