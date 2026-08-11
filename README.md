# Neural Link

A cinematic AI portfolio for **Asiful Islam** — a quiet, conversational interface
for exploring a supplied technical and creative profile through grounded chat and
spoken (browser) answers.

> Personal answers are restricted to information Asiful supplied. The assistant
> never invents unprovided personal facts, employers, dates, or credentials.

## Stack

- **pnpm workspaces** (Node 24, TypeScript 5.9)
- **API:** Express 5, OpenRouter chat completions (server-side, key never reaches the browser)
- **DB:** PostgreSQL + Drizzle ORM (package included; **not required at runtime**)
- **Codegen:** Orval from `lib/api-spec/openapi.yaml` → Zod schemas + React Query client
- **Frontend:** React 19, Vite 7, Tailwind 4, Framer Motion, canvas "neural" background

## Features

- Profile-grounded chat with a deterministic local answer path (works even if the
  AI provider is unavailable).
- Microphone transcription (Web Speech API, Chrome/Edge).
- Spoken answers via the browser's built-in SpeechSynthesis (no extra audio key needed).
- Dark "neural interface" visual identity.

## Requirements

- Node.js 24+
- An **OpenRouter** API key (`OPENROUTER_API_KEY`) for chat. No database is required.

## Run locally

```bash
pnpm install

# API server (port 5000)
pnpm --filter @workspace/api-server run dev

# Frontend (Vite dev server)
pnpm --filter @workspace/neural-link run dev
```

Copy `.env.example` to `.env` and set `OPENROUTER_API_KEY`.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm run typecheck` | Typecheck all packages |
| `pnpm run build` | Typecheck + build all packages |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API client + Zod from OpenAPI |
| `pnpm --filter @workspace/db run push` | Push Drizzle schema (dev only) |

## Where things live

- `artifacts/neural-link` — public experience / UI
- `artifacts/api-server/src/routes/neural-link.ts` — chat + profile-grounded logic
- `lib/api-spec/openapi.yaml` — API source of truth
- `lib/api-zod`, `lib/api-client-react` — generated validation + client

## License

MIT — see [LICENSE](./LICENSE).
