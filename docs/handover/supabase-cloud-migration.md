# Supabase 云端对接 + 上线收尾指南

> 配套文档:技术交接 [supabase-auth.md](./supabase-auth.md) · 产品思考 [../insights/supabase-auth.md](../insights/supabase-auth.md) · 决策对比 [../research/supabase-auth-integration-report.md](../research/supabase-auth-integration-report.md)
> 适用:把当前 `feat/supabase-auth` 分支(已在**本地 Supabase 全栈**验证通过)切到 **Supabase Cloud**,并完成上线前收尾。
> 状态:本地认证 + 上传已实现并测试通过;本文覆盖「云端对接」与「5 项收尾」的具体做法与**为什么留到现在**。

---

## 0. 背景:现在到了哪一步

- 认证已从 Auth.js 换成 Supabase Auth(email + 密码),业务库 = Supabase 库,`auth.users → public.users` 用 trigger 桥接(`users.id = auth.uid()`),9 张业务外键零改动。
- 图片上传已从 Cloudflare R2 改接 Supabase Storage(public bucket `media`)。
- 业务 schema(含桥接迁移 `drizzle/0011_supabase_auth_bridge.sql`)由 **drizzle** 管理(`bun run db:migrate`),**不是** `supabase db push`。`supabase/migrations/` 目前为空。
- env 命名做成了本地/云端通用,切云端基本零改代码。

---

## 1. 云端对接(7 步)

### Step 1 — 建云端项目
[supabase.com](https://supabase.com) → New project。建好后在以下位置取值:
- **Project URL**、**Publishable key**、**Secret key**:Project Settings → API
- **数据库连接串**:Project Settings → Database → Connection string

### Step 2 — 配环境变量
`.env.local`(或部署平台的环境变量):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx   # 云端值
SUPABASE_SECRET_KEY=sb_secret_xxxxx                         # 仅服务端,切勿加 NEXT_PUBLIC_
# 迁移/应用连库 —— 见 Step 3 关于端口的说明
DATABASE_URL=postgresql://postgres.<ref>:<db-password>@aws-0-<region>.pooler.supabase.com:5432/postgres
AUTH_TRUST_HOST=true
```
> `NEXT_PUBLIC_*` 会被打进浏览器包,只能放 publishable/anon key(受 RLS 约束),**绝不能**放 secret/service key。

### Step 3 — 把业务表 + 桥接迁移推到云端
业务 schema 走 drizzle 迁移脚本(读 `.env.local` 的 `DATABASE_URL`):
```bash
bun run db:migrate     # 应用 drizzle/0000–0011 到云端库
```
这会建好全部业务表 + `handle_new_user` trigger + `users_id_auth_users_fk`(`auth.users` 云端自带,无需建)。
- **连接端口**:跑 DDL 迁移用**直连 / session pooler(5432)**更稳;App 运行时可用 transaction pooler(6543)。两种端口下代码里的 `prepare:false` 都已设好。
- 迁移幂等:runner 用 `__nimir_migrations` 表记录,可重复跑。

### Step 4 — 建存储桶
云端 Dashboard → Storage → New bucket → 名字 **`media`**、勾选 **Public**(与 `src/lib/r2/client.ts` 里的 `BUCKET` 常量一致)。
或脚本建:
```ts
import { createClient } from "@supabase/supabase-js";
const s = createClient(URL, SECRET_KEY, { auth: { persistSession: false } });
await s.storage.createBucket("media", {
  public: true, fileSizeLimit: "5MB",
  allowedMimeTypes: ["image/jpeg","image/png","image/webp","image/gif"],
});
```

### Step 5 — 配认证
Dashboard → Authentication:
- **URL Configuration**:Site URL 填生产域名;Redirect URLs 加上 `https://<域名>/auth/callback` 等。
- **邮箱确认 / SMTP**:见 §2.3。要发确认/重置邮件就配 SMTP(或先用 Supabase 内置邮件,有限额)。
- **密码策略**:`minimum_password_length` 等按需(注册表单当前下限 6,与本地一致)。

### Step 6 —(建议)上线前补 RLS
见 §2.1。前端若会直连 Supabase Data API,务必先补;纯后端直连可暂缓但要知道风险。

### Step 7 — 构建部署
```bash
bun run build
# next.config.ts 开了 output: standalone,生产应跑 standalone server:
node .next/standalone/server.js
# 注意:standalone 不含静态资源,需把 .next/static 和 public 拷进 .next/standalone/ 对应目录
```
部署后按 §3 验收清单过一遍。

### Step 8 — 锁定 compose 文件(踩过坑,别省)

云端部署**只能**用 `docker-compose.cloud.yml`。仓库根还有一个 `docker-compose.yml`,那是**自托管**编排,
第 18 行 `include` 了整套本地 supabase(db/kong/auth/rest/storage/imgproxy)。

坑在于:**不带 `-f` 的裸 `docker compose` 会默认加载 `docker-compose.yml`**。
在云端机器上误跑一次 `docker compose up/ps`,就会凭空创建 6 个用不上的容器 ——
它们卡在 `Created` 状态白占资源,还会污染 `docker ps -a` 干扰故障排查。

`deploy/deploy-cloud.sh` 显式传了 `-f` 所以是安全的,但手敲命令时很容易忘。根治办法是在 `.env` 里锁死:

```bash
COMPOSE_FILE=docker-compose.cloud.yml
```

Compose 会从项目根 `.env` 读这个变量,之后裸跑 `docker compose ps/logs/up` 都自动指向正确编排。
`.env.cloud.example` 已内置该行,新部署 `cp` 过去即可;**存量部署需手动补**。

验证:
```bash
docker compose config --services   # 应只输出 migrate 和 app
```

> 2026-08-10 线上实际踩过:4 个 supabase 容器卡在 Created、imgproxy 空跑 11 小时。

---

## 2. 上线收尾 5 项(为什么留到现在 + 怎么做)

> 共同原因:这 5 项都需要**你的凭据 / 产品决策 / 是不可逆的最终清理**,不适合在自动化阶段替你定。下面给每项的「为什么」与「怎么做」。

### 2.1 RLS(行级安全)
**为什么没做**:后端用 `postgres` 超级用户直连,**超级用户绕过 RLS**——当前架构下 RLS 对后端查询毫无作用,只有「前端直连 PostgREST」时才生效。给 ~20 张表(含间接归属表)写对策略量大且易错,盲做可能误锁数据。
**怎么做**:
- 直接归属表(`characters.owner_id`、`chat_sessions.user_id`、`user_masks`、`user_regex_preferences`、`beautification_packs.owner_user_id`、`studio_sessions`、`character_comments.author_id`、`character_comment_likes` 等):
  ```sql
  alter table public.characters enable row level security;
  create policy "owner_select" on public.characters for select
    to authenticated using ((select auth.uid()) = owner_id);
  -- update 需同时写 USING + WITH CHECK;insert/delete 各自补
  ```
- **间接归属表**(`messages`、`character_pack_subscriptions`、`regex_rules`、`subscription_rule_overrides`、`opening_components`、`pack_assistant_messages` 等)必须用 `EXISTS` 上溯到拥有者,**不能漏**:
  ```sql
  create policy "owner_select_messages" on public.messages for select
    to authenticated using (exists (
      select 1 from public.chat_sessions s
      where s.id = messages.session_id and s.user_id = (select auth.uid())
    ));
  ```
- 写成一个新的 drizzle 迁移 `drizzle/0012_rls.sql`,`bun run db:migrate` 应用。
- 安全要点:授权字段放 `app_metadata`(不可信 `user_metadata`);`TO authenticated` 必须配所有权谓词,否则是 IDOR。

### 2.2 生产数据迁移
**为什么没做**:真实数据在外部 nimir 库(`192.168.1.20`),目前**基本为空**(无角色卡);且涉及碰真实数据 + 密码导入的半不可逆操作,不能无人值守时自动做。
**怎么做**(若 nimir 有数据要迁):
1. 只导 `public` schema,不要整库(避免和 Supabase 自带 schema 冲突):
   ```bash
   pg_dump "postgres://postgres:***@192.168.1.20:5433/nimir" \
     --schema=public --no-owner --no-privileges -Fc -f nimir_public.dump
   ```
2. 先在影子项目 restore 演练;扩展(如 `pgcrypto`)按 Supabase 预装核对。
3. **密码迁移(关键风险)**:GoTrue 不提供「导入任意 bcrypt 哈希即可无感登录」的官方 API。三选一:
   - (a) 迁移脚本**直写** `auth.users.encrypted_password`(bcryptjs 是 `$2*$`,格式兼容,但**非官方路径、需先 PoC** 验证 cost=10 能登录);
   - (b) **强制全员重置密码**(最稳);
   - (c) **首登拦截**:首次登录用应用侧 `bcryptjs.compare` 校验旧哈希,通过后 `auth.admin.updateUserById` 写入 Supabase 托管密码(渐进无感)。
4. **id 保值**:要让旧 `users.id` 不变(外键无需重映射),迁移脚本必须**直写 `auth.users.id`**;否则建「旧 id→新 auth.uid」映射表批量改写外键。

### 2.3 邮箱确认 + SMTP
**为什么没做**:需要你的真实 SMTP 凭据(我没有),且「是否强制验证邮箱 / 要不要 magic-link」是产品决策。本地 `enable_confirmations=false` 让测试无摩擦。
**怎么做**:Dashboard → Authentication → Email:开启 confirmations,配 SMTP(host/port/user/pass/sender)。本地可用 Mailpit(`http://127.0.0.1:54324`)截获邮件做测试。

### 2.4 i18n 文案
**为什么没做**:不阻塞功能(登录/注册的邮箱字段我用了字面量「邮箱 / Email」)。但整套描述涉及品牌措辞,不想替你拍板。
**怎么做**:同步 `src/i18n/zh.ts` 与 `src/i18n/en.ts` 的 `auth` 段:
- 把登录页「Enter your username and password…」、注册页「Email is optional…」等改为 email 口径;
- 给邮箱字段加正式 i18n key(替换 `SignInForm.tsx` / `SignUpForm.tsx` 里临时的字面量「邮箱 / Email」)。

### 2.5 清理 Auth.js 残留
**为什么没做**:**故意放最后、且必须等你验收**。删了就失去「`git checkout master` 一键回滚」的安全网。
**怎么做**(确认迁移验收通过后):
- 删文件:`src/lib/auth/{config,index,password}.ts`、`src/app/api/auth/[...nextauth]/route.ts`、`src/lib/auth/dev-allowlist.ts`(如不再用)。
- 删依赖:`next-auth`、`@auth/drizzle-adapter`、`bcryptjs`、`@types/bcryptjs`(`bun remove ...`)。
- 删表(写新 drizzle 迁移):`accounts`、`auth_sessions`、`verification_tokens`(Auth.js 遗留,本就未用)。**前置确认** nimir/云端库无外部系统依赖这三表。
- 清环境变量:`AUTH_SECRET`、`AUTH_TRUST_HOST`(如不再需要)。
- 顺带修**已知问题**:官方 pack seed 插入系统用户(id `00000000-…-0001`)违反 `users_id_auth_users_fk` 的 WARN —— 给系统用户在 `auth.users` 预置一行,或让该 seed 走 auth 之外。

---

## 3. 回滚

- 代码:整个改动在 `feat/supabase-auth` 分支,`git checkout master` 即回到 Auth.js 形态(**清理 Auth.js 之前都成立**)。
- 数据库指向:`.env.local` 把 `DATABASE_URL` 改回外部 nimir 库即可。

---

## 4. 验收清单(切云端后逐项过)

- [ ] `bun run db:migrate` 成功,云端有全部业务表 + `users_id_auth_users_fk` + `on_auth_user_created` trigger
- [ ] 注册新用户 → `public.users` 自动出镜像行(id = auth.uid)
- [ ] 登录 / 登出 / 重登正常;未登录访问受保护路由跳 `/signin`
- [ ] 建角色卡 → `owner_id == auth.uid`,出现在 `/mine`
- [ ] 设置页上传头像 → 存到 `media` bucket,`avatar_url` 落库,公开 URL 可访问
- [ ]（若开)邮箱确认邮件能收到(SMTP 通)
- [ ]（若开 RLS)前端直连越权被拦,本人数据可读写
