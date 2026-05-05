FROM node:20-bookworm AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
WORKDIR /app
COPY .npmrc .npmrc
COPY . .

ENV CI=true

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @backend-monitoring/backend exec prisma generate --schema prisma/schema.prisma

RUN pnpm exec tsc -p apps/Backend/tsconfig.json

RUN pnpm install --frozen-lockfile --prod

RUN pnpm --filter @backend-monitoring/backend exec prisma generate --schema prisma/schema.prisma

FROM base AS production
WORKDIR /app

ENV NODE_ENV=production


COPY --from=build /app/apps/Backend/dist ./apps/Backend/dist
COPY --from=build /app/apps/Backend/package.json ./apps/Backend/
COPY --from=build /app/apps/Backend/prisma ./apps/Backend/prisma
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-lock.yaml ./
COPY --from=build /app/pnpm-workspace.yaml ./

EXPOSE 4000
CMD ["node", "apps/Backend/dist/index.js"]