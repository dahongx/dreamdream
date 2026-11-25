#!/bin/bash
# 寄情 / Dearm 日常更新脚本
# 在服务器上执行: bash restart.sh
#
# 与 deploy.sh 的区别:
#   - 只重建 app, 不动 supabase 后端栈 (db/kong/auth/...)
#   - 依赖 Docker 层缓存, 通常 2-3 分钟即可完成
#   - 适合日常 git pull + 重启的场景
# 完整重新部署 (全栈停启) 用 deploy.sh.

set -e

PROJECT_DIR="$HOME/projects/yearn-chat"
COMPOSE_FILE="docker-compose.yml"
APP_URL="http://localhost:8091/"
APP_CONTAINER="yearn-chat-app-1"

echo "🚀 开始更新 Yearn Chat (仅 app)..."

# 1. 进入项目目录
cd "$PROJECT_DIR"
echo "✓ 当前目录: $(pwd)"

# 2. 记录拉取前的 commit
BEFORE_SHA=$(git rev-parse --short HEAD)
echo "📍 当前 commit: $BEFORE_SHA"

# 3. 拉取最新代码
echo "📥 拉取最新代码..."
git fetch origin
git pull origin main

AFTER_SHA=$(git rev-parse --short HEAD)

# 4. 显示变更影响范围
if [ "$BEFORE_SHA" = "$AFTER_SHA" ]; then
    echo "ℹ️  没有新 commit (HEAD 仍在 $AFTER_SHA), 仍会重建以确保镜像最新."
else
    echo "📝 代码已更新: $BEFORE_SHA → $AFTER_SHA"
    echo "   变更文件:"
    git diff --name-only "$BEFORE_SHA..$AFTER_SHA" | sed 's/^/     /'
fi

# 5. 检查 .env 存在
if [ ! -f .env ]; then
    echo "❌ .env 文件不存在, 终止. 请先用 deploy.sh 做完整部署."
    exit 1
fi

# 6. 重建并启动 app (其他容器原地不动, 不调用 down)
echo "🔨 重建 app (依赖层缓存, 通常 2-3 分钟)..."
docker compose -f "$COMPOSE_FILE" up -d --build app

# 7. HTTP 健康检查 (最多重试 5 次 / 共 ~15s)
echo "🩺 健康检查 $APP_URL ..."
HEALTHY=0
for i in 1 2 3 4 5; do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" -L --max-time 5 "$APP_URL" || echo "000")
    if [ "$CODE" = "200" ] || [ "$CODE" = "307" ]; then
        echo "✅ HTTP $CODE — 服务已恢复"
        HEALTHY=1
        break
    fi
    echo "   尝试 $i/5: HTTP $CODE, 等待 3 秒..."
    sleep 3
done

if [ "$HEALTHY" != "1" ]; then
    echo "⚠️  健康检查未通过, 最近日志:"
    docker logs --tail 30 "$APP_CONTAINER"
    exit 1
fi

# 8. 末尾日志 + 提示
echo ""
echo "📋 最近 10 行日志:"
docker logs --tail 10 "$APP_CONTAINER"

echo ""
echo "✅ 更新完成 (commit $AFTER_SHA)"
echo "💡 实时日志: docker logs -f $APP_CONTAINER"
echo "💡 仅重启不重建: docker compose restart app"
echo "💡 完整全栈重部署: bash deploy.sh"
