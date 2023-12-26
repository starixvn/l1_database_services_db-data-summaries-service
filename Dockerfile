FROM hub.lumigame.com/docker-hub/library/node:18-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY . /app
WORKDIR /app

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build

FROM hub.lumigame.com/docker-hub/library/node:18-alpine
ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV
ENV NODE_OPTIONS="--enable-source-maps --no-warnings --experimental-default-type=module --es-module-specifier-resolution=node"

COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/lib /app/

RUN chown -R node:node /app
WORKDIR /app
USER node

HEALTHCHECK --interval=10s CMD node healthcheck.js
CMD [ "node", "app.js" ]
