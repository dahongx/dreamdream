#!/usr/bin/env bash
# 寄情 / Dearm —— 自托管 Supabase 一键部署（裸 IP 起步）。
#
# 在 VPS 上 git clone 仓库后运行本脚本。幂等: 重复运行只做缺失的步骤。
#
#   bash deploy/deploy.sh
#
# 前置: VPS 已装 Docker + Docker Compose plugin。4c4g 建议先跑 deploy/setup-swap.sh。
set -euo pipefail
cd "$(dirname "$0")/.."   # 仓库根

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${GREEN}==>${NC} $*"; }
warn() { echo -e "${YELLOW}!! ${NC} $*"; }
die()  { echo -e "${RED}xx ${NC} $*"; exit 1; }

# --- 0. 前置检查 ------------------------------------------------------------
command -v docker >/dev/null || die "未找到 docker"
docker compose version >/dev/null 2>&1 || die "未找到 docker compose plugin"

# swap 提醒（4c4g 跑全栈 + Next build 易 OOM）。
SWAP_KB=$(awk '/SwapTotal/{print $2}' /proc/meminfo 2>/dev/null || echo 0)
if [ "${SWAP_KB:-0}" -lt 1048576 ]; then
  warn "检测到 swap < 1G。4c4g 建议先跑: bash deploy/setup-swap.sh （2G swap）"
fi

# --- 1. 生成 .env（首次）---------------------------------------------------
if [ ! -f .env ]; then
  info "首次部署: 生成 .env"
  cp deploy/supabase/.env.supabase.example .env
  echo "" >> .env
  bash deploy/supabase/gen-keys.sh >> .env

  # 补应用侧变量骨架（用户需手填 IP / LLM key）。
  cat >> .env <<'EOF'

# ===== 应用侧（请手动补齐）=====
APP_PORT=3000
# 业务库直连 db 容器；<POSTGRES_PASSWORD> 用上面生成的同名值替换。
# DATABASE_URL=postgres://postgres:<POSTGRES_PASSWORD>@db:5432/postgres
# NEXT_PUBLIC_SUPABASE_URL=http://<VPS_IP>:8000
# LLM provider keys（按需）:
# NIMIR_DEEPSEEK_API_KEY=
# NIMIR_DEEPSEEK_BASE_URL=
EOF

  warn ".env 已生成。现在必须手动完成 3 件事，然后重跑本脚本:"
  echo "   1. 把所有 <VPS_IP> 替换成服务器公网 IP（API_EXTERNAL_URL / SUPABASE_PUBLIC_URL / SITE_URL / NEXT_PUBLIC_SUPABASE_URL）"
  echo "   2. 取消注释并填 DATABASE_URL（密码 = .env 里的 POSTGRES_PASSWORD）"
  echo "   3. 填 NEXT_PUBLIC_SUPABASE_URL + 需要的 LLM key"
  echo ""
  echo "   编辑: \$EDITOR .env   然后再次: bash deploy/deploy.sh"
  exit 0
fi

# --- 2. .env 完整性校验 -----------------------------------------------------
info "校验 .env"
grep -q '<VPS_IP>' .env && die ".env 里仍有 <VPS_IP> 占位符，请替换成真实 IP"
grep -qE '^DATABASE_URL=postgres' .env || die ".env 缺 DATABASE_URL（取消注释并填密码）"
grep -qE '^NEXT_PUBLIC_SUPABASE_URL=http' .env || die ".env 缺 NEXT_PUBLIC_SUPABASE_URL"
grep -qE '^JWT_SECRET=.{32,}' .env || die ".env 缺 JWT_SECRET（应由 gen-keys.sh 生成）"

# --- 3. 构建 + 启动 ---------------------------------------------------------
info "构建镜像（4c4g 上 Next build 约 5-10 分钟，请耐心）"
# COMPOSE_BAKE=false: 串行构建，绕开 Docker 29 / BuildKit v0.31.1 并行 solve
# 共享 deps 阶段触发的「concurrent map iteration and map write」致命竞争
# （会崩 dockerd，客户端报 rpc Unavailable ... EOF）。上游修复后可移除。
COMPOSE_BAKE=false docker compose build

info "启动全栈"
docker compose up -d

# --- 4. 等待健康 ------------------------------------------------------------
info "等待容器健康（最多 ~3 分钟）"
for i in $(seq 1 36); do
  sleep 5
  UNHEALTHY=$(docker compose ps --format '{{.Name}} {{.Health}}' 2>/dev/null \
    | grep -vE 'healthy|^$' | grep -iE 'starting|unhealthy' || true)
  RUNNING=$(docker compose ps --format '{{.Name}} {{.State}}' 2>/dev/null | grep -c running || true)
  if [ -z "$UNHEALTHY" ] && [ "${RUNNING:-0}" -ge 7 ]; then
    info "全部容器就绪"
    break
  fi
  echo "   ...等待中（$((i*5))s）"
done

# --- 5. 冒烟 ----------------------------------------------------------------
KONG_PORT=$(grep -E '^KONG_HTTP_PORT=' .env | cut -d= -f2 || echo 8000)
APP_PORT=$(grep -E '^APP_PORT=' .env | cut -d= -f2 || echo 3000)
info "冒烟测试"
echo -n "   gotrue health: "; curl -fsS "http://127.0.0.1:${KONG_PORT}/auth/v1/health" >/dev/null && echo OK || warn "失败"
echo -n "   data api 应封禁: "; code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${KONG_PORT}/rest/v1/"); [ "$code" = "404" ] && echo "OK (404)" || warn "意外 $code（Data API 可能未封）"
echo -n "   app: "; curl -fsS -o /dev/null "http://127.0.0.1:${APP_PORT}/signin" && echo OK || warn "失败（可能仍在启动）"

info "完成。访问 http://<VPS_IP>:${APP_PORT}"
echo "   下一步: 跑一遍验收清单 docs/handover/self-host-supabase.md §验收"
echo "   建议: 配置定时备份 → crontab 加 'bash $(pwd)/deploy/backup.sh'"
