# 技术交接 —— 账号注销（硬删除）

> 产品思考见 [docs/insights/account-deletion.md](../insights/account-deletion.md)。
> 设计与决策过程见 [docs/exec-plans/completed/account-deletion.md](../exec-plans/completed/account-deletion.md)。

用户在 `/settings` 底部的危险区自助注销。**立即执行、不可撤销、无冷静期。**

---

## 一句话架构

```ts
await admin.auth.admin.deleteUser(userId)
```

`drizzle/0011` 给 `public.users.id` 加了 `REFERENCES auth.users(id) ON DELETE CASCADE`，
业务侧 20+ 张表又全部 `ON DELETE CASCADE` 挂在 `public.users` 上。所以删掉 GoTrue 的
身份行，Postgres 会在**同一个事务里**把这个人的一切带走。

其余代码全部在处理级联够不到、或者删过头的地方。**改任何注销相关代码前先想清楚
自己是在跟这条级联链合作还是对抗。**

---

## 文件地图

| 路径 | 作用 |
|------|------|
| `src/lib/account/actions.ts` | `deleteAccountAction` —— 注销主流程，六步顺序有讲究 |
| `src/lib/account/email-hash.ts` | 已注销邮箱的 HMAC 指纹（纯函数，可单测） |
| `src/lib/account/new-user-grant.ts` | 重注册时不再发新人币的闸 |
| `src/lib/supabase/admin.ts` | service role client（绕过一切 RLS，调用点必须自带授权闸） |
| `src/lib/r2/client.ts` | `deleteUserUploads()` —— 按前缀清对象存储 |
| `src/lib/sessions/access.ts` | 「这段会话还打得开吗」的唯一判据（含孤儿会话） |
| `src/components/settings/DeleteAccountSection.tsx` | 危险区 UI + 后果清单 + 密码复核 |
| `drizzle/0042_account_deletion.sql` | 两处 FK 放宽 + `deactivated_email_hashes` |
| `src/lib/__tests__/account-email-hash.test.ts` | 指纹的稳定性 / pepper 生效 / fail-closed |
| `src/lib/__tests__/session-access.test.ts` | 孤儿会话可见但不可点 |

---

## 六步顺序（每一步为什么在那个位置）

1. `getCurrentUserId()` —— 授权闸。
2. **口令复核**：用**另起的** `@supabase/supabase-js` client（`persistSession: false`）调
   `signInWithPassword`。不能用 `@/lib/supabase/server` 的 `createClient()` —— 它绑着
   cookieStore，登录成功会把会话 cookie 整个重写，等于在注销流程里悄悄换发一张新票。
3. **写邮箱指纹**。必须在删之前 —— 删完就再也拿不到这个邮箱了。
4. **删 Storage 前缀**。必须在 `deleteUser` 之前：反过来若账号删成功、图片删失败，
   照片留在 public bucket 里，而且**此后再没有任何记录能指向它去清理**。正着来最坏
   只是「账号还在但头像碎了」，重传即可自愈。单个对象删失败不阻断注销，记日志继续。
5. `admin.auth.admin.deleteUser(userId)` —— 级联主体。
6. `signOut({ scope: 'local' })` 清 cookie，然后 `redirect('/signin?message=accountDeleted')`。
   放在删除**之后**：不可逆那步失败时用户应该还登录着、能看见错误。就算这步漏了也能
   自愈 —— proxy 的 `getUser()` 对失效 token 会 catch 成「未登录」跳登录页。

---

## 三个 schema 改动

### `chat_sessions.character_id` → 可空 + `SET NULL`

**这条是整个功能里最容易理解错的地方。** 创作者注销会删掉他的角色卡，而
`chat_sessions.character_id` 原本是 CASCADE —— 那会把**其他用户**跟这些卡的
对话记录一起删掉。别人的聊天记录不是注销者的数据，不能连坐。

改成 SET NULL 之后这些会话变「孤儿」：数据完整保留，列表里以灰条呈现，点不进去
（没有角色行就没有 system prompt / 正则 / 开场组件 / 角色 CSS）。

`chat_sessions_user_char_current_uidx` 无需改动 —— Postgres 的 unique 语义把多个
NULL 视作互不相等，孤儿会话之间不冲突。

### `payment_orders.user_id` → 可空 + `SET NULL`

隐私政策 8.2 写明「交易与对账记录按适用税法要求保留」，日本帐簿书类另有保存义务。
人删了，金额 / `stripe_session_id` / 时间要留着能对账。

### `deactivated_email_hashes`

只有 `email_hash` + `deactivated_at` 两列。**刻意不含 user_id、不与任何内容表关联** ——
注销是硬删除，这张表是全库唯一残留物；一旦它能指回任何内容行，「注销即删干净」
就不成立了。

值是 `HMAC-SHA256(ACCOUNT_DELETION_EMAIL_PEPPER, lower(trim(email)))`。用 HMAC 而非
裸 SHA256：邮箱空间小到可以字典枚举，裸哈希等于明文。

⚠️ 原始外键是在 `0000_initial` / `0033` 里**内联无名**定义的（`uuid NOT NULL REFERENCES …`），
实际约束名由 Postgres 生成（`<table>_<column>_fkey`），不是 drizzle snapshot 里记的
`_fk` 名。0042 因此不写死名字，从 `pg_constraint` 反查后再 DROP，重建时补显式名。
**以后再动这两个外键可以直接用新名字了。**

---

## 会波及第三方的连带（已知且接受）

- **别人订阅了注销者的美化包** → `character_pack_subscriptions` 随包一起删，对方的
  角色卡当场掉 CSS / 正则 / 开场组件。卡本身不受影响。危险区文案里有提示。
- **别人在注销者角色卡下的评论 / 收藏 / 点赞** → 随卡一起删。
- **别人的账本行** → `currency_transactions` 保留（`session_id` / `message_id` 本来就是
  SET NULL），但钱包 UI 里那笔消费显示不出角色名。
- **admin 操作痕迹** → 注销者若是 admin，`invite_codes.created_by` /
  `model_prices.updated_by` / `currency_transactions.operator_id` 变 null，审计断链。

---

## 环境变量

| 变量 | 说明 |
|------|------|
| `SERVICE_ROLE_KEY` 或 `SUPABASE_SECRET_KEY` | admin client 用，与 Storage 上传同一个 |
| `ACCOUNT_DELETION_EMAIL_PEPPER` | 邮箱指纹的 HMAC 密钥，`openssl rand -hex 32` |

**pepper 一旦上线就不能再改**：改了历史指纹全部对不上，所有注销过的邮箱都能重新领
一次新人币。没设置时注销流程直接失败（`hashDeactivatedEmail` 抛错）—— 刻意 fail-closed，
不静默降级成可反查的裸哈希。

---

## 踩过 / 差点踩的坑

1. **先扣费后发现角色没了。** `api/chat` 与 `api/chat/continue` 原本在 `deductCurrency`
   之后才查角色，孤儿会话会走到「先扣钱、再报 Character missing」。已在两处的
   session 授权闸后面加 `characterId === null` 早退。
2. **`innerJoin characters` 静默吞行。** `listSessionsForUser`（侧栏 + /sessions 的源头）
   和 `wallet/queries.ts` 的用量统计都要改 `leftJoin`，否则孤儿会话与其花过的钱从
   界面上凭空消失，用户看到的跟「记录被删了」没区别。
   `creator/rebate.ts` 的 innerJoin **保持不变是对的** —— 角色和作者都没了，那些消耗
   不该再产生返利，也没有 owner 可以入账；代码里加了显式 `continue` 说明是有意为之。
3. **`key={s.characterId}`。** 侧栏列表原本拿 characterId 当 React key，孤儿会话全是
   null 会整片撞在一起。改成 `key={s.id}`。
4. **`/chat` 与 `/chat/[characterId]` 的落地跳转。** 原本取 `sessions[0].characterId`，
   最近一条是孤儿会话时会跳到 `/chat/null`。改成找第一条 `accessible` 的。
5. **Stripe webhook 的无主订单。** 建单到履约之间用户注销了，`fulfillOrder` 会拿到
   `user_id IS NULL` 的订单。三件事都不能做错：不能 throw（webhook 500 会让 Stripe
   一直重投）、不能发货（没有 user）、不能标 paid 或 failed（钱是真收了，货是真没发，
   两个状态都在说谎）。现在的做法是补回 PaymentIntent / 金额供人工退款，状态留
   pending，`console.error` 记一条。

---

## 待办 / 已知缺口

- **无主订单需要人工退款**，目前只有日志，没有后台入口。量小可以先靠日志盯。
- **只读历史查看器**没做。孤儿会话现在只能在列表里看到标题和预览，点不开完整记录。
- **新人币闸在「Auth 与业务库不同实例」的部署形态下会漏** —— 那种形态里
  `handle_new_user` trigger 跨不了库，users 行由 `ensureUserRow` 在首次访问时才建，
  注册时的 UPDATE 会匹配 0 行（有 `console.warn`）。当前云端部署是同实例，不受影响。
- **Storage 孤儿对象巡检脚本**没写。第 4 步失败时对象会留下，目前只有日志。
