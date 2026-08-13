FROM node:22-alpine AS base

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .


FROM base AS dev

EXPOSE 5173

CMD ["npm", "run", "dev"]


FROM base AS builder

# Baked into the bundle at build time; a static SPA has no runtime env.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build


FROM nginx:alpine AS web

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]


FROM base AS test

RUN printf '#!/bin/sh\nset -e\nnpm run test:run\n' > /usr/local/bin/run-tests \
    && chmod +x /usr/local/bin/run-tests
