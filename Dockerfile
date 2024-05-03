FROM hub.lumigame.com/docker-hub/library/node:20-alpine AS base
RUN apk upgrade \
 && npm upgrade --latest --global npm pnpm \
 && rm -rf /var/cache/apk/* \
 && rm -rf /usr/local/share/man

FROM base AS build-base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY . /app
WORKDIR /app

FROM build-base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM build-base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build
RUN rm lib/app-configs.*

FROM base
ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV
ENV NODE_OPTIONS="--enable-source-maps --no-warnings --experimental-default-type=module --es-module-specifier-resolution=node"

COPY --from=prod-deps --chown=node:node /app/node_modules /app/node_modules
COPY --from=build --chown=node:node /app/lib /app/

WORKDIR /app
USER node

HEALTHCHECK --interval=10s CMD node healthcheck/request.js
CMD [ "node", "index.js" ]
