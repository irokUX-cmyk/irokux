# Asiful Islam — Neural Link

A cinematic AI portfolio that lets visitors explore Asiful Islam’s supplied technical and creative profile through grounded chat, microphone transcription, and spoken answers.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/neural-link` — the public Neural Link experience and visual interface
- `artifacts/api-server/src/routes/neural-link.ts` — profile-grounded chat and OpenAI speech routes
- `lib/api-spec/openapi.yaml` — source of truth for `/api/chat` and `/api/tts`
- `attached_assets/index_1786369558939.html` — original uploaded visual reference

## Architecture decisions

- Profile questions have a deterministic local answer path so the portfolio remains useful when the external AI provider is unavailable.
- General questions are sent server-side to OpenAI; the browser never receives the provider secret.
- Spoken responses use server-generated MP3 audio rather than browser speech synthesis.

## Product

Visitors can explore the supplied profile, ask grounded questions, use microphone transcription, and play assistant answers aloud. The assistant refuses to invent unprovided personal facts.

## User preferences

- Preserve the uploaded dark neural-interface identity and keep personal claims restricted to supplied information.

## Gotchas

- Restart both managed workflows after server or frontend changes so the proxied preview receives the update.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
