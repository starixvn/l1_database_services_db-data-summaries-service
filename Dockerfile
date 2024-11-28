FROM hub.lumigame.com/ldb/node-base:22 AS base

# Core CI/CD will cache `builder` stage
FROM base AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY package.json pnpm-lock.yaml .npmrc /app/
WORKDIR /app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM builder AS build
COPY . /app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build
RUN rm lib/app-configs.*

FROM base
ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV
ENV NODE_OPTIONS=""

COPY --from=builder --chown=node:node /app/node_modules /app/node_modules
COPY --from=build --chown=node:node /app/lib /app/

WORKDIR /app
USER node

HEALTHCHECK --interval=10s CMD node healthcheck/request.js
CMD [ "node", "index.js" ]
