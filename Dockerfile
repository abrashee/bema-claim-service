FROM node:20-bullseye

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate

RUN npm run build

EXPOSE 8083

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]