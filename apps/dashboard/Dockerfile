FROM node:20-alpine AS build
WORKDIR /repo

RUN corepack enable

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY apps/dashboard/package.json ./apps/dashboard/package.json

RUN pnpm install --frozen-lockfile --filter @backend-monitoring/dashboard...

COPY apps/dashboard ./apps/dashboard
RUN pnpm --filter @backend-monitoring/dashboard build

FROM nginx:1.27-alpine AS production
WORKDIR /usr/share/nginx/html

COPY --from=build /repo/apps/dashboard/dist ./
COPY apps/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
