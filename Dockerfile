# syntax=docker/dockerfile:1.7
# Multi-stage Dockerfile for Dearm production image.
#   deps     → install node_modules from bun.lock (cacheable layer)
#   builder  → next build, produces .next/standalone
#   migrate  → minimal image used by the `migrate` compose service to apply
#              drizzle/*.sql before app starts (see scripts/db-migrate.ts)
#   runner   → final image: just the standalone server + static + public.
#              ~200MB on alpine vs ~1GB if we shipped full node_modules.

ARG BUN_VERSION=1.3-alpine

FROM oven/bun:${BUN_VERSION} AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY patches/ ./patches/
RUN bun install --frozen-lockfile

FROM oven/bun:${BUN_VERSION} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* 必须在 build 阶段就位 —— Next 把它们内联进 client bundle。
# 由 docker-compose.yml 的 app.build.args 注入；改 IP/域名后须重新 build。
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM oven/bun:${BUN_VERSION} AS migrate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY drizzle ./drizzle
COPY scripts ./scripts
# src/lib/ai/{pricing,models}.ts: backfill-message-cost.ts 复用价表 + 模型
# 白名单。src/lib/db: recharge-by-role.ts 等 scripts 直连库做 update 时
# 需要 client + schema。其它 scripts/*.ts 当前都是自包含的；将来若有更多
# 脚本要 import src/，按需扩大这个 COPY 范围（或直接 `COPY src ./src` 偷懒）。
COPY src/lib/ai ./src/lib/ai
COPY src/lib/db ./src/lib/db
# src/lib/creator: run-daily-rebate.ts（每日 8 点返利结算 + --seed）import
# creator/{rebate,compute} → 需要 client + schema（已随 src/lib/db 带上）。
# 这个 migrate 镜像同时充当「跑迁移」和「跑返利 cron」的运行环境：有完整
# scripts + node_modules + 容器内可达 db:5432。见 docs/handover/creator-rebate.md。
COPY src/lib/creator ./src/lib/creator
COPY package.json ./package.json
COPY tsconfig.json ./tsconfig.json
# scripts/db-migrate.ts reads .env.local via dotenv when present; in
# compose the env is injected via env_file, so .env.local is absent.
# dotenv handles the missing-file case silently.
CMD ["bun", "scripts/db-migrate.ts"]

FROM oven/bun:${BUN_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache su-exec tzdata
RUN addgroup --system --gid 1001 nimir && \
    adduser --system --uid 1001 --ingroup nimir nimir

COPY --from=builder --chown=nimir:nimir /app/.next/standalone ./
COPY --from=builder --chown=nimir:nimir /app/.next/static ./.next/static
COPY --from=builder --chown=nimir:nimir /app/public ./public

# 复制 scripts 目录和依赖，用于手动充值等管理脚本
COPY --from=builder --chown=nimir:nimir /app/scripts ./scripts
COPY --from=builder --chown=nimir:nimir /app/src/lib ./src/lib
COPY --from=builder --chown=nimir:nimir /app/package.json ./package.json
COPY --from=builder --chown=nimir:nimir /app/tsconfig.json ./tsconfig.json
# 复制完整的 node_modules（scripts 需要 drizzle-orm 等依赖）
COPY --from=deps --chown=nimir:nimir /app/node_modules ./node_modules

COPY docker/entrypoint.sh /usr/local/bin/dearm-entrypoint
RUN chmod +x /usr/local/bin/dearm-entrypoint

EXPOSE 3000
ENTRYPOINT ["dearm-entrypoint"]
CMD ["bun", "server.js"]
