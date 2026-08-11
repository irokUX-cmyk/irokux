# Neural Link — Render Docker build
FROM node:22-bookworm-slim

# Enable pnpm via corepack (present in node:22)
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy the entire repo FIRST so every workspace package.json is present
# before install (otherwise workspace packages added later get no node_modules).
COPY . .

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile=false

# Build everything (libs, frontend, api-server, all artifacts)
ENV NODE_ENV=production
ENV PORT=3000
ENV BASE_PATH=/
RUN pnpm run build

EXPOSE 3000
CMD ["sh", "-c", "cd artifacts/api-server && node --enable-source-maps ./dist/index.mjs"]
