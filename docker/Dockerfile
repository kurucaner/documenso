###########################
#     BASE CONTAINER      #
###########################
FROM oven/bun:1.4.2-alpine AS base

RUN apk add --no-cache openssl
RUN apk add --no-cache font-freefont


###########################
#   INSTALLER CONTAINER   #
###########################
FROM base AS installer

RUN apk add --no-cache libc6-compat
RUN apk add --no-cache jq
# Required for node_modules/aws-crt
RUN apk add --no-cache make cmake g++ openssl bash

WORKDIR /app

ENV HUSKY=0
ENV DOCKER_OUTPUT=1
ENV NEXT_TELEMETRY_DISABLED=1

# Encryption keys
ARG NEXT_PRIVATE_ENCRYPTION_KEY="CAFEBABE"
ENV NEXT_PRIVATE_ENCRYPTION_KEY="$NEXT_PRIVATE_ENCRYPTION_KEY"

ARG NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY="DEADBEEF"
ENV NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY="$NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY"

# Sub-path the app is served under (e.g. "/ESign"). Empty = root.
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH="$NEXT_PUBLIC_BASE_PATH"

# Telemetry credentials (optional, baked into image at build time)
ARG NEXT_PRIVATE_TELEMETRY_KEY=""
ENV NEXT_PRIVATE_TELEMETRY_KEY="$NEXT_PRIVATE_TELEMETRY_KEY"

ARG NEXT_PRIVATE_TELEMETRY_HOST=""
ENV NEXT_PRIVATE_TELEMETRY_HOST="$NEXT_PRIVATE_TELEMETRY_HOST"

COPY .gitignore .gitignore
COPY package.json bun.lock bunfig.toml turbo.json lingui.config.ts ./
COPY patches ./patches
COPY apps ./apps
COPY packages ./packages

RUN bun install --frozen-lockfile

RUN bunx turbo run build --filter=@documenso/remix...

RUN test -f node_modules/@documenso/skia-canvas/lib/skia.node

RUN bunx prisma generate --schema ./packages/prisma/schema.prisma --generator client

###########################
#     RUNNER CONTAINER    #
###########################
FROM base AS runner

ENV HUSKY=0
ENV DOCKER_OUTPUT=1

ARG NEXT_PRIVATE_TELEMETRY_KEY=""
ENV NEXT_PRIVATE_TELEMETRY_KEY="$NEXT_PRIVATE_TELEMETRY_KEY"

ARG NEXT_PRIVATE_TELEMETRY_HOST=""
ENV NEXT_PRIVATE_TELEMETRY_HOST="$NEXT_PRIVATE_TELEMETRY_HOST"

RUN addgroup --system --gid 1001 app
RUN adduser --system --uid 1001 app

USER app

WORKDIR /app

COPY --from=installer --chown=app:app /app/package.json ./package.json
COPY --from=installer --chown=app:app /app/bun.lock ./bun.lock
COPY --from=installer --chown=app:app /app/node_modules ./node_modules
COPY --from=installer --chown=app:app /app/patches ./patches
COPY --from=installer --chown=app:app /app/apps/remix/build ./apps/remix/build
COPY --from=installer --chown=app:app /app/apps/remix/public ./apps/remix/public
COPY --from=installer --chown=app:app /app/packages/prisma/schema.prisma ./packages/prisma/schema.prisma
COPY --from=installer --chown=app:app /app/packages/prisma/migrations ./packages/prisma/migrations

COPY --chown=app:app ./docker/start.sh /app/apps/remix/start.sh

WORKDIR /app/apps/remix

CMD ["sh", "start.sh"]
