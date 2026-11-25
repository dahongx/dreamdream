#!/usr/bin/env bash
# 寄情 self-host Supabase —— 一键密钥生成。
#
# 生成全栈所需的全部密钥并打印成可直接粘进 .env 的形式。
#
# 关键不变量: ANON_KEY 与 SERVICE_ROLE_KEY 必须用同一个 JWT_SECRET 签 HS256，
# 且与 gotrue / postgrest / storage / kong 共享的 JWT_SECRET 一致 —— 错一个，
# 全栈鉴权（登录、storage 上传、网关 key-auth）一起挂。本脚本保证它们同源。
#
# 用法:
#   bash deploy/supabase/gen-keys.sh            # 打印到 stdout
#   bash deploy/supabase/gen-keys.sh >> .env    # 追加进 .env（自行去重）
#
# 依赖: openssl（随处可得）+ bun（仓库已用）。JWT 用 bun 内联 HS256 签名，
# 不引第三方库。
set -euo pipefail

cd "$(dirname "$0")/../.."  # 回到仓库根，确保能调用 bun

# --- 随机密钥 ---------------------------------------------------------------
# openssl rand -hex N 产出 2N 个十六进制字符。
POSTGRES_PASSWORD="$(openssl rand -hex 24)"        # 48 字符
JWT_SECRET="$(openssl rand -hex 32)"               # 64 字符（≥32 要求）
SECRET_KEY_BASE="$(openssl rand -hex 32)"
VAULT_ENC_KEY="$(openssl rand -hex 16)"            # 32 字符
DASHBOARD_PASSWORD="$(openssl rand -hex 12)"

# --- 用 JWT_SECRET 签 anon / service_role JWT（HS256）-----------------------
# iat=固定起点，exp=+10 年。payload 格式对齐官方 self-host。
sign_jwt() {
  local role="$1"
  JWT_SECRET="$JWT_SECRET" ROLE="$role" bun -e '
    const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const header = enc({ alg: "HS256", typ: "JWT" });
    const iat = 1700000000;                       // 固定，避免每次变动
    const exp = iat + 60 * 60 * 24 * 365 * 10;    // +10 年
    const payload = enc({ role: process.env.ROLE, iss: "supabase", iat, exp });
    const data = `${header}.${payload}`;
    const sig = require("node:crypto")
      .createHmac("sha256", process.env.JWT_SECRET)
      .update(data)
      .digest("base64url");
    process.stdout.write(`${data}.${sig}`);
  '
}

ANON_KEY="$(sign_jwt anon)"
SERVICE_ROLE_KEY="$(sign_jwt service_role)"

# --- 输出 -------------------------------------------------------------------
cat <<EOF
# ===== 由 deploy/supabase/gen-keys.sh 生成 —— 复制进 .env，切勿提交 =====
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
SECRET_KEY_BASE=${SECRET_KEY_BASE}
VAULT_ENC_KEY=${VAULT_ENC_KEY}
DASHBOARD_USERNAME=supabase
DASHBOARD_PASSWORD=${DASHBOARD_PASSWORD}

# 应用侧（与上面同源）:
#   NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON_KEY（浏览器可见，受网关约束）
#   SUPABASE_SECRET_KEY           = SERVICE_ROLE_KEY（仅服务端，图片上传用，切勿加 NEXT_PUBLIC_）
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SECRET_KEY=${SERVICE_ROLE_KEY}
# ========================================================================
EOF
