#!/usr/bin/env bash
# 寄情 / Dearm —— Supabase Cloud 一键部署。
#
# 前提: Supabase 已经是「云端托管项目」（非自托管全栈）。本脚本只在服务器上
# 拉起 app 容器 + 跑 drizzle 迁移，认证 / 存储 / 数据库都在 *.supabase.co。
# 自托管全栈请改用 deploy/deploy.sh。
#
# 在服务器上 git clone 仓库后运行:
#   bash deploy/deploy-cloud.sh
#
# 幂等: 重复运行只重建 + 重启,迁移 runner 自带 __nimir_migrations 去重。
# 前置: 已装 Docker + Docker Compose plugin。
set -euo pipefail
cd "$(dirname "$0")/.."   # 仓库根

COMPOSE_FILE="docker-compose.cloud.yml"
ENV_EXAMPLE=".env.cloud.example"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${GREEN}==>${NC} $*"; }
warn() { echo -e "${YELLOW}!! ${NC} $*"; }
die()  { echo -e "${RED}xx ${NC} $*"; exit 1; }

DC=(docker compose -f "$COMPOSE_FILE")

# --- 0. 前置检查 ------------------------------------------------------------
command -v docker >/dev/null || die "未找到 docker"
docker compose version >/dev/null 2>&1 || die "未找到 docker compose plugin"
[ -f "$COMPOSE_FILE" ] || die "缺 $COMPOSE_FILE（请在仓库根运行）"

# --- 1. 生成 .env（首次）---------------------------------------------------
if [ ! -f .env ]; then
  info "首次部署: 从 $ENV_EXAMPLE 生成 .env 模板"
  [ -f "$ENV_EXAMPLE" ] || die "缺 $ENV_EXAMPLE"
  cp "$ENV_EXAMPLE" .env
  warn ".env 已生成。请填好以下值后重跑本脚本:"
  echo "   1. DATABASE_URL              —— Supabase Dashboard → Database 连接串（pooler 5432）"
  echo "   2. NEXT_PUBLIC_SUPABASE_URL  —— https://<project-ref>.supabase.co"
  echo "   3. NEXT_PUBLIC_SUPABASE_ANON_KEY（sb_publishable_…）+ SUPABASE_SECRET_KEY（sb_secret_…）"
  echo "   4. 至少一个 LLM key（默认 NIMIR_DEEPSEEK_API_KEY）"
  echo "   5. NEXT_PUBLIC_APP_URL / SITE_URL 换成生产域名"
  echo ""
  echo "   编辑: \$EDITOR .env   然后再次: bash deploy/deploy-cloud.sh"
  exit 0
fi

# --- 2. .env 校验 -----------------------------------------------------------
info "校验 .env"
val() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | tr -d '"'"'"' ' || true; }

grep -qE '^DATABASE_URL=postgres' .env \
  || die "DATABASE_URL 缺失或格式不对（应以 postgres:// 开头）"
grep -qE '^NEXT_PUBLIC_SUPABASE_URL=https://[^ ]*supabase' .env \
  || die "NEXT_PUBLIC_SUPABASE_URL 缺失（应形如 https://<ref>.supabase.co）"
[ -n "$(val NEXT_PUBLIC_SUPABASE_ANON_KEY)" ] || [ -n "$(val NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)" ] \
  || die "缺 NEXT_PUBLIC_SUPABASE_ANON_KEY（或 _PUBLISHABLE_KEY）"
[ -n "$(val SUPABASE_SECRET_KEY)" ] || [ -n "$(val SERVICE_ROLE_KEY)" ] \
  || die "缺 SUPABASE_SECRET_KEY（图片上传要用；绝不能加 NEXT_PUBLIC_ 前缀）"

# 占位符没换会静默连错库 —— 挡一下。
grep -qE '<project-ref>|<db-password>|<region>|sb_publishable_xxxx|sb_secret_xxxx' .env \
  && die ".env 里仍有 <…> / xxxx 占位符没替换成真实值"

# LLM key: 一个都没有只 warn（可先起服务看 UI，聊天暂不可用）。
if ! grep -qE '^(NIMIR_DEEPSEEK_API_KEY|NIMIR_ANTHROPIC_API_KEY|NIMIR_OPENAI_API_KEY|OPENAI_API_KEY|NIMIR_GOOGLE_API_KEY|GOOGLE_GENERATIVE_AI_API_KEY)=.+' .env; then
  warn "未检测到任何 LLM key —— 服务能起，但聊天/AI 生成不可用。之后补进 .env 再 up 即可。"
fi
grep -qE '^STRIPE_SECRET_KEY=.+' .env || warn "未配 Stripe —— 支付不可用（浏览/聊天不受影响）。"

# --- 3. 构建 ----------------------------------------------------------------
# 一次只 build 一个 service —— 不是洁癖，是绕开一个会把整台机器搞挂的上游 bug。
#
# migrate 和 app 共享 deps 阶段。让 compose 一把 build 两个，BuildKit 会并行
# solve 这两个目标，触发「concurrent map iteration and map write」竞争，dockerd
# 直接 panic 退出 —— 不只是构建失败，是**所有正在跑的容器一起被带走**，线上服务
# 当场下线（2026-08-09 部署实测，journalctl -u docker 可见 fatal error）。
#
# 原先靠 COMPOSE_BAKE=false 关掉 bake 来串行化。该逃生阀在 Compose v5 上已失效:
# bake 成了默认且唯一的构建路径，这个 env 不再被读取，于是保护静默消失。改成拆成
# 两次独立调用 —— 单目标构建没有跨目标并行 solve，从源头上不具备触发条件，且不
# 依赖任何可能再次被上游移除的开关。
#
# 代价: 两次调用之间 deps 层走缓存，比并行慢一点。相对于「构建把生产打挂」可忽略。
info "构建镜像（串行，Next build 视机器约 3-10 分钟）"
for svc in migrate app; do
  info "  build $svc"
  "${DC[@]}" build "$svc"
done

# --- 4. 迁移 + 启动 ---------------------------------------------------------
# up 会先把 migrate 跑到 exit0（应用 drizzle/*.sql 到云端库），再拉起 app。
info "应用数据库迁移 + 启动 app"
"${DC[@]}" up -d

# migrate 一次性 service：确认它成功退出，别让 app 带着半套 schema 起来。
MIGRATE_CID=$("${DC[@]}" ps -aq migrate 2>/dev/null | head -1 || true)
if [ -n "$MIGRATE_CID" ]; then
  MIGRATE_RC=$(docker inspect -f '{{.State.ExitCode}}' "$MIGRATE_CID" 2>/dev/null || echo "?")
  if [ "$MIGRATE_RC" != "0" ]; then
    warn "migrate 退出码 = $MIGRATE_RC，迁移可能失败。日志:"
    "${DC[@]}" logs migrate | tail -30
    die "迁移未成功 —— 修好 DATABASE_URL / 云端库权限后重跑。"
  fi
  info "迁移完成（migrate exit 0）"
fi

# --- 5. 等待 app 起来 -------------------------------------------------------
APP_PORT=$(val APP_PORT); APP_PORT=${APP_PORT:-3000}
info "等待 app 就绪（最多 ~90s）"
OK=""
for i in $(seq 1 18); do
  sleep 5
  if curl -fsS -o /dev/null "http://127.0.0.1:${APP_PORT}/signin" 2>/dev/null; then
    OK=1; break
  fi
  echo "   ...等待中（$((i*5))s）"
done

# --- 6. 冒烟 ----------------------------------------------------------------
if [ -n "$OK" ]; then
  info "冒烟通过：http://127.0.0.1:${APP_PORT}/signin 有响应"
else
  warn "app 还没响应 /signin，看日志排查:"
  "${DC[@]}" logs app | tail -30
fi

echo ""
info "完成。本机 http://127.0.0.1:${APP_PORT} ，对外经反代到该端口。"
echo "   查看日志:   ${DC[*]} logs -f app"
echo "   验收清单:   docs/handover/supabase-cloud-migration.md §4"
echo "   别忘了云端 Dashboard 侧: Storage 建 public bucket 'media'、Auth 配 Site URL + Redirect URLs。"
