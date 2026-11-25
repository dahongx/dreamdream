# 技术交接：自托管 Supabase 部署（裸 IP 起步）

> 配套：认证迁移 [supabase-auth.md](./supabase-auth.md) · 云端方案对比 [supabase-cloud-migration.md](./supabase-cloud-migration.md)
> 产品思考：[../insights/self-host-supabase.md](../insights/self-host-supabase.md)
> 分支：`feat/self-host-supabase`。状态：本机 Docker 全栈预验证通过；交 4c4g VPS 裸 IP 部署。

## 一句话

把官方 self-host Supabase **裁剪成 6 容器**（db/kong/auth/rest/storage/imgproxy）vendoring 进
`deploy/supabase/`，与现有 app/migrate compose 整合成单机一套 `docker compose up`。砍掉
realtime/functions/supavisor/meta/studio，并**从 kong 网关删掉 `/rest/v1` 路由** —— 公网只剩
`/auth/v1` 和 `/storage/v1`，PostgREST Data API 不对外，从根上消除「publishable key 公开 → 越权
拖库」风险（这是裸 IP 阶段可不开 RLS 的原因）。

## 为什么自托管（不上 Supabase Cloud）

数据主权：寄情是零审核平台 + creator prompt 资产敏感，数据全留自己 VPS，不过第三方、不受 Cloud
ToS 约束。代价是运维自理（备份 / 升级 / 监控）。

## 改了 / 新增哪些文件

**基础设施（`deploy/`）**
- `deploy/supabase/docker-compose.supabase.yml` — 裁剪版 6 容器栈，`include` 进根 compose。
  db 无对外端口（仅内网）；4c4g 调小 `shared_buffers=256MB`。
- `deploy/supabase/volumes/api/kong.yml` — 裁剪版网关，只留 auth + storage 路由。
- `deploy/supabase/volumes/api/kong-entrypoint.sh`、`volumes/db/{roles,jwt,webhooks}.sql` —
  官方原样 vendoring（建 PG 专用角色 / webhooks 触发器）。
- `deploy/supabase/gen-keys.sh` — 一键生成全栈密钥。**ANON_KEY/SERVICE_ROLE_KEY 用同一
  JWT_SECRET 签 HS256**，与 gotrue/postgrest/storage/kong 对齐（错一个全栈鉴权挂）。
- `deploy/supabase/docker-compose.studio.yml` — 可选 Studio 后台 override（只绑 127.0.0.1）。
- `deploy/supabase/.env.supabase.example` — Supabase 栈变量模板。
- `deploy/deploy.sh` — 幂等部署脚本（生成 .env → 校验 → build → up → 冒烟）。
- `deploy/backup.sh` — pg_dump（含 auth schema）+ storage 卷 + 7 日轮转。**self-host 备份是生命线**。
- `deploy/setup-swap.sh` — 4c4g 配 2G swap，兜 build 峰值 OOM。

**编排 / 应用接线**
- `docker-compose.yml` — 重写：`include` supabase 栈；**migrate 等 `auth` 健康**（启动顺序陷阱，
  见下）；app 直连 db 容器；NEXT_PUBLIC build arg 注入。
- `Dockerfile` — builder 阶段加 `ARG NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`（Next 在 build 时内联）。
- `.env.docker.example` — 加 Supabase 应用侧变量段；R2 段标注已被 Storage 取代。

**代码收尾**
- `drizzle/0012_official_system_user.sql` — 在 auth.users 预置系统用户（id …0001），消除 pack
  seed 违反 `users_id_auth_users_fk` 的启动 WARN。
- `src/i18n/{zh,en,types}.ts` + `SignInForm/SignUpForm.tsx` — auth 文案 username→email 口径，
  新增 `emailLabel/emailPlaceholder` 替换临时字面量；密码下限 8→6。
- `drizzle/optional/0013_rls.sql.disabled` — RLS 备用迁移，**默认不启用**（裸 IP 阶段 Data API
  已封）。开前端直连前必须补「公开读边界」（见文件头 TODO）。

## 两个最易翻车的坑

1. **启动顺序**：`drizzle/0011` 有 `ALTER TABLE users … REFERENCES auth.users`，而 `auth.users`
   由 gotrue 容器首启时建。故 compose 里 **migrate `depends_on: auth (service_healthy)`** —— 直接
   等 db 会偶发「relation auth.users does not exist」。
2. **NEXT_PUBLIC 是 build-time**：`NEXT_PUBLIC_SUPABASE_URL` 在 `next build` 内联进前端包。换
   IP/域名后**必须重新 `docker compose build`**，仅重启无效。

## 部署步骤（VPS 裸 IP）

```bash
# 0.（4c4g 建议）配 swap
sudo bash deploy/setup-swap.sh

# 1. 首次：生成 .env 骨架（含密钥）
bash deploy/deploy.sh            # 首次会生成 .env 后退出，提示手填

# 2. 编辑 .env：<VPS_IP> 全替换；填 DATABASE_URL / NEXT_PUBLIC_SUPABASE_URL / LLM key
$EDITOR .env

# 3. 再次运行：build + up + 冒烟
bash deploy/deploy.sh

# 4. 配定时备份
crontab -e   # 加: 7 4 * * * cd /path/to/repo && bash deploy/backup.sh >> /var/log/dearm-backup.log 2>&1
```

可选看数据库：
```bash
docker compose -f docker-compose.yml -f deploy/supabase/docker-compose.studio.yml up -d meta studio
ssh -L 3001:127.0.0.1:3001 user@VPS_IP   # 本地浏览器开 http://127.0.0.1:3001
```

## 验收清单（裸 IP，逐项过）

- [ ] `docker compose ps` → db/auth/rest/storage/imgproxy/kong/app 全 healthy，migrate Exit 0
- [ ] `curl http://<IP>:8000/auth/v1/health` → 200
- [ ] `curl -o /dev/null -w '%{http_code}' http://<IP>:8000/rest/v1/` → **404**（Data API 已封）
- [ ] 浏览器 `http://<IP>:3000`：未登录跳 `/signin`
- [ ] 注册 → `public.users` 自动出镜像行（`docker exec supabase-db psql -U postgres -c "select id,username from public.users"`，id = auth.uid）
- [ ] 顶栏显示用户名；登出 → `/signin`；email 重登正常
- [ ] 建角色卡 → `owner_id == auth.uid`，出现在 `/mine`
- [ ] 设置页上传头像 → 落 `media` bucket，`avatar_url` 公开 URL 可访问
- [ ] 启动日志**无** pack seed 外键 WARN

## 回滚

- 代码：`git checkout main`（Auth.js 残留仍在，未清理）。
- 数据：先 `bash deploy/backup.sh`，再 `docker compose down`（**不加 `-v`**，否则删库卷）。

## 未完成 / 后续（域名到位后）

见 [supabase-cloud-migration.md](./supabase-cloud-migration.md) 与产品文档 Phase E：开邮箱验证
（autoconfirm→false + SMTP + 补 `/auth/callback` 路由与「查收邮件」页，**当前完全缺失**）、Caddy
反代 + HTTPS、改 URL 为域名（注意重新 build）、决定是否启用 RLS（备用迁移已就位）、清理 Auth.js
残留。
