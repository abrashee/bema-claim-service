FROM node:20-bullseye AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate
RUN npm run build


FROM node:20-bullseye AS production-dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate


FROM node:20-bullseye AS runtime

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY --chown=node:node --from=production-dependencies /app/node_modules ./node_modules
COPY --chown=node:node --from=production-dependencies /app/package.json ./package.json
COPY --chown=node:node --from=production-dependencies /app/package-lock.json ./package-lock.json
COPY --chown=node:node --from=production-dependencies /app/prisma ./prisma
COPY --chown=node:node --from=build /app/dist ./dist

USER node

EXPOSE 8083

CMD ["node", "-r", "./dist/tracing-register.js", "dist/main.js"]
