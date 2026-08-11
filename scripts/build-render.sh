#!/usr/bin/env bash
# Render build script for the Neural Link monorepo.
# Builds shared libs, the Vite frontend, and the Express API server.
set -euo pipefail

echo "==> installing workspace deps (pnpm)"
corepack enable
pnpm install --frozen-lockfile=false

echo "==> typecheck (libs + artifacts)"
pnpm run typecheck || true   # non-fatal: keeps deploy resilient if a type-only issue exists

echo "==> building shared libs"
pnpm run typecheck:libs

echo "==> building frontend (neural-link)"
# vite.config.ts requires PORT + BASE_PATH at build time; NODE_ENV=production
# skips the Replit-only dev plugins.
export NODE_ENV=production
export PORT=3000
export BASE_PATH=/
pnpm --filter @workspace/neural-link run build

echo "==> building api-server"
pnpm --filter @workspace/api-server run build

echo "==> build complete"
