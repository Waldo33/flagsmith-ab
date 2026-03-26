FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock ./
RUN yarn install --ignore-engines

COPY . .

EXPOSE 4000
