#!/usr/bin/env bash
# 寄情 / Dearm —— 给 4c4g VPS 配 swap。
#
# 为什么: Supabase 全栈（即使裁剪过）+ Next standalone + `next build` 峰值，
# 在 4G 物理内存上偶发 OOM（尤其 build 阶段）。2G swap 兜住峰值，避免容器被
# OOM-killer 杀掉。生产稳态用不到 swap，只在峰值借用。
#
# 用法（需 root / sudo）:  sudo bash deploy/setup-swap.sh
set -euo pipefail

SWAP_SIZE="${SWAP_SIZE:-2G}"
SWAP_FILE="${SWAP_FILE:-/swapfile}"

[ "$(id -u)" -eq 0 ] || { echo "需要 root: sudo bash $0"; exit 1; }

if swapon --show | grep -q "$SWAP_FILE"; then
  echo "==> $SWAP_FILE 已启用，跳过"
  swapon --show
  exit 0
fi

echo "==> 创建 $SWAP_SIZE swap at $SWAP_FILE"
fallocate -l "$SWAP_SIZE" "$SWAP_FILE" || dd if=/dev/zero of="$SWAP_FILE" bs=1M count=2048
chmod 600 "$SWAP_FILE"
mkswap "$SWAP_FILE"
swapon "$SWAP_FILE"

# 开机自动挂载。
if ! grep -q "$SWAP_FILE" /etc/fstab; then
  echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
  echo "==> 已写入 /etc/fstab（开机自动挂载）"
fi

# 降低 swappiness: 优先用物理内存，仅峰值借 swap。
sysctl vm.swappiness=10
grep -q 'vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf

echo "==> 完成"
swapon --show
free -h
