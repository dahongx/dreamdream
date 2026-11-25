# 执行计划 —— 账号注销（硬删除）

> 状态：**已实施**（2026-08-09）。双份文档见
> [handover](../../handover/account-deletion.md) / [insights](../../insights/account-deletion.md)。
> 触发：用户反馈急需注销功能。
> 产品决策：**注销 = 硬删除**。注销者本人的数据一律不留，唯二例外是付款订单（脱钩保留）
> 和一个不关联任何内容的邮箱哈希（防重复领新人币）。

---

## 一、四个已定决策

| # | 决策点 | 结论 |
|---|--------|------|
| 1 | 创作者的角色卡 | **删掉**；但其他用户跟这些卡的会话**断链保留**（不连坐） |
| 2 | `payment_orders` | **脱钩保留**（`user_id` 置 null），供对账 / 报税 |
| 3 | 冷静期 | **无**。点确认即删，不可撤销 |
| 4 | 重复注册薅新人币 | **挡**。独立表存加 pepper 的邮箱 HMAC，重注册允许但不再发新人币 |

| 5 | 孤儿会话的可见度 | **列表灰条**（方案 B）。数据完整留库，点不进去；只读查看器后置 |

---

## 二、为什么硬删几乎是免费的

`drizzle/0011` 给 `public.users.id` 加了 `REFERENCES auth.users(id) ON DELETE CASCADE`，
业务侧 20+ 张表又全部 `ON DELETE CASCADE` 挂在 `public.users` 上。

于是整个注销动作的主体就是一句：

```ts
await admin.auth.admin.deleteUser(userId)
```

GoTrue 删掉 `auth.users` 行（连带 `auth.identities` / `auth.sessions` / refresh token），
Postgres 的级联链自己把 `public.users` 及其下游全部带走，**在同一个事务里**。

这条 FK 是上一版「保留聊天记录」方案的最大障碍，在硬删方案里反而是主力。**不要动它。**

登录态不需要额外处理：每个请求都走 `supabase.auth.getUser()` 回源核验
（[proxy.ts](../../../src/proxy.ts) → [auth-user.ts](../../../src/lib/auth/auth-user.ts)），
不是本地解 JWT，所以 auth 行一没，全站当场失效，没有旧 token 残留窗口。

---

## 三、数据处置矩阵

### 3.1 跟着级联自动删（不需要写代码）

| 表 | 经由 |
|----|------|
| `users` | `auth.users` 级联 |
| `user_masks` / `user_regex_preferences` | `user_id` CASCADE |
| `characters` → `regex_rules`* / `opening_components`* / `character_opening_slot_values` | `owner_id` CASCADE |
| `beautification_packs` → `regex_rules` / `subscription_rule_overrides` / `opening_component_overrides` | `owner_user_id` CASCADE |
| `chat_sessions` → `messages` | `user_id` CASCADE（注销者自己的会话） |
| `character_comments` / `character_comment_likes` | `author_id` / `user_id` CASCADE |
| `character_favorites` / `character_likes` | `user_id` CASCADE |
| `user_follows`（双向） | `follower_id` / `following_id` CASCADE |
| `currency_transactions` | `user_id` CASCADE |
| `creator_earning_records` / `creator_character_cursors` / `creator_fans_cursors` | CASCADE |
| `studio_sessions` / `pack_assistant_messages` | `user_id` CASCADE |
| `invite_code_redemptions` | `user_id` CASCADE |

\* 规则/开场组件挂在包上，包被删则一并删。

### 3.2 需要改 FK 才能达成目标

| 表.列 | 现状 | 改成 | 为什么 |
|-------|------|------|--------|
| `chat_sessions.character_id` | `NOT NULL` + CASCADE | `NULL` + `ON DELETE SET NULL` | 创作者注销删卡时，**不能连坐删掉其他用户的对话记录**。这是决策 1 的落点 |
| `payment_orders.user_id` | `NOT NULL` + CASCADE | `NULL` + `ON DELETE SET NULL` | 决策 2。隐私政策 8.2 已写明「交易与对账记录按税法要求保留」，日本帐簿书类另有 7 年保存义务 |

### 3.3 已经是 SET NULL，无需改动

`currency_transactions.session_id` / `.message_id` / `.operator_id`、
`invite_codes.created_by`、`model_prices.updated_by`、`model_price_history.changed_by`、
`chat_sessions.active_mask_id`。

副作用：注销者若是 admin，其价格变更 / 手动充值的操作痕迹会变 null，审计断链。接受。

### 3.4 级联管不到、必须单独处理

| 对象 | 处理 |
|------|------|
| Supabase Storage（`media` public bucket） | 按前缀 `users/<uid>/` 与 `characters/<uid>/` 列出并批量删除。**不删的话头像 / 角色封面注销后照样公网可访问，这才是真正的「没删干净」** |
| Stripe 侧记录 | 删不掉也不该删（第三方保存义务）。隐私政策第 6 章第三方清单已披露，无需额外动作 |

### 3.5 会波及第三方、但接受的连带

- **别人订阅了注销者的美化包** → `character_pack_subscriptions` 行随包一起删，对方的角色卡
  当场掉 CSS / 正则 / 开场组件。卡本身不受影响。**注销确认页需要提示创作者这一条。**
- **别人在注销者角色卡下的评论 / 收藏 / 点赞** → 随卡一起删。卡都没了，合理。
- **别人的账本行** → `currency_transactions` 保留，但 `session_id` / `character_id` 关联断掉，
  钱包 UI 里那笔消费显示不出角色名。降级可接受（[wallet/queries.ts:251](../../../src/lib/wallet/queries.ts:251) 本来就是 leftJoin）。
- **邀请码使用计数** → `invite_code_redemptions` 删行后，若 `invite_codes` 上有冗余计数列需要
  一并回补。落地前确认。

---

## 四、Schema 改动（migration 清单）

按仓库约定：不做破坏性迁移，新表必须在同一迁移里开 RLS。

### M1 —— `chat_sessions.character_id` 可空 + SET NULL

```sql
ALTER TABLE "chat_sessions" ALTER COLUMN "character_id" DROP NOT NULL;
ALTER TABLE "chat_sessions" DROP CONSTRAINT "chat_sessions_character_id_characters_id_fk";
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_character_id_characters_id_fk"
  FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE SET NULL;
```

⚠️ `chat_sessions_user_char_current_uidx`（`(user_id, character_id)` partial unique）在
`character_id` 为 null 时，Postgres 的 unique 语义把多个 null 视作互不相等 —— 孤儿会话不会
互相冲突，索引行为正确，无需改动。

### M2 —— `payment_orders.user_id` 可空 + SET NULL

同上写法。`payment_orders_user_created_idx` 保留。

⚠️ 履约链路（[api/stripe/webhook](../../../src/app/api/stripe/webhook)）在 `fulfillOrder` 里
按 `user_id` 发货 —— 建单到履约之间用户理论上可以注销。落地时需要给 `user_id IS NULL` 的
订单加一条早退分支（视为「用户已注销，不发货，标 status 但不 throw」），否则 webhook 会
无限重试。**这是本计划里最容易漏的一处。**

### M3 —— 新表 `deactivated_email_hashes`

```sql
CREATE TABLE "deactivated_email_hashes" (
  "email_hash" text PRIMARY KEY,
  "deactivated_at" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE "deactivated_email_hashes" ENABLE ROW LEVEL SECURITY;
```

- 只有一列哈希 + 一个时间戳，**不含 user_id，不与任何内容表建立关联** —— 这是它区别于
  「保留个人信息」的关键。
- 哈希算法：`HMAC-SHA256(pepper, lower(trim(email)))`，pepper 走新的服务端 env
  `ACCOUNT_DELETION_EMAIL_PEPPER`。用 HMAC 而非裸 SHA256，是为了让拿到库的人也无法
  靠字典枚举反查邮箱。
- 零 policy = 全拒绝，符合 CLAUDE.md 的 RLS 约定。

---

## 五、执行流程

### 5.1 server action：`deleteAccountAction`

放 `src/lib/settings/actions.ts`（与 `signOutAction` 同处），或独立 `src/lib/account/delete.ts`。

**顺序是有讲究的，不能随意调换：**

1. `getCurrentUserId()` —— 授权闸。呼应近期的 server action 授权审计，一个都不能省。
2. **口令复核**：用表单里输入的密码调 `signInWithPassword` 复核身份。
   ⚠️ 必须用**另起一个** `@supabase/supabase-js` 的 client（`persistSession: false`），
   不能用 `@/lib/supabase/server` 的 `createClient()` —— 后者绑 cookie，登录成功会把
   会话 cookie 重写一遍。
3. 读出 email，算 HMAC，写入 `deactivated_email_hashes`（`ON CONFLICT DO NOTHING`）。
   **必须在删之前做，删完就拿不到邮箱了。**
4. **删 Storage 前缀**（`users/<uid>/`、`characters/<uid>/`），best-effort，失败只记日志继续。
5. `admin.auth.admin.deleteUser(userId)` —— 级联主体，一次事务。
6. `supabase.auth.signOut({ scope: 'local' })` 清本地会话 cookie。
   （@supabase/ssr 的 cookie 可能被分块成 `.0` / `.1`，手动 `cookies().delete()` 容易漏。）
7. `redirect('/signin?deleted=1')`。

**为什么 Storage 在 deleteUser 之前**：若 Storage 删成功、deleteUser 失败，用户账号还在但头像
碎了 —— 烦人，可自愈（重传）。反过来若 deleteUser 成功、Storage 失败，注销者的照片留在公开
bucket 里且**再也没有记录能指向它去清理** —— 那是隐私漏洞。两害相权，Storage 先走。

**为什么 signOut 在 deleteUser 之后**：不可逆那一步失败时，用户应该还登录着、能看见错误信息。
就算这步没清干净也能自愈 —— proxy 的 `getUser()` 对失效 token 会 catch 成「未登录」跳登录页。

第 5 步失败时，第 3 步写下的哈希会变成脏数据（人没删成，邮箱却被标记）。影响仅限「该用户
将来重注册拿不到新人币」，量级可忽略；如要严谨，可把第 3 步挪到第 5 步之后并接受
「删成功但哈希没写」的反向风险 —— 建议维持现顺序。

### 5.2 admin client

仓库还没有 Supabase admin client，但 service role key 已经在用
（`SERVICE_ROLE_KEY ?? SUPABASE_SECRET_KEY`，见 [r2/client.ts:51](../../../src/lib/r2/client.ts:51)）。

新建 `src/lib/supabase/admin.ts`，导出一个惰性单例。**只能在 server-only 模块引用**，
文件头写清「此 client 绕过一切 RLS 与用户边界，任何调用点必须先过授权闸」。

### 5.3 新人币闸

`handle_new_user` trigger 用列默认值（`gold_balance` 100 / `silver_balance` 200）建行。
闸放在应用层而非 trigger 里：[auth/actions.ts](../../../src/lib/auth/actions.ts) 的
`signupAction` 在 `signUp` 成功后，若邮箱 HMAC 命中 `deactivated_email_hashes`，
把两个余额 UPDATE 成 0。

放应用层的理由：pepper 留在 app env 里，不用为了 trigger 去配 `current_setting` 级别的
DB 参数；也更好写单测。

---

## 六、孤儿会话的可见度（待确认）

`character_id` 变 null 之后，会话行和消息行都在，但**现有聊天页开不了它** ——
`LoadedConversation` 要求 `character: Character` 非空，system prompt / 正则规则 /
开场组件 / 角色 CSS 全部依赖角色行。兜底 null 不是加几个 `?.` 能解决的。

三档可见度，工程量差一个数量级：

- **A. 只留库，UI 全过滤** —— 数据不丢，用户看不见。最省。
- **B.（建议）列表灰条** —— 会话列表里显示为「角色已注销」的不可点条目，点击不进聊天页。
  用户知道记录还在、只是不能继续。工程量小。
- **C. 只读历史查看器** —— 新做一个降级页面，纯渲染消息、无输入框、无正则/CSS。
  最人道，但是一个完整新页面。

**已定：B。** 实现上几乎没花成本 —— 仓库里「角色被作者改成私密」早就有一套灰条 UI
（`accessible` 标记 + `inaccessibleHint` 文案），孤儿会话只是给同一个闸加了一种成因，
判据抽进 `src/lib/sessions/access.ts` 并补了单测，文案换成「创作者已注销」。
C 留到后续迭代。

无论选哪档，这几个 `innerJoin` 都会**静默丢行**，必须逐个审计改成 `leftJoin` + 兜底：

| 位置 | 现状 |
|------|------|
| [sessions/queries.ts:50](../../../src/lib/sessions/queries.ts:50) | `listSessionsForUser` innerJoin characters（侧栏 / 最近会话的源头） |
| [wallet/queries.ts:196](../../../src/lib/wallet/queries.ts:196) | 聊天用量统计 innerJoin characters |
| [creator/rebate.ts:132](../../../src/lib/creator/rebate.ts:132) | 返利结算 innerJoin —— 孤儿会话不应再产生返利，此处**保持 innerJoin 是正确的**，但要写注释说明是有意为之 |
| [admin/recharge.ts:320](../../../src/lib/admin/recharge.ts:320) | 已是 leftJoin，确认下游兜底 null |

---

## 七、UI

### 7.1 设置页危险区

[/settings](../../../src/app/settings/page.tsx) 底部新增「危险操作」区块，与签退按钮分开。
遵循 DESIGN.md：`--semantic-error` 走边框与文字，不做大红实心块（暗紫黑底上过刺眼）。

### 7.2 确认弹窗

必须逐条列出后果，勾选/输入确认后才可提交：

- 账号、个人资料、全部聊天记录与消息**立即永久删除，不可恢复**
- 你创建的角色卡与美化包一并删除；**别人跟你角色卡的对话会保留但无法继续**
- 订阅了你美化包的创作者，其角色卡会失去这些视觉与正则
- 未使用的金币 / 银两与月卡权益随账号失效，不退款不折算（使用者協議 9 章已写明）
- 付款订单出于税务与对账义务保留，但不再关联到你
- 邮箱会被释放，可以重新注册，但**新人币只发一次**
- 二次确认：输入密码（同时充当身份复核，见 §5.1 第 2 步）

### 7.3 落地

`/signin?deleted=1` 显示一句「账号已注销」。不做挽留文案。

### 7.4 i18n

`Dict` 被 `i18n-dictionaries.test.ts` 强制逐叶对齐，新增文案要同步 **5 个文件**：
`zh.ts`（作者化源头）、`zh-TW.ts` / `ja-JP.ts` / `th-TH.ts` / `en.ts`。

---

## 八、法律文书同步

三条不能绕过的约定见 [docs/handover/legal-agreements.md](../../handover/legal-agreements.md)。
**正本是日文版，先改 `ja-JP` 再同步其余三份。**

需要改的地方：

1. **隐私政策 9.2** —— 现在写的是「账号注销请发邮件到 support@dearm.ai」。上线自助注销后
   这句话变成事实错误，改为指向设置页。
2. **隐私政策 8.2 / 使用者協議 4.6** —— 30 日清理的表述与本方案（即时删除）方向一致，
   核对措辞即可。两处必须保持一致（handover 文档点名的耦合点）。
3. **新增披露**：注销后保留「不关联任何内容的邮箱哈希」用于防止重复领取新人奖励。
   这是一条新的数据保留事实，属于必须披露的范畴。
4. `LEGAL_EFFECTIVE_DATE_ISO` 与四个文件里的 `effectiveDate` 一起推。

另：使用者協議 4.6 的第三条例外（*"the data has been irreversibly anonymised and can no
longer be linked to you"*）在硬删方案下用不上了 —— 那是上一版「保留聊天记录」方案的法律
依据。条款本身不用删，但别再拿它当保留数据的挡箭牌。

---

## 九、测试

`bun test`，跟着 pre-commit 跑。

- 级联完整性：建一个带角色卡 / 会话 / 消息 / 订单 / 收藏的用户，删号后逐表断言归零
- **不连坐**：用户 B 跟用户 A 角色卡的会话，在 A 注销后仍存在，且 `character_id IS NULL`
- `payment_orders` 行仍在且 `user_id IS NULL`
- 邮箱 HMAC 落表；同邮箱重注册时余额为 0
- 授权闸：未登录 / 换个 userId 调 `deleteAccountAction` 必须拒绝
- 口令复核失败时不执行任何删除
- 法律文书跨语言结构对齐（已有 `legal-documents.test.ts`，改完会自动挂）

---

## 十、分期

| 期 | 内容 | 状态 |
|----|------|------|
| P1 | 三处 schema 改动（合并为 `drizzle/0042_account_deletion.sql`）+ `supabase/admin.ts` + `deleteAccountAction` + 设置页危险区 + i18n ×5 | ✅ |
| P2 | `innerJoin` 审计 + 孤儿会话灰条（方案 B）+ Stripe webhook 无主订单分支 + 两个聊天路由的扣费前早退 | ✅ |
| P3 | 隱私政策四语言同步（8.2 / 9.2 / 9.3）+ 生效日期推到 2026-08-09 | ✅ |
| P4 | 双份文档 + `.env.example` / `.env.cloud.example` 补 `ACCOUNT_DELETION_EMAIL_PEPPER` | ✅ |
| 后置 | Storage 孤儿对象巡检脚本；无主订单的人工退款后台入口；只读历史查看器（方案 C） | ⏳ |

三个 migration 最终合成了一个文件（同一个功能、要一起生效）。原始外键是内联无名定义的，
实际约束名是 Postgres 生成的 `_fkey` 而非 drizzle snapshot 里的 `_fk`，所以迁移从
`pg_constraint` 反查后再 DROP —— 这一点在写之前没预料到。

**已验证**：在本地一次性 scratch 库上跑过夹具 + 0042，确认「删创作者 → 他的角色卡没了 →
别人的会话与消息还在且 `character_id IS NULL` → 订单还在且 `user_id IS NULL` →
新表 RLS 为 on」。验证完即 drop。

**上线前还要做的**：按隱私政策第 11 章，「行使权利的方式发生显著变化」属于重大变更，
需要站内公告 / 弹窗 / 邮件的显著告知 —— 这是产品动作，不在代码里。
