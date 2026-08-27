# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@8.15.4 --activate
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json pnpm-lock.yaml ./
COPY src/lib/108heros-client/package.json ./src/lib/108heros-client/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@8.15.4 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build local client dependency first, then Next.js standalone application
RUN ./node_modules/.bin/tsc -p src/lib/108heros-client/tsconfig.json
RUN --mount=type=cache,target=/app/.next/cache \
    pnpm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN useradd -u 10001 -m app

# Copy standalone server, static assets, and public directory
COPY --from=builder /app/public ./public
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static

USER app
EXPOSE 3000
CMD ["node", "server.js"]
