# 技术交接 — Stripe 真实支付（月卡一次性买断）

> 产品视角见 [insights/stripe-payments.md](../insights/stripe-payments.md)。

## 做了什么

把 /shop 月卡从「免费占位」换成真实 Stripe Checkout 收款（卡 / 支付宝 / 微信），
履约由 webhook 驱动，并删除了对外开放的免费订阅漏洞。

## 链路

```
/shop 点订阅
  → createCheckoutSession(tier)            src/lib/stripe/checkout.ts ("use server")
      建 Checkout Session（mode:payment, USD, card+alipay+wechat_pay）
      写 payment_orders(status='pending')，返回 url
  → 前端 window.location = url             src/components/shop/PlanRecharger.tsx
  → Stripe 托管收银台 → 付款 → 跳回 /shop?pay=success&session_id=...

Stripe webhook（唯一履约信号）           src/app/api/stripe/webhook/route.ts
  checkout.session.completed / async_payment_succeeded (payment_status='paid')
    → fulfillOrder()：事务内 FOR UPDATE 订单 → grantMembership() → 翻 paid
  async_payment_failed / expired → markOrder()
  幂等：订单已 paid 直接 no-op

前端回跳处理                              src/components/shop/PaymentReturnHandler.tsx
  ?pay=success → 轮询 /api/stripe/order-status 到 paid → router.refresh()
  ?pay=cancel  → 提示未扣款
```

## 文件清单

| 文件 | 角色 |
|------|------|
| `src/lib/stripe/client.ts` | server-only Stripe 单例，缺 key 抛清晰错误 |
| `src/lib/stripe/checkout.ts` | `createCheckoutSession` server action（建单 + 返回 url） |
| `src/app/api/stripe/webhook/route.ts` | webhook：raw body 验签 + 幂等履约 |
| `src/app/api/stripe/order-status/route.ts` | 成功页轮询查单（userId 双过滤） |
| `src/lib/membership/grant.ts` | `grantMembership(tx,...)` 履约核心（**非 "use server"**，供 webhook + action 共用） |
| `src/lib/membership/actions.ts` | 旧免费 `subscribeToTier` 删除；改为 admin-only `adminGrantMembership` |
| `src/lib/db/schema.ts` + `drizzle/0033_payment_orders.sql` | `payment_orders` 表（订单 + 幂等锚点） |
| `src/components/shop/PlanRecharger.tsx` | 订阅按钮改走 Checkout 跳转 |
| `src/components/shop/PaymentReturnHandler.tsx` | 付款回跳处理（渲染 null 跑副作用） |
| `src/components/shop/ShopPageClient.tsx` | 挂载 PaymentReturnHandler |
| `src/i18n/{types,zh,en}.ts` | 新增支付状态文案 |

## 关键设计点

- **为什么 webhook 是唯一履约信号**：支付宝/微信是异步重定向型，前端跳回 ≠ 钱到账。
  绝不在 success_url 回调里发货。
- **幂等**：`payment_orders.stripe_session_id` UNIQUE + 事务内 `FOR UPDATE` + 已 paid no-op。
  Stripe 会重投事件，靠这个防重复发月卡。
- **grant.ts 不是 "use server"**：它接收不可序列化的 tx 句柄，不能当 server action。
  webhook（route handler）和 admin action 各自包 `db.transaction` 后调它。
- **币种 HKD**：账号是香港主体，微信只接受 hkd/cny，**USD 用不了微信**。三档 HK$30/68/128
  （`CURRENCY='hkd'` + `TIER_SPECS.priceHkd`，展示 `HK$`）。卡/支付宝/微信在 hkd 下都通过。
- ⚠️ **Adaptive Pricing 坑**：账号默认开了自适应定价 → Checkout 顶部有货币切换器，按访客
  地理位置选币种。US-geo 访客默认 USD，此时微信消失只剩卡；切到 HK$ 才出现支付宝+微信。
  上线前建议 Dashboard 关掉 Adaptive Pricing（强制用我们传的 HKD），或确认 CN-geo 访客会
  拿到 CNY（也支持这俩）。
- **只买断不订阅**：支付宝/微信不支持 Stripe 订阅模式，故月卡是一次性 30 天（续费叠加）。
- **账分两侧**：`payment_orders` 记支付侧；履约时仍写 `currency_transactions` recharge 行，
  现有账本 / admin ledger UI 不变。

## 环境变量

`.env.local`（见 `.env.example` 注释）：
- `STRIPE_SECRET_KEY` — sk_test_... / sk_live_...
- `STRIPE_WEBHOOK_SECRET` — `stripe listen` 或 Dashboard endpoint 的 whsec_...
- `NEXT_PUBLIC_APP_URL` — 回跳根地址（本地 http://localhost:3000，生产 https://dearm.ai）

## 迁移

`drizzle/0033_payment_orders.sql`（纯新增表，非破坏性）。本地 dev DB 用自定义 runner
`bun run db:migrate`（忽略 drizzle journal，扫 drizzle/*.sql 记 `__nimir_migrations`）。
本次因历史上 0031/0032 已手动 apply 但未记录，落地时一并补记了这两条 + 0033。

## 本地端到端测试

```
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook   # 拿 whsec_，写进 .env.local
bun run dev                                                     # next dev --webpack
```
1. /shop 选档订阅 → 收银台确认 card / 支付宝 / 微信都出现。
2. 测试卡 4242 4242 4242 4242；支付宝/微信在 test 模式点授权页 authorize。
3. 验：`payment_orders.status='paid'` + `users.membership_tier/expires_at` + `silver_balance`
   增加 + `currency_transactions` 多一行 recharge。
4. 幂等：`stripe trigger checkout.session.completed` 重放，确认不重复发货。

## 后续 / 未做

- 真订阅自动续费（与支付宝/微信互斥，需另起卡专属链路）。
- 退款链路（webhook `charge.refunded` → 反扣会员/银两）、发票收据页。
- 订阅到期 cron 提醒。
- 「直购」tab 仍是占位。
- `users.stripe_customer_id`（本次一次性付款用 customer_email 即可）。
- ⚠️ 上线前：Stripe 账号 Dashboard 启用 Alipay + WeChat Pay；账号注册地需支持
  （大陆主体一般不行，需境外/HK/SG 主体）。生产 webhook endpoint 在 Dashboard 配。
