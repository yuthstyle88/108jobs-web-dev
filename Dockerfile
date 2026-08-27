# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV NEXT_TELEMETRY_DISABLED=1
ENV CI=true
ENV API_INTERNAL_URL="http://127.0.0.1:31440"

COPY package.json pnpm-lock.yaml ./
COPY src/lib/108heros-client/package.json src/lib/108heros-client/pnpm-lock.yaml ./src/lib/108heros-client/
COPY src/lib/108heros-client ./src/lib/108heros-client

# Install 108heros-client dependencies and compile it to dist/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    cd src/lib/108heros-client && corepack pnpm install --frozen-lockfile && corepack pnpm run build

# Install root dependencies (including devDependencies for Next.js build)
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    corepack pnpm install --frozen-lockfile

# Copy all source files
COPY . .

# Build Next.js standalone application
RUN --mount=type=cache,target=/app/.next/cache \
    corepack pnpm run build

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
