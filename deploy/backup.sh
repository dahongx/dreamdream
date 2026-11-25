#!/usr/bin/env bash
# 寄情 / Dearm —— Supabase 自托管数据备份。
#
# self-host 下备份是生命线: VPS 挂了没有第三方托管兜底。本脚本备份两样东西:
#   1. Postgres 全库（含 auth schema —— 漏了就丢全部用户！）
#   2. storage 卷（上传的头像 / 封面图）
#
# 用法（手动）:  bash deploy/backup.sh
# 定时（推荐每日凌晨）:  crontab -e 加一行:
#   7 4 * * *  cd /path/to/repo && bash deploy/backup.sh >> /var/log/dearm-backup.log 2>&1
#
# 异地: 强烈建议再加一步把 $BACKUP_DIR 同步到对象存储 / 另一台机器
#       （rclone / rsync），否则 VPS 整机损毁仍会丢数据。
set -euo pipefail
cd "$(dirname "$0")/.."

BACKUP_DIR="${DEARM_BACKUP_DIR:-./backups}"
RETAIN_DAYS="${DEARM_BACKUP_RETAIN:-7}"
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"

POSTGRES_DB=$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2 || echo postgres)

echo "==> [$(date)] 备份开始"

# 1. Postgres 全库 dump（custom format，含所有 schema）。
#    -Fc = 压缩自定义格式，restore 用 pg_restore。
echo "    pg_dump (含 auth)..."
docker exec supabase-db pg_dump -U postgres -Fc -d "$POSTGRES_DB" \
  > "$BACKUP_DIR/db-${STAMP}.dump"

# 2. storage 卷打包。
echo "    storage 卷..."
tar -czf "$BACKUP_DIR/storage-${STAMP}.tar.gz" -C deploy/supabase/volumes storage 2>/dev/null \
  || echo "    (storage 卷为空或不存在，跳过)"

# 3. 轮转: 删超过保留期的备份。
echo "    清理 > ${RETAIN_DAYS} 天的旧备份..."
find "$BACKUP_DIR" -name 'db-*.dump'      -mtime +"$RETAIN_DAYS" -delete 2>/dev/null || true
find "$BACKUP_DIR" -name 'storage-*.tar.gz' -mtime +"$RETAIN_DAYS" -delete 2>/dev/null || true

DB_SIZE=$(du -h "$BACKUP_DIR/db-${STAMP}.dump" | cut -f1)
echo "==> [$(date)] 备份完成: db-${STAMP}.dump ($DB_SIZE)"
echo "    恢复命令参考:"
echo "      docker exec -i supabase-db pg_restore -U postgres -d $POSTGRES_DB --clean < $BACKUP_DIR/db-${STAMP}.dump"
