FROM node:20-alpine AS base

RUN apk upgrade --no-cache libcrypto3 libssl3 \
    && apk add --no-cache openssl \
    && npm install --global npm@11.18.0


FROM base AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate
RUN npm run build


FROM base AS production-dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate \
    && chown -R node:node /app


FROM production-dependencies AS migrations

USER node

CMD ["npx", "prisma", "migrate", "deploy"]


FROM base AS runtime

WORKDIR /app

ENV NODE_ENV=production

RUN rm -rf /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx

COPY --chown=node:node --from=production-dependencies /app/node_modules ./node_modules
COPY --chown=node:node --from=production-dependencies /app/package.json ./package.json
COPY --chown=node:node --from=production-dependencies /app/package-lock.json ./package-lock.json
COPY --chown=node:node --from=production-dependencies /app/prisma ./prisma
COPY --chown=node:node --from=build /app/dist ./dist

USER node

EXPOSE 8083

CMD ["node", "-r", "./dist/tracing-register.js", "dist/main.js"]
