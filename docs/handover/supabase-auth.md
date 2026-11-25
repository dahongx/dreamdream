# 技术交接:Supabase Auth 接入(方案①)

> 分支:`feat/supabase-auth`(未推送)。产品思考见 [../insights/supabase-auth.md](../insights/supabase-auth.md)。
> 决策背景与方案对比见 [../research/supabase-auth-integration-report.md](../research/supabase-auth-integration-report.md)。
> **云端对接 + 上线收尾(RLS / 数据迁移 / SMTP / i18n / 清理)步骤见 [supabase-cloud-migration.md](./supabase-cloud-migration.md)。**
> 完成日期:2026-06-07。状态:**本地全栈端到端验证通过**;尚未做生产数据迁移 / RLS / 邮箱确认(见「未完成」)。

## 这次做了什么(一句话)

把认证从 Auth.js v5(用户名+密码 + JWT)换成 **Supabase Auth(email+密码)**,业务库迁到**本地 Supabase Postgres**,并用一条 trigger 把 `auth.users` 桥接到现有 `public.users`,使得**现有 Drizzle 代码与 9 张业务外键零改动**。

## 核心架构决策:auth.users → public.users 桥接

不新建 `profiles` 表,而是让 Supabase 的 `auth.users` 成为身份源,现有业务表 `public.users` 退化成它的 1:1 镜像(**`users.id` = `auth.users.id`**)。

- 注册时 `auth.users` 插入 → trigger `handle_new_user`(`drizzle/0011_supabase_auth_bridge.sql`)→ 自动建 `public.users` 镜像行(id 相同,username/display_name/name/email 从 metadata + email 取)。
- `public.users.id` 加外键 `REFERENCES auth.users(id) ON DELETE CASCADE`。
- 所有 `characters.owner_id` 等 9 张外键**仍指向 `public.users.id`**,无需改 —— 因为该 id 现在就等于登录用户的 `auth.uid()`。

**好处**:改动面最小(业务查询、外键全不动)。**代价**:`users` 表的 `password_hash` / `email_verified` / `accounts` / `auth_sessions` / `verification_tokens` 等 Auth.js 残留字段/表变为冗余(保留未删,见「未完成」)。

## 改了哪些文件

**新增**
- `src/lib/supabase/config.ts` — 读 `NEXT_PUBLIC_SUPABASE_URL` / `_PUBLISHABLE_KEY`(回落 `_ANON_KEY`)。
- `src/lib/supabase/client.ts` — 浏览器 client(`createBrowserClient`)。
- `src/lib/supabase/server.ts` — 服务端 client(`createServerClient` + `cookies()`)。
- `src/lib/supabase/proxy.ts` — `updateSession()`:刷新 session + 未登录跳 `/signin`。
- `drizzle/0011_supabase_auth_bridge.sql` — FK + `handle_new_user` trigger。
- `supabase/config.toml` — `supabase init` 生成的本地全栈配置。

**重写**
- `src/lib/auth/current-user.ts` — `getCurrentUserId()` 改为 `supabase.auth.getUser()` + React `cache()`,签名不变(`Promise<string>`),故 79 处调用方零改动。
- `src/middleware.ts` — 改调 `updateSession()`(原 Auth.js JWT 解码)。
- `src/app/(auth)/signin/action.ts` — `signInWithPassword({ email, password })`。
- `src/lib/auth/actions.ts`(signupAction)— `signUp({ email, password, options.data })`。
- `src/app/(auth)/signin/SignInForm.tsx`、`signup/SignUpForm.tsx` — 登录字段 username→email;注册 email 改必填;密码下限 8→6(Supabase 本地 `minimum_password_length`)。
- `src/lib/settings/actions.ts`(signOutAction)— `supabase.auth.signOut()`。
- `src/components/Shell.tsx` — `auth()` → `getUser()` + 查 `users` 取昵称/头像。

**保留未删(可逆)**:`src/lib/auth/{config,index,password}.ts`、`@/lib/auth` 的 `signIn/signOut/handlers`、`src/app/api/auth/[...nextauth]/route.ts`、`next-auth`/`bcryptjs` 依赖 —— 已无引用,迁移确认后再清。

## 本地怎么跑

```bash
# 1. 起本地 Supabase 全栈(需 Docker;镜像走代理)
supabase start                      # 输出 API URL / Publishable / Secret key

# 2. .env.local 关键变量(已配本地值)
#    DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
#    NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
#    SUPABASE_SECRET_KEY=sb_secret_...           # 仅服务端
#    NIMIR_AUTH_DEV_FALLBACK=0                   # 用真实 Supabase 登录

# 3. 应用迁移(含 0011 桥接)到 Supabase 库
supabase db reset                   # 干净库
bun run db:migrate                  # drizzle 0000–0011

# 4. 起应用
bun run dev                         # http://localhost:3000
```

> ⚠️ WSL2 下 `/mnt/d` 的文件监听(inotify)不可靠,**改完源码需重启 `bun run dev`** 才生效。

## 验证证据(Playwright 端到端,全程 0 console error)

未登录 `/`→`/signin` 拦截 ✅ · 注册 founder ✅ · 顶栏显示 founder ✅ · `/settings` 读到资料 ✅ · 建角色卡归属 founder(DB 核对 `owner_id == users.id == auth.users.id`)✅ · 登出→`/signin` ✅ · email 重登 ✅ · 数据持久 ✅。

## 图片上传:R2 → Supabase Storage

原图片上传走 Cloudflare R2(`R2_*` 全空 → `upload failed`)。已改接 Supabase Storage:

- `src/lib/r2/client.ts` —— 用 `@supabase/supabase-js` 上传到 public bucket **`media`**
  (service key 上传,绕过 storage RLS;public bucket 故 publicUrl 可直接访问)。函数名
  `uploadImageToR2` 保留以免改调用方。bucket 需先建(本地已建;云端 `supabase` dashboard
  或脚本建一个 public `media` bucket)。
- `src/components/upload/CropDialog.tsx` —— **修了一个客户端 bug**:原来 `onCropComplete`
  直接 `session.croppedAreaPixels = ...`(原地 mutate,不走 setState),导致 `confirmCrop`
  读到的 React state 里 croppedAreaPixels 仍为 null → 裁剪确认后不发请求直接报失败。改为
  回调 `onCropComplete(area)`,由调用方 `setCropSession` 更新(`UserAvatarUpload` +
  `CharacterForm` 都已接上)。
- `src/lib/settings/actions.ts` —— 头像 URL 原来强制 `https://`;放宽为「https 或以
  `NEXT_PUBLIC_SUPABASE_URL` 开头」,以接受本地 Supabase Storage 的 http URL(云端是 https,
  仍走 https 分支)。

验证(生产模式 + Playwright):上传 → 裁剪确认 → 保存 → `users.avatar_url` 落库为
`…/storage/v1/object/public/media/…`,对象公开可访问 ✅。

## 已知问题(我引入 / 待处理)

- **官方 pack seed 失败(非致命)**:启动时 `seed official pack` 尝试插入系统用户
  (id `00000000-…-0001`)违反新加的 `users_id_auth_users_fk`(该用户不在 auth.users)。
  日志 WARN「failed to seed official pack; continuing」,不影响主流程。修法:为系统用户在
  auth.users 预置一行,或让该 seed 跳过 FK(放到 auth 之外)。
- **`next start` + `output: standalone`**:`next.config.ts` 开了 standalone,`next start`
  会告警「does not work with standalone」。生产部署应改用 `node .next/standalone/server.js`
  (需把 `.next/static`、`public` 拷进 standalone 目录)。本地测试 `bun run start` 仍能响应。
- **middleware 在 Edge 用 supabase-js**:构建告警 `process.version` 在 Edge 不支持(经
  `src/middleware.ts`)。实测运行时门禁正常,但更稳妥是把 middleware 迁到 `proxy.ts`
  (Node runtime,Next 16 新约定),一并消除「middleware 已废弃」告警。

## 怎么回滚

整个改动在 `feat/supabase-auth` 分支:`git checkout master` 即恢复 Auth.js 形态。
单独回滚 DB 指向:`.env.local` 里把 `DATABASE_URL` 改回注释中的外部 nimir 库即可。

## 未完成 / 待办(交给后续)

1. **RLS 未开**:后端以 `postgres` 超级用户直连会绕过 RLS,RLS 当前无功能价值,故暂缓。要防「客户端直连 PostgREST」越权需单独迁移补 RLS 策略(直接表 + 间接归属表上溯,见 research 报告第 5/7 节)。
2. **生产数据迁移**:本地用空库 + 真实注册验证。线上若要迁 nimir 数据,需 `pg_dump --schema=public --no-owner` + 把旧 `users.id` 直写 `auth.users`(非官方路径,需 PoC,见报告坑点 1/3)。当前 nimir 实际为空,无迁移负担。
3. **邮箱确认 / SMTP**:本地 `enable_confirmations=false`,注册即用。生产开确认需配 SMTP。
4. **i18n 文案**:登录/注册页描述文字仍写「username」「email optional」,字段标签临时用了字面量「邮箱 / Email」。需同步 `src/i18n/{zh,en}.ts` 的 auth 文案。
5. **清理 Auth.js 残留**:确认无误后删 `src/lib/auth/{config,index,password}.ts`、`[...nextauth]` 路由、`next-auth`/`bcryptjs` 依赖、以及 schema 里 `accounts`/`auth_sessions`/`verification_tokens` 三张未用表。
6. **云端**:你计划后续上 Supabase Cloud —— 把 `NEXT_PUBLIC_SUPABASE_URL` / keys 换成云项目值,`supabase link` + `supabase db push` 应用 0011 即可(publishable/secret key 命名已兼容)。
7. **dev fallback 替代**:原 `NIMIR_AUTH_DEV_FALLBACK` 自动 dev 用户已弃用(与 FK 冲突)。本地免登录调试可在 Supabase 预置一个种子用户。
