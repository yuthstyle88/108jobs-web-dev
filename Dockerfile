# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV NEXT_TELEMETRY_DISABLED=1
ENV CI=true
ENV API_INTERNAL_URL="https://api.108heros.com"
ENV NEXT_PUBLIC_API_BASE_URL="https://api.108heros.com"
ENV APP_NAME="108jobs.com"
ENV APP_URL="https://108jobs.com"
ENV NEXT_PUBLIC_APP_NAME="108jobs.com"
ENV NEXT_PUBLIC_APP_URL="https://108jobs.com"
# Needed in the BUILDER stage, not only the runner. Next inlines NEXT_PUBLIC_*
# into the browser bundle at build time, and next.config.ts reads this same
# variable then to put the Identity origin into the CSP `connect-src`. Set only
# at runtime, the phone/OTP calls would be compiled against nothing and, if they
# were made anyway, blocked by the page's own CSP.
ENV NEXT_PUBLIC_IDENTITY_BASE_URL="https://identity.108plaza.net"

COPY package.json pnpm-lock.yaml .npmrc ./

# Install dependencies, including @108-plaza/jh-client from the org's private
# registry (Gate 3 -- it used to be a folder in this repo).
#
# The token arrives as a buildkit SECRET, never a build-arg: a build-arg is
# baked into the image history and `docker history` hands it to anyone who can
# pull the image. It is exported for the length of this one RUN and read by
# .npmrc's ${NODE_AUTH_TOKEN}, so it never reaches a layer.
#
# GH_PAT_DEPLOY, the same token this repo already uses for GHCR: the npm
# registry answers 403 to a workflow's GITHUB_TOKEN even when the package
# grants the repository access, so it wants a personal token with
# `read:packages`. A local build passes its own:
# `--secret id=gh_token,env=GITHUB_TOKEN`.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    --mount=type=secret,id=gh_token,required=true \
    NODE_AUTH_TOKEN="$(cat /run/secrets/gh_token)" \
    corepack pnpm install --frozen-lockfile

# Copy all source files
COPY . .

# Build Next.js standalone application
RUN --mount=type=cache,target=/app/.next/cache \
    corepack pnpm run build

FROM node:22-bookworm-slim AS runner
# Identity of this image (VERSIONING_STANDARD.md §3), passed as build-args by
# release-image.yml: the short sha that is also the image tag, the UTC build
# time, and the lane the branch maps to. Deliberately "unknown" when built by
# hand -- /api/version reports what it does not know rather than inventing it.
# APP_CHANNEL is also set per lane at deploy (helm --set config.APP_CHANNEL),
# and the pod env wins over this default.
ARG APP_BUILD=unknown
ARG APP_BUILT_AT=unknown
ARG APP_CHANNEL=unknown
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    APP_BUILD=$APP_BUILD \
    APP_BUILT_AT=$APP_BUILT_AT \
    APP_CHANNEL=$APP_CHANNEL \
    API_INTERNAL_URL="https://api.108heros.com" \
    NEXT_PUBLIC_API_BASE_URL="https://api.108heros.com" \
    APP_NAME="108jobs.com" \
    APP_URL="https://108jobs.com" \
    NEXT_PUBLIC_APP_NAME="108jobs.com" \
    NEXT_PUBLIC_APP_URL="https://108jobs.com" \
    NEXT_PUBLIC_IDENTITY_BASE_URL="https://identity.108plaza.net"
RUN useradd -u 10001 -m app

# Copy standalone server, static assets, and public directory
COPY --from=builder /app/public ./public
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static

USER app
EXPOSE 3000
CMD ["node", "server.js"]
