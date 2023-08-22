FROM hub.lumigame.com/docker-hub/library/node:lts-alpine AS builder
WORKDIR /app
COPY . .
RUN yarn reg \
 && yarn install
RUN yarn build

FROM hub.lumigame.com/docker-hub/library/node:lts-alpine
ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV
RUN mkdir /app && chown node:node /app
WORKDIR /app

USER node
ENV PATH /app/node_modules/.bin:$PATH
COPY package.json yarn.lock .modprunerrc ./
RUN yarn reg \
 && yarn install --production \
 && npx mod-pruner prune --force
COPY --from=builder /app/lib .

HEALTHCHECK --interval=10s CMD yarn run:healthcheck

CMD [ "yarn", "run:container" ]
