# yearn-chat 认证体系迁移调研报告:从 Auth.js v5 到 Supabase Auth

> 编写对象:项目负责人(对 yearn-chat 现状了解不多)
> 调研日期:2026-06-07
> 参考实现:MakerKit Supabase SaaS 模板 + Supabase 官方 Next.js 标准模式
> 本稿状态:已对 yearn-chat 源码、`package.json`、`.env.local`、`scripts/`、`drizzle/*.sql` 逐项核实

---

## 0. 一个必须先纠正的前提事实

任务最初的描述是"把 magic-link + 密码 替换为 Supabase Auth"。**经核对 yearn-chat 实际源码,当前并没有 magic-link 登录**:

- `src/lib/auth/index.ts` 中只配置了一个 Provider —— `Credentials`(用户名 + 密码),代码注释明确写着"Credentials provider (username + password)"。
- 没有任何 Email / Nodemailer / Resend Provider,`.env.example` 里的 `EMAIL_SERVER` / `EMAIL_FROM` 也未被消费。
- Schema 里虽然预留了 `verification_tokens` 表(magic-link 用),但**从未启用**。

**结论:现状是"仅用户名 + 密码"登录,没有 magic-link、没有 OAuth、没有邮箱验证。** 本报告以真实代码为准。这点很重要,因为它直接影响"要不要顺便补齐 magic-link / 邮箱登录"这一决策(见第 9 节)。

---

## 1. 执行摘要 / TL;DR

1. **现状**:yearn-chat 用 Auth.js v5(`next-auth@^5.0.0-beta.31`)+ `bcryptjs@^3.0.3` + **JWT 无状态 session**,只支持用户名/密码登录;数据库是**一个独立的外部 Postgres**(开发期 `192.168.1.20:5433/nimir`,PostgreSQL 18),通过 `postgres-js + Drizzle` **以 `postgres` 超级用户角色直连**,鉴权全在**应用层**(Drizzle 查询里按 `owner_id` / `user_id` 过滤),**完全没有 RLS**。它**目前不是一个 Supabase 项目**。宿主框架为 **Next.js 16.2.6**。

2. **核心岔路**:接入 Supabase Auth 的真正难点不是"换个登录库",而是**要不要把数据库也迁到 Supabase**。因为 Supabase 的安全模型(RLS + `auth.uid()`)只有当业务数据和 `auth.users` 在**同一个 Supabase Postgres**里时才能用。数据留在外部库 = `auth.uid()` 那套 RLS 用不了,鉴权仍得在应用层做。

3. **改造爆炸半径可控,但"零改动"是有限的**:35 个文件 import 了 auth,其中 27 个文件、79 处只调用了**一个统一入口** `getCurrentUserId()`。只要保持这个函数**签名(返回 `Promise<string>` 的 UUID)不变**,这 27 个文件在**类型层**几乎零改动。但**运行时语义会变**:新实现用 `getUser()` 每次回 Auth 服务器核验,必须用 React `cache()` 包裹,否则单请求内 79 处命中会放大为 N 次网络往返(详见第 8 节坑点 11)。集中爆破点在 `src/lib/auth/*`、`src/middleware.ts`、登录/注册页、以及 `scripts/seed-user.ts`。

4. **类型天然兼容,但"id 保值"是有强前提的**:`users.id` 是 `uuid` 且由 Drizzle `.defaultRandom()`(Postgres 端 `gen_random_uuid()`)生成,与 Supabase `auth.users.id`(UUID)类型一致。但"迁移时外键无需重映射、id 值不变"**只有在用迁移脚本直写 `auth.users.id` 时才成立**——GoTrue 常规注册会自行生成新 id,不接受应用指定 id(详见第 5 节与第 8 节坑点 3)。

5. **不能照搬 MakerKit**:MakerKit 是多租户团队 SaaS(`accounts` 表 + 个人/团队账号 + MFA + 推荐码),架构远比 yearn-chat 重。可借鉴的是它的**三客户端 + proxy + auth callback + `handle_new_user` trigger** 这套骨架,**不要**搬它的 `accounts` 多租户模型。注意 MakerKit 的 `requireUser` 用的是 `getClaims()`(不回源),与本报告给 `getCurrentUserId()` 推荐的 `getUser()`(回源)语义不同,不能无脑照搬(见第 3 节与坑点 11)。

6. **一句话推荐路线**:**走方案①(全量迁库到 Supabase)为终态**。即:把业务库迁到 Supabase 自托管 Postgres,用 `@supabase/ssr` 取代 Auth.js,开启 RLS。**但需重估方案①的真实收益**:由于后端继续以超级用户直连,RLS 对后端查询不生效(见坑点 13),RLS 只能拦"客户端直连 Data API"的越权,不能替代应用层过滤。落地节奏倾向**硬切 + 回滚预案**,而非长期并存(理由见第 5、第 9 节)。

---

## 2. yearn-chat 认证与数据现状

### 2.1 认证机制一览

| 维度 | 现状 |
|---|---|
| 认证库 | Auth.js v5(`next-auth@^5.0.0-beta.31`,beta) |
| 宿主框架 | **Next.js 16.2.6**(已支持 `proxy.ts` 约定) |
| 登录方式 | **仅 Credentials(用户名 + 密码)**,无 magic-link / OAuth |
| Session 策略 | **JWT 无状态**(不写 DB session 表);cookie 由 `AUTH_SECRET` 签名 |
| Adapter | `@auth/drizzle-adapter@^1.11.2` 已装但**未启用**(Credentials 不调 adapter,是死重量) |
| 密码哈希 | `bcryptjs@^3.0.3`,cost=10(`src/lib/auth/password.ts`) |
| 路由保护 | `src/middleware.ts`(Edge runtime,解 JWT cookie) |
| 统一取用户入口 | `getCurrentUserId()`(`src/lib/auth/current-user.ts`) |
| 开发便利 | `NIMIR_AUTH_DEV_FALLBACK=1` 时自动复用/创建 `dev` 用户 |
| 调试白名单 | `NIMIR_DEBUG_EMAILS`(`src/lib/auth/dev-allowlist.ts`) |

关键文件(均为绝对路径):
- `/mnt/d/code/QMAI/yearn-chat/src/lib/auth/config.ts` — Edge-safe 配置,`session.strategy = "jwt"`,`pages.signIn = "/signin"`
- `/mnt/d/code/QMAI/yearn-chat/src/lib/auth/index.ts` — Credentials provider + `authorize()`(查 `users` 表 → `bcrypt.compare`)
- `/mnt/d/code/QMAI/yearn-chat/src/lib/auth/password.ts` — `hashPassword` / `verifyPassword`(`bcryptjs`)
- `/mnt/d/code/QMAI/yearn-chat/src/lib/auth/current-user.ts` — `getCurrentUserId()`(单一入口)
- `/mnt/d/code/QMAI/yearn-chat/src/lib/auth/actions.ts` — `signupAction`(注册 + 自动登录)
- `/mnt/d/code/QMAI/yearn-chat/src/app/api/auth/[...nextauth]/route.ts` — `export const { GET, POST } = handlers`
- `/mnt/d/code/QMAI/yearn-chat/src/app/(auth)/signin/` 与 `/signup/` — 登录/注册 UI + Server Action
- `/mnt/d/code/QMAI/yearn-chat/scripts/seed-user.ts` — CLI 建号脚本(`hashPassword` + `INSERT users`)

### 2.2 数据库连接与鉴权模型

- **连接**:`postgres-js` + `drizzle-orm/postgres-js` **直连外部 Postgres**(`src/lib/db/client.ts`),连接串 `DATABASE_URL`,开发期实测指向 `postgres://postgres:***@192.168.1.20:5433/nimir`(PostgreSQL 18,LAN)。**连接角色是 `postgres`(超级用户)**,`max:3, prepare:false`(`prepare:false` 为兼容 PgBouncer/pooler 事务模式),客户端通过 `globalThis.__dearmPgClient` 复用。**这不是 Supabase 项目。**
- **鉴权**:**纯应用层**。所有写操作经 Server Action 先 `getCurrentUserId()`,所有查询在 `WHERE` 里加 `eq(table.userId, userId)` / `ownerId` / `authorId`。
- **RLS**:**完全没有**。扫描 `drizzle/0000~0010.sql` 全部 migration,未发现任何 `ENABLE ROW LEVEL SECURITY` / `CREATE POLICY`。

### 2.3 数据表与指向 users 的外键

`users.id`(`uuid`,Drizzle `.defaultRandom()` → Postgres `gen_random_uuid()`)被 9 张表以直接外键引用,**全部 ON DELETE CASCADE**:

| 引用表 | 外键列 | 删除行为 |
|---|---|---|
| `accounts`(Auth.js OAuth,未用) | `user_id` | CASCADE |
| `auth_sessions`(Auth.js,未用) | `user_id` | CASCADE |
| `characters` | `owner_id` | CASCADE |
| `chat_sessions` | `user_id` | CASCADE |
| `user_masks` | `user_id` | CASCADE |
| `user_regex_preferences` | `user_id` | CASCADE |
| `beautification_packs` | `owner_user_id` | CASCADE |
| `studio_sessions` | `user_id` | CASCADE |
| `character_comments` | `author_id` | CASCADE |
| `character_comment_likes` | `user_id` | CASCADE |

另有 `verification_tokens`(magic-link,未用)。

**此外存在一批"无直接 user 外键、靠上游表间接归属用户"的表**,例如 `messages`、`character_pack_subscriptions`、`regex_rules`、`subscription_rule_overrides`、`opening_components`、`pack_assistant_messages` 等,它们经 `chat_sessions` / `characters` / `beautification_packs` 等间接关联用户。**这类表在启用 RLS 时不能漏:必须用 `EXISTS` / 子查询上溯到拥有者**,否则要么裸奔、要么误锁(见第 7 节 Phase 5 与坑点 10)。

### 2.4 `users` 表关键字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` PK,`.defaultRandom()`(= `gen_random_uuid()`) | **与 `auth.users.id` 类型一致;但同值需迁移脚本直写,见坑点 3** |
| `username` | `varchar(64)` unique | 登录凭证(Supabase Auth 不原生支持纯 username 登录,见坑点 4) |
| `passwordHash` | `text` nullable | `bcryptjs` 哈希(迁移由谁接管见坑点 1,非"无感") |
| `email` | `text` nullable | Migration `0001` 把它从 NOT NULL 改成 nullable —— **部分老用户可能无 email**(影响 username→email 迁移,见坑点 4) |
| `displayName` / `avatarUrl` / `name` | text | 业务资料,迁移后应留在 public 资料表 |

### 2.5 改造爆炸半径

- **import auth 的文件**:35 个(含 6 个 API route、middleware、登录注册页、各业务 Server Action、RSC 页面、`Shell.tsx` / `CharacterDetailView.tsx` 组件)。
- **`getCurrentUserId()` 命中**:**79 处,27 个文件**。这是最重要的隔离层 —— 它把"如何认证"和"业务逻辑"解耦了。
- **`auth()` 直接调用**:仅 3 处(`middleware.ts`、`Shell.tsx`、`current-user.ts`)。
- **`signIn` / `signOut`**:集中在 `auth/index.ts`(导出)、`signin/action.ts`、`auth/actions.ts`、`settings/actions.ts`。
- **CLI 脚本触点**:`scripts/seed-user.ts` 直接走 `hashPassword` + `INSERT users`,**迁移后必然失效**,需改为 `supabase.auth.admin.createUser()` 或 seed SQL(见第 6.3 节)。

**含义:`getCurrentUserId()` 的返回类型保持"UUID 字符串"不变,可让那 27 个文件 79 处在类型层不动;但运行时必须配合 `cache()`(坑点 11)。** 真正要改写的是 `getCurrentUserId()` 内部 + 3 处 `auth()` 调用 + 登录注册 UI + seed 脚本 + 连接配置链(`drizzle.config.ts`,见第 6 节)。

---

## 3. 参考系统 MakerKit 怎么做(可借鉴 / 不适用)

MakerKit(`/mnt/c/Users/zqq/Desktop/saas`)是一套生产级多租户团队 SaaS 模板。

### 可借鉴(直接照搬骨架)

1. **三客户端分层**(浏览器 / 服务端 / 中间件各一个 client):
   - `packages/supabase/src/clients/browser-client.ts`
   - `packages/supabase/src/clients/server-client.ts`(带 `cookies()` 的 `getAll`/`setAll`,Server Component 写 cookie 用 try/catch 吞错)
   - `packages/supabase/src/clients/middleware-client.ts`
2. **proxy 刷 session + 路由门禁**:`apps/web/proxy.ts` 用 `supabase.auth.getClaims()` 刷新并判断登录态,未登录跳 `/auth/sign-in?next=...`。
3. **Auth Callback 路由**:`apps/web/app/auth/callback/route.ts` + `packages/supabase/src/auth-callback.service.ts`(`exchangeCodeForSession` / `verifyTokenHash`)。
4. **`requireUser` + React `cache()` 包装**:`packages/supabase/src/require-user.ts` 与 `apps/web/lib/server/require-user-in-server-component.ts`。**它对应 yearn-chat 的 `getCurrentUserId()`,是改造时的结构范本——但注意方法选择不同**:MakerKit 的 `requireUser` 用 `getClaims()`(本地校验、不回源,适合轻门禁);yearn-chat 的 `getCurrentUserId()` 用于真正保护数据,应改用 `getUser()`(回源核验)并用 `cache()` 包裹。可照搬其 `cache()` 包装结构,但不要照搬 `getClaims()` 的语义(见坑点 11、20)。
5. **`handle_new_user` trigger 自动建资料行**:`kit.setup_new_user()` 在 `auth.users` INSERT 后自动建 public 资料(从 `raw_user_meta_data` 取 name/avatar)。
6. **认证特性目录结构**:`packages/features/auth/src/components/*`(密码注册/登录、OAuth、密码重置、Magic Link、MFA 表单)可作 UI 参考。

### 不适用(不要照搬)

- **`accounts` 多租户模型**(个人账号 / 团队账号 / slug / `is_personal_account`):yearn-chat 是单用户拥有角色卡的简单模型,**不需要团队概念**。直接用一张 `public.profiles` 即可。
- **MFA / TOTP**:yearn-chat 当前无此需求,首期不做。
- **推荐码 / Referral / NewAPI provisioning**:MakerKit 业务专属逻辑,无关。
- **monorepo / `packages/*` 拆包**:yearn-chat 是单体 Next.js 应用,把 client 放 `src/lib/supabase/*` 即可,无需拆 package。

---

## 4. Supabase Auth 标准模式速览(官方 @supabase/ssr)

> Next.js 16 已引入 **`proxy.ts`** 约定(Node runtime)以替代 `middleware.ts`;`middleware.ts` 仍临时兼容但已被官方标注为废弃。**yearn-chat 实测在 Next.js 16.2.6**,因此本报告的 `middleware.ts → proxy.ts` 改名是可执行且建议执行的。Supabase 官方示例已同步到 `proxy.ts`。

标准"三件套 + 两路由":

1. **浏览器 client** `src/lib/supabase/client.ts` — `createBrowserClient(URL, PUBLISHABLE_KEY)`,单例。
2. **服务端 client** `src/lib/supabase/server.ts` — `createServerClient` + `await cookies()`,每请求新建。
3. **proxy 刷新辅助** `src/lib/supabase/proxy.ts` — `updateSession()`,在 `createServerClient` 与 `getClaims()` 之间**绝不插任何代码**,并把 `setAll` 的第二参数 `headers`(缓存头)写回响应,否则 CDN/ISR 可能把 A 用户 session 泄露给 B。**注意:`setAll` 的第二参数 `headers` 自 `@supabase/ssr` ≥ 0.10.0 起才提供**,低于此版本无此参数,照抄会编译/运行不符预期。
4. **邮箱确认路由** `src/app/auth/confirm/route.ts` — `verifyOtp({ type, token_hash })`。
5. **OAuth 回调** `src/app/auth/callback/route.ts` — `exchangeCodeForSession(code)`。

**鉴权铁律(措辞已按机制校正):**
- 服务端**绝不用 `getSession()`**:它**不向 Auth 服务器核验、不保证重新校验**,只信任本地 cookie,可被伪造 cookie 影响,故不可信。
- proxy 里用 **`getClaims()`**:非对称密钥时本地用 JWKS 验签名 + 过期,快,适合做轻量门禁;但它**只验签名与有效期、不回源**,因此不反映服务端登出/删号。
- **真正保护数据时在页面/Action 里用 `getUser()`**:每次回 Auth 服务器,权威,能反映服务端登出/删号。

**`auth.users` ↔ public 资料表**:Supabase 不暴露 `auth` schema 给 API,应用资料要在 `public` 建表,以 `auth.users(id)` 为外键(`on delete cascade`),开 RLS,并用 `handle_new_user` trigger 注册时自动建行:

```sql
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique,         -- 业务唯一标识落这里,带 unique 约束 + RLS
  display_name text,
  avatar_url text
);
alter table public.profiles enable row level security;
-- trigger 用 security definer set search_path = '' 硬化;
-- 从 raw_user_meta_data 取 username/display_name 作为「初始值」,
-- 后续修改走受控 Action,不信任 metadata 里的 username(见坑点 2、19)。
```

**RLS 标准谓词**(注意 yearn-chat 现在一条都没有):
```sql
-- 直接归属表:
create policy "owner can read" on public.characters
  for select to authenticated
  using ( (select auth.uid()) = owner_id );
-- UPDATE 必须同时写 USING + WITH CHECK,且需配套 SELECT 策略

-- 间接归属表(如 messages 经 chat_sessions 归属用户)需上溯:
create policy "owner can read messages" on public.messages
  for select to authenticated
  using ( exists (
    select 1 from public.chat_sessions s
    where s.id = messages.session_id
      and s.user_id = (select auth.uid())
  ) );
```

---

## 5. 核心架构抉择(本报告最重要部分)

问题本质:**Supabase Auth(GoTrue)默认把用户存在它自己项目的 `auth` schema 里**。yearn-chat 的业务数据现在在一个**独立外部 Postgres**。两者是否合并到同一个库,决定了能否用 RLS、决定了改造形态。

**一个贯穿全节的关键约束(必须先讲清):yearn-chat 后端以 `postgres` 超级用户直连数据库。RLS 只在「经 PostgREST + `anon`/`authenticated` 角色 + JWT」时强制执行;超级用户/owner/`service_role` 直连完全绕过 RLS。** 因此即便方案①开了 RLS,只要后端继续以现有方式直连,RLS 对后端查询**根本不生效**——后端写漏一个 `WHERE`,RLS 同样拦不住。RLS 在方案①下能提供的真实价值是**防止"客户端直连 Supabase Data API(PostgREST)"的越权**,而非"替代应用层过滤"。这一点直接影响下表对方案①的收益评估,务必如实呈现给负责人。

### 三方案对比

| 维度 | 方案① 全量迁库到 Supabase | 方案② 仅用 Supabase 做 IdP,数据留外部库 | 方案③ 渐进式(并存→切换) |
|---|---|---|---|
| 数据库 | 业务库迁入 Supabase Postgres(Cloud 或自托管) | 业务库仍在 `192.168.1.20:5433`,Drizzle 直连不变 | 先双写/影子表,最终收敛到①或② |
| 认证 | `@supabase/ssr` 全面取代 Auth.js | `@supabase/ssr` 仅发/验 JWT | 先 Supabase 与 Auth.js 并存 |
| **RLS 是否可用** | **部分可用**:`auth.uid()` 同库生效,但**仅约束经 PostgREST 的 `authenticated` 访问;后端超级用户直连仍绕过** | **不可用**(`auth` schema 跨不过库,`auth.uid()` 失效;直连也绕过) | 切换完成后同①或② |
| `auth.uid()` ↔ 本地 users | 天然(同库,trigger 建 profiles) | 需应用层验 JWT 取 `sub`,手工下推为查询参数 | 过渡期需映射表 |
| 对现有代码冲击 | 中:改 `auth/*` + proxy + 登录页 + seed 脚本 + 连接配置;`getCurrentUserId()` 内部改写(配 `cache()`),27 文件类型层不动;Drizzle 查询保留(但 RLS 对其不生效) | 中:`auth/*` + proxy + 登录页改;`getCurrentUserId()` 改为验 Supabase JWT;Drizzle 查询全保留,鉴权仍全靠应用层 | 高:要维护两套并存期 |
| 现有业务数据迁移 | 需把 `nimir` 库的 **`public` schema** 导入 Supabase(`pg_dump --schema=public --no-owner --no-privileges`,非整库),注意 schema/扩展冲突 | 不迁业务数据,只迁/同步用户身份 | 分批迁 |
| 用户密码迁移 | **高风险待验证**:bcryptjs 哈希直写 `auth.users.encrypted_password` 非官方受支持路径,cost=10 是否被 GoTrue 接受需 PoC;失败则走"强制重置"或"首登拦截校验旧哈希再写入"(见坑点 1) | 同① | 同① |
| 安全姿态 | 比现状好,但**不及"RLS 全兜底"的宣传**:后端直连不受 RLS 约束,越权防护主要仍压在应用层;RLS 只挡客户端直连 Data API | 一般(无 RLS,所有越权防护全压应用层 79 处过滤) | 过渡期最脆弱 |
| 运维 | 多一套 Supabase 自托管栈(**含 Supabase 自带的 Postgres,不能直接复用现有 PG18 实例,见坑点 18**)或托管费(Cloud) | 复用现有外部库,Supabase 仅 Auth 组件 | 最复杂 |
| 改造工作量(粗估) | 中偏高(见第 7 节,**重算后约 14–20 人天**,未含 bcrypt 导入 PoC 与 RLS 上溯表全量) | 中(约 10–15 人天,省了迁数据但欠了 RLS 债) | 高(并存期 +5~8 人天,且需自建 session 共存机制) |

### 推荐:终态收敛到方案①,落地用"硬切 + 回滚预案"

理由(已按 RLS 真实作用域校正):
1. **yearn-chat 现在零 RLS,纯靠应用层 79 处 `WHERE` 过滤防越权**。迁到 Supabase 同库后,RLS 能**阻断"客户端直连 PostgREST Data API"的越权**——若未来要把部分读写交给前端直连 Supabase,这层兜底是有价值的。**但要诚实:只要后端继续超级用户直连,RLS 对后端查询不生效**,所以它**不是**"不依赖代码正确性的全局安全网",后端的越权防护仍依赖应用层过滤的正确性。
2. 方案② **主动放弃 RLS**,且 Drizzle 直连也绕过 RLS,等于把 Supabase 砍成"只发 JWT 的登录服务",收益小、欠债大,不推荐作为终态。
3. `users.id` 是 UUID 且与 `auth.users.id` 同类型,迁库时**外键类型无需改**;但 **id 同值依赖迁移脚本直写 `auth.users`**(GoTrue 常规注册自生成 id、不接受指定 id),否则需建"旧 id → 新 auth.uid"映射表并批量改写 9 张直接外键 + 间接归属表(见坑点 3)。
4. **落地不建议长期并存**:方案③自评"并存期最脆弱、最复杂",且"两套认证(Auth.js JWT cookie 与 Supabase cookie)并存时如何路由同一用户、session 如何互认"没有现成机制。除非愿意自建按用户标记分流 + 双 cookie 校验顺序的逻辑,否则应采用**一次性硬切 + 明确回滚预案**(保留 Auth.js 代码与旧库快照,出问题可回滚),而不是用模糊的"渐进节奏"掩盖未决策。

> 若负责人对"迁外部库"有顾虑(如该库还被其他系统共用,见坑点 23),则退守方案②,但必须接受"鉴权全在应用层、无 RLS 兜底"的现实,并据此加强代码审计与测试。

---

## 6. 落地改造清单(逐文件)

### 6.1 新增

| 文件 | 内容 |
|---|---|
| `src/lib/supabase/client.ts` | 浏览器 client(`createBrowserClient`) |
| `src/lib/supabase/server.ts` | 服务端 client(`createServerClient` + `cookies()`) |
| `src/lib/supabase/proxy.ts` | `updateSession()` 刷新 token + 门禁(需 `@supabase/ssr ≥ 0.10.0`) |
| `src/app/auth/confirm/route.ts` | 邮箱/magic-link 确认(`verifyOtp`) |
| `src/app/auth/callback/route.ts` | OAuth 回调(`exchangeCodeForSession`)— 仅在决定上 OAuth 时需要 |
| Supabase migration:`public.profiles` 表 + `handle_new_user` trigger + RLS policies(含间接归属表的上溯谓词) | 见第 4、第 7 节 |

### 6.2 重写(核心爆破点)

| 文件 | 改法 |
|---|---|
| `src/lib/auth/current-user.ts` | `getCurrentUserId()` 内部改为:`createClient()` → `getUser()` → 返回 `user.id`;无用户时 `redirect("/signin")`。**必须用 React `cache()` 包裹**,否则单请求内 79 处命中 = N 次 Auth 往返(现 `auth()` 是本地解 JWT,无往返)。**签名保持 `Promise<string>`**,27 文件类型层零改动。dev fallback 见第 8 节坑点 5 |
| `src/middleware.ts` → 重命名 `src/proxy.ts` | (Next.js 16.2.6 已支持)改为调用 `updateSession()`;matcher 保留排除 `/api`、`/_next`、`/signin`、`/signup`、静态资源。注意 Edge→Node runtime 差异 |
| `src/app/(auth)/signin/action.ts` | `signIn("credentials")` → `supabase.auth.signInWithPassword({ email, password })` |
| `src/app/(auth)/signin/SignInForm.tsx` | 字段从 username 改 email(或保留 username,见坑点 4) |
| `src/app/(auth)/signup/SignUpForm.tsx` + `src/lib/auth/actions.ts` | `signupAction` 改为 `supabase.auth.signUp({ email, password, options:{ data:{ username, display_name } } })`;`options.data` 进 `raw_user_meta_data` 供 trigger 取**初始值**(后续 username 改动走受控 Action,见坑点 19) |
| `src/lib/settings/actions.ts`(`signOutAction`) | `signOut()` → `supabase.auth.signOut()` |
| `src/components/Shell.tsx` | `auth()` 取 session → `createClient().auth.getUser()`(头像/displayName 改从 `profiles` 查) |
| `src/app/api/auth/[...nextauth]/route.ts` | **删除**(Supabase 不需要此 catch-all) |
| `scripts/seed-user.ts` | **改写**:不再 `hashPassword` + `INSERT users`,改为 `supabase.auth.admin.createUser({ email, password, user_metadata })`(由 GoTrue 哈希)或改为本地 seed SQL |

### 6.3 删除 / 清理

| 项 | 说明 |
|---|---|
| `next-auth`、`@auth/drizzle-adapter`、`bcryptjs`、`@types/bcryptjs` 依赖 | Supabase GoTrue 接管哈希后移除 |
| `src/lib/auth/config.ts`、`src/lib/auth/index.ts`、`src/lib/auth/password.ts` | Auth.js 专属,删除 |
| Drizzle schema 的 `accounts`、`auth_sessions`、`verification_tokens` | Auth.js 遗留三表,迁到 Supabase 后删除(本就未用)。**前置条件:确认 `nimir` 库无任何外部系统消费这些表**(该库可能被其他系统共用,见坑点 20) |
| `AUTH_SECRET`、`AUTH_TRUST_HOST` 环境变量 | 换为 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` |

### 6.4 连接与迁移工具链(迁库的关键未决项)

| 项 | 说明 |
|---|---|
| `drizzle.config.ts` | 读 `.env.local` 的 `DATABASE_URL`。迁库到 Supabase 后连接串变更(Supabase direct `5432` / transaction pooler `6543`、`sslmode` 不同),需相应调整。`prepare:false` 在走 pooler(6543)时**仍需保留** |
| **谁管 schema:`drizzle-kit` vs `supabase db`** | 迁库后必须二选一或明确分工,否则两套 migration 工具会冲突。建议:Supabase 侧对象(`auth`/`profiles`/trigger/RLS)用 `supabase` 迁移管理,业务表沿用 `drizzle-kit`,但需统一执行顺序与连接配置 |
| Drizzle 连哪个端口/角色 | 若决定"Drizzle 继续直连 Supabase",需明确连 direct(5432)还是 pooler(6543),以及用什么角色——这直接决定 RLS 是否生效(超级用户/`service_role` 直连绕过 RLS) |

### 6.5 users 与 auth.users 的映射(方案①下)

- `auth.users.id`(UUID)目标 = 现 `public.users.id`(UUID)—— 同类型;**同值需迁移脚本直写 `auth.users`**(见坑点 3)。
- 新建 `public.profiles(id uuid PK references auth.users on delete cascade, username unique, display_name, avatar_url)`,承接现 `users` 表的业务字段。
- **外键到底指向谁,必须明确**:推荐 **9 张直接外键表迁移后指向 `public.profiles.id`**,而 `profiles.id` 又 `references auth.users on delete cascade`。这形成**两级级联**:在 Supabase 删 `auth.users` 一行 → 级联删该用户 `profiles` 行 → 再级联删所有业务数据。需在迁移脚本与文档中明确画出这条两级链路,并据此核对坑点 10 的 CASCADE 描述。
- 因 id 值不变(前提是直写 `auth.users`),**外键数据无需重映射**,只需保证 `profiles` 行先于业务数据存在(trigger 保证)。
- 现有用户数据迁移:把现 `users` 行的 `id` + `email` 导入 Supabase `auth.users`;`passwordHash` 的处理**不是"无感导入",见坑点 1**;其余业务字段进 `profiles`。

---

## 7. 分阶段路线图

> 工作量为粗估人天,假设 1 名熟悉 Next.js 的工程师。**合计已与各 Phase 之和对齐,并标注未含项。**

| 阶段 | 产出 | 粗估 |
|---|---|---|
| **Phase 0 — 决策与立项** | 负责人就第 9 节清单拍板(尤其:迁库?上 RLS 及其真实作用域?保留 username 登录?Cloud/自托管?硬切还是并存?) | 0.5 |
| **Phase 1 — 起 Supabase 环境** | 本地 `supabase start`(Docker 全栈,含 Supabase 自带 Postgres)或开 Cloud 项目;配置 publishable/secret key、site_url、redirect URLs、SMTP;建 `profiles` + trigger + RLS | 2–3 |
| **Phase 1.5 — bcrypt 导入 PoC(新增,前置阻断项)** | 实测 GoTrue 是否接受 bcryptjs cost=10 哈希直写 `auth.users.encrypted_password` 并能正常登录;失败则确定备选路径(强制重置 / 首登拦截换哈希) | 1–2 |
| **Phase 2 — 数据迁移演练** | `pg_dump --schema=public --no-owner --no-privileges` 现 `nimir` 库 → 导入 Supabase(核对 `pgcrypto` 等扩展由 Supabase 预装);用迁移脚本直写 `auth.users`(含 id 保值)或建映射表;影子项目验证外键与登录 | 2–3 |
| **Phase 3 — 接入 SSR 三件套** | 写 `src/lib/supabase/{client,server,proxy}.ts`;`middleware.ts`→`proxy.ts`;改写 `getCurrentUserId()`(签名不变 + `cache()` 包裹) | 2 |
| **Phase 4 — 登录/注册/登出 UI + seed 脚本** | 改 signin/signup/signout 的 Server Action 与表单;改写 `scripts/seed-user.ts`;加 `/auth/confirm` 路由;邮箱确认走通 | 2–3 |
| **Phase 5 — RLS 收口** | 为 9 张直接外键表写 `to authenticated + auth.uid()` 策略;**为间接归属表(`messages`/`character_pack_subscriptions`/`regex_rules`/`subscription_rule_overrides`/`opening_components`/`pack_assistant_messages` 等)逐一写 `EXISTS` 上溯谓词**;明确"后端超级用户直连不受 RLS 约束"的边界 | 3–4(原 2–3 低估) |
| **Phase 6 — 硬切与清退** | 按回滚预案硬切(保留旧库快照与 Auth.js 代码);验证无误后删 Auth.js 依赖与三张遗留表(前置确认无外部消费者);清理环境变量 | 1.5 |
| 合计 | | **约 14–20 人天** |

> 合计核对:0.5 + (2–3) + (1–2) + (2–3) + 2 + (2–3) + (3–4) + 1.5 = 下限 14.5、上限 ~19,取 **14–20**。**未含**:并存期 session 共存机制(若放弃硬切改并存,另 +5~8 人天)、bcrypt 备选路径若选"首登拦截换哈希"的额外开发、若后端改走 PostgREST/`authenticated` 角色以使 RLS 真正生效(架构大改,与"27 文件零改动"矛盾,工作量量级变化)。

---

## 8. 风险与坑

1. **bcryptjs 哈希迁移不是"无感导入"(全篇最关键风险)**:GoTrue 的 `encrypted_password` 列接受 bcrypt 格式(`$2a$`/`$2b$`,与 `bcryptjs` 输出兼容),**但 GoTrue 并不提供"导入任意 bcrypt 哈希后用户无感登录"的受支持公开 API**。批量导入需**直写 `auth.users.encrypted_password`**(非官方路径,跨版本易碎),且 cost=10 是否被 GoTrue 接受**需 PoC 实测**(Phase 1.5)。此项是方案①"用户无感迁移"成立与否的根。备选:(a) 强制全员密码重置流程;(b) 首次登录时拦截,用应用侧 `bcryptjs.compare` 校验旧哈希,通过后调 `auth.admin.updateUserById` 写入 Supabase 托管密码,实现渐进无感。**在 PoC 通过前,不得把"哈希导入、用户无感"写成既定方案。**
2. **`user_metadata` 不可信**:`raw_user_meta_data`(= `user_metadata`,即 signup 时 `options.data` 写入的 username/display_name)**用户可自行修改**,**绝不能用于授权判断或 RLS**。授权相关字段须放 `app_metadata`(`raw_app_meta_data`)。
3. **"id 保值、外键零重映射"依赖直写 `auth.users`**:GoTrue 常规注册自行 `gen_random_uuid()` 生成 id,**不接受应用指定 id**。要保留旧 `users.id`,迁移脚本必须**直写 `auth.users.id`**(同坑点 1 的非官方路径)。否则只能:为每个用户生成新 `auth.uid` → 建"旧 id → 新 auth.uid"映射表 → 批量改写 9 张直接外键 + 所有间接归属表的归属链。"id 同类型"成立,但"id 同值、外键零重映射"是有强前提的。
4. **username 登录不被 Supabase 原生支持**:Supabase Auth 以 **email/phone** 为主键身份,不支持纯 username + password。现 `users.email` 是 nullable,**部分老用户可能没 email**,且 username 唯一但 email 可能为空。迁移选项:(a) 强制收集 email 改 email 登录;(b) 用 `username@yearn.local` 伪邮箱占位;(c) 自建 username→email 映射在登录前转换。**伪邮箱方案的额外约束**:GoTrue 要求 email 唯一,且若开启邮箱确认会向不可投递的 `@yearn.local` 发确认邮件导致注册卡死——故选伪邮箱必须**同时关闭该路径的邮箱确认**(admin 创建时设已确认,或关闭 confirmations)。**这是最需要负责人拍板的产品决策。**
5. **本地 dev fallback 如何替代**:`NIMIR_AUTH_DEV_FALLBACK=1` 自动复用 `dev` 用户的便利,Supabase 下可用 `supabase start` 本地栈 + 预置一个种子 `auth.users`(seed SQL)替代,或保留一个仅本地生效的环境开关在 `getCurrentUserId()` 里短路返回固定 UUID。`scripts/seed-user.ts` 也需同步改造(见 6.2)。
6. **邮件/SMTP**:一旦上邮箱确认 / magic-link / 密码重置,**必须配 SMTP**(MakerKit dev 用本地 inbucket;生产需真实 SMTP)。否则注册流程会卡在"等确认邮件"——与坑点 4 的伪邮箱方案直接联动。
7. **`middleware.ts`→`proxy.ts` 与 Edge→Node**:yearn-chat 实测在 Next.js 16.2.6,proxy 约定可用;现 middleware 跑 Edge runtime,Supabase proxy 标准跑 Node runtime,迁移时注意 runtime 差异,并遵守 `proxy.ts` 里"`createServerClient` 与 `getClaims()` 之间不插代码"的硬性要求。
8. **CDN/ISR session 泄露**:`setAll` 的第二个 `headers` 参数(缓存头)必须写回响应,否则可能把一个用户的 session 缓存给另一个用户(官方 advanced-guide 明确警告)。该参数需 **`@supabase/ssr ≥ 0.10.0`**。
9. **`next-auth` 是 beta**:现用 `^5.0.0-beta.31`,本身就是迁走的额外动因(beta API 不稳定)。
10. **CASCADE 删除连锁(两级)**:9 张表全 CASCADE。迁移后外键指向 `public.profiles`(其自身 `references auth.users on delete cascade`),形成 `auth.users` → `profiles` → 业务数据的**两级级联**。在 Supabase dashboard 删一个 auth 用户会级联删光该用户所有角色卡/会话/评论,这与现状行为一致,但运维需明确知晓这条链路。
11. **`getUser()` 每次回源,必须 `cache()` 包裹**:现 `getCurrentUserId()` 用 `auth().catch(()=>null)` 是**本地解 JWT、无网络往返**;改为 `getUser()` 后每次调用一次 Auth 服务器往返。79 处命中、单页可能多次,若不包 React `cache()`,会放大为 N 次往返,性能特征显著恶化。**"零改动"只在类型层成立,运行时需 `cache()`**(对齐 MakerKit `requireUserInServerComponent = cache(...)` 范本)。
12. **`getSession()` 措辞校正**:不可信的原因是它**不向 Auth 服务器核验、不保证重新校验**(信任本地 session),而非"完全不验签"。服务端一律避免。
13. **RLS 对后端直连无效(收益重估的核心)**:RLS 只在 PostgREST + `anon`/`authenticated` 角色 + JWT 时强制。yearn-chat 后端用 `postgres-js` **以 `postgres` 超级用户直连**(已由 `.env.local` 与 `client.ts` 证实),**完全绕过 RLS**。所以方案①即便开 RLS,后端写漏一个 `WHERE`,RLS 一样拦不住——RLS 此时只防"客户端直连 Data API"的越权。**要让 RLS 真正成为后端兜底,必须后端改走 PostgREST / `authenticated` 角色(架构大改,与"27 文件零改动"矛盾);否则须坦承"RLS 不替代应用层过滤"**,第 5 节推荐理由与第 9 节决策 10 据此呈现。
14. **删用户不使已签发 JWT 失效(因果校正)**:服务端删号/登出后,旧 JWT 在过期前仍可能被 `getClaims()` 通过——**原因是 `getClaims()` 本地校验只验签名+过期、不回源**,与缓存无关,是机制本身。另有一件**不同的事**:轮换/撤销签名密钥后,JWKS 的约 10 分钟 Edge 缓存会带来生效延迟。两者不要混为一谈。对真正敏感操作必须用 `getUser()`(回源核验),并保持短 `jwt_expiry`。
15. **Drizzle 直连端口/角色与 pooler**:`prepare:false` 在走 Supabase transaction pooler(6543)时仍需保留;若决定 Drizzle 继续直连 Supabase,需明确 direct(5432)/pooler(6543)与角色,且角色选择直接决定坑点 13 是否成立。
16. **整库 `pg_dump` 会与 Supabase 既有对象冲突**:Supabase 项目库自带 `auth`/`storage`/`realtime` 等 schema 与 `supabase_admin` 等角色。**不可直接整库 `pg_dump`/`pg_restore`**;应 `--schema=public --no-owner --no-privileges` 只迁 `public`,扩展(如 `pgcrypto`)按 Supabase 预装核对,并先在影子项目演练。
17. **自托管不能直接复用现有 PG18 实例**:Supabase 自托管 compose **自带打包的 Postgres**,并依赖特定扩展(`pgsodium`、`pg_graphql`、`supabase_vault` 等)与角色;**不支持把任意已存在的外部 PG18(`192.168.1.20`)直接当作 Supabase 的库**。所以"自托管复用现有 Docker/现有库"很可能不成立——自托管仍要起 Supabase 自己那套 Postgres,数据需迁入。决策 6 的"复用 192.168.1.20"与"自托管"二者不可兼得。
18. **并存期 session 互认无现成机制**:若不硬切而走方案③并存,Auth.js JWT cookie 与 Supabase cookie 如何对同一用户路由、校验顺序如何,需自建(如按用户标记分流 + 双 cookie 校验)。这是被"渐进节奏"掩盖的核心未决策,建议改为硬切 + 回滚预案。
19. **username 必须落 `profiles` 而非信任 metadata**:trigger 从 `raw_user_meta_data` 取 username 作**初始值**写入 `public.profiles.username`(unique + RLS),之后修改走受控 Action。绝不能把 `user_metadata.username`(用户可自改)当登录标识或唯一键,否则有提权/撞键风险。
20. **删表前置"确认无外部消费者"**:删 `accounts`/`auth_sessions`/`verification_tokens` 三表前,必须确认 `nimir` 库无任何 migration 回滚依赖或外部系统依赖这些表(该库可能被其他系统共用)。与第 5 节"退守方案②"的共用顾虑联动。

---

## 9. 需要负责人拍板的决策清单

| # | 决策项 | 选项 | 默认推荐 |
|---|---|---|---|
| 1 | **是否把业务库迁到 Supabase Postgres?** | 迁(方案①)/ 不迁仅做 IdP(方案②) | **迁**(终态),但须知 RLS 只挡客户端直连、不挡后端超级用户直连 |
| 2 | **是否启用 RLS?** | 启用 / 暂不 | **启用**,定位为"客户端直连 Data API 的兜底",不替代应用层过滤 |
| 3 | **登录身份用什么?** | 强制 email 登录 / 保留 username(伪邮箱或映射) | 需产品决策,倾向**改 email**(伪邮箱方案须关确认邮件) |
| 4 | **是否保留密码登录?** | 保留 / 改为 magic-link / 两者都要 | **保留密码**,可选加 magic-link |
| 5 | **是否新增 OAuth(Google/GitHub)?** | 是 / 否 | 首期**否**,留接口 |
| 6 | **Supabase Cloud 还是自托管?** | Cloud(省运维、有费用)/ 自托管(起 Supabase 自带 PG,**不能直接复用 192.168.1.20 PG18**) | 视团队运维能力定;若图"复用现有库"则该理由不成立,需重新权衡 |
| 7 | **users 表去留 / 外键指向** | 字段迁 `profiles`、业务外键指向 `profiles.id`、`profiles.id` 引用 `auth.users` | **迁 `profiles`,两级级联**(见 6.5、坑点 10) |
| 8 | **现有用户密码迁移方式** | 直写 auth.users 哈希(**待 PoC 验证,非无感保证**)/ 强制全员重置 / 首登拦截换哈希 | **先做 Phase 1.5 PoC** 再定;PoC 不过则首登拦截换哈希 |
| 9 | **是否需要 MFA** | 是 / 否 | 首期**否** |
| 10 | **Drizzle 是否继续直连 / 用什么角色** | 继续超级用户直连(绕 RLS,RLS 仅挡客户端)/ 改走 PostgREST + `authenticated`(RLS 对后端生效,但架构大改) | **继续直连 + 应用层过滤为主**,RLS 仅作客户端侧兜底;若要 RLS 真兜底后端则需架构改造并重估工作量 |
| 11 | **落地方式** | 硬切 + 回滚预案 / 长期并存(需自建 session 互认) | **硬切 + 回滚预案** |

---

### 附:本报告引用的关键真实文件路径(便于核查)

- yearn-chat:`src/lib/auth/{config,index,password,current-user,actions,dev-allowlist}.ts`、`src/middleware.ts`、`src/lib/db/{client,schema}.ts`、`src/app/(auth)/signin|signup/*`、`src/app/api/auth/[...nextauth]/route.ts`、`scripts/seed-user.ts`、`drizzle.config.ts`、`drizzle/0000~0010.sql`、`package.json`(`next@16.2.6`、`next-auth@^5.0.0-beta.31`、`bcryptjs@^3.0.3`、`@auth/drizzle-adapter@^1.11.2`)、`.env.local`(`DATABASE_URL=postgres://postgres:***@192.168.1.20:5433/nimir`,PG18)
- MakerKit:`packages/supabase/src/clients/{browser,server,middleware}-client.ts`、`apps/web/proxy.ts`、`apps/web/app/auth/callback/route.ts`、`packages/supabase/src/{require-user,auth-callback.service}.ts`、`apps/web/lib/server/require-user-in-server-component.ts`(`cache()` 范本)、`apps/web/supabase/migrations/*_schema.sql`(`kit.setup_new_user` trigger)、`apps/web/supabase/config.toml`
- Supabase 官方:`@supabase/ssr`(≥ 0.10.0)三件套 + `app/auth/confirm/route.ts` + `handle_new_user` trigger;`getSession`/`getClaims`/`getUser` 语义与 RLS 角色约束见官方 SSR advanced-guide 与 RLS 文档
