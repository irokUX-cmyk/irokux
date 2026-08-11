# Neural Link — Render Docker build
FROM node:22-bookworm-slim

# Install pnpm via corepack (enabled by default on node:22)
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Install deps (use copied lockfile + package.json)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY artifacts/neural-link/package.json artifacts/neural-link/package.json
COPY artifacts/api-server/package.json artifacts/api-server/package.json
COPY lib/api-zod/package.json lib/api-zod/package.json
COPY lib/api-client-react/package.json lib/api-client-react/package.json
COPY lib/db/package.json lib/db/package.json
COPY lib/api-spec/package.json lib/api-spec/package.json

RUN pnpm install --frozen-lockfile=false

# Copy the rest of the source
COPY . .

# Build everything (libs, frontend, api-server)
ENV NODE_ENV=production
ENV PORT=3000
ENV BASE_PATH=/
RUN pnpm run build

EXPOSE 3000
CMD ["sh", "-c", "cd artifacts/api-server && node --enable-source-maps ./dist/index.mjs"]
