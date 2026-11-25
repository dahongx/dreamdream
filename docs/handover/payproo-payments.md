# 技术交接：PayProo 支付

> 产品思考见 [insights/payproo-payments.md](../insights/payproo-payments.md)。

## 接入范围

Dearm 现在支持通过 `PAYMENT_PROVIDER` 在 Stripe 与 PayProo 之间切换。默认仍是
Stripe；设置 `PAYMENT_PROVIDER=payproo` 后，月卡和金币包使用 PayProo 收单接口。
`PAYPROO_REGION=hk` 使用香港 HKD；`PAYPROO_REGION=tw` 使用台湾 TWD。

PayProo 文档确认的接口：

- 测试：`https://api.payproo.tech`
- 生产：`https://api.payproo.com`
- 下单：`POST /hkd/collect/apply`
- 台湾下单：`POST /twd/collect/apply`
- 查询：`POST /hkd/collect/query`（台湾切换时使用对应 TWD 查询接口）
- 签名：2048 位 `SHA256WithRSA`
- 香港支付方式：`WECHAT`、`ALIPAY`、`OCTOPUS`
- 台湾支付方式：`BANKTRANSFER`、`OTC_STORE`、`JKOPAY`、`CREDIT_CARD`、`APPLEPAY`

## 代码链路

```
/shop
  → src/lib/payments/checkout.ts
  → src/lib/payproo/checkout.ts
  → payment_orders(status='pending')
  → PayProo /hkd/collect/apply 或 /twd/collect/apply
  → 返回 payUrl，浏览器跳转

PayProo 异步通知
  → POST /api/payproo/webhook
  → 验签 + 核对 appId / 币种 / 商户订单号 / 金额
  → FOR UPDATE 锁订单
  → grantMembership() 或 rechargeGold()
  → payment_orders 翻 paid
  → 返回纯文本 SUCCESS
```

前端回跳只用于轮询 `/api/payproo/order-status?order_id=...`，不参与发货判断。

## 环境变量

见根目录 `.env.example`：

- `PAYMENT_PROVIDER`：`stripe` 或 `payproo`
- `PAYPROO_ENVIRONMENT`：`test` 或 `production`
- `PAYPROO_REGION`：`hk` 或 `tw`；台湾使用 TWD 下单
- `PAYPROO_BASE_URL`：可选，自定义测试/生产 API 地址
- `PAYPROO_APP_ID`：PayProo 后台业务 ID
- `PAYPROO_PAY_TYPE`：香港通常为 `EWALLET`，台湾可为 `VA`、`OTC`、`EWALLET` 或 `CARD`
- `PAYPROO_MERCHANT_SECRET_KEY`：后台加密字段，用于拼接签名原文
- `PAYPROO_MERCHANT_PRIVATE_KEY`：商户自己的 RSA 私钥，只保存在服务器环境变量
- `PAYPROO_PLATFORM_PUBLIC_KEY`：PayProo 平台公钥，用于验签响应与通知
- `PAYPROO_PAY_MODEL`：香港为 `ALIPAY`、`WECHAT`、`OCTOPUS`；台湾为
  `BANKTRANSFER`、`OTC_STORE`、`JKOPAY`、`CREDIT_CARD` 或 `APPLEPAY`

私钥可以在 `.env` 中使用 `\\n` 表示换行。不要把真实私钥提交到 Git，也不要
把真实密钥发送到聊天窗口。

## PayProo 后台配置

需要在 PayProo 业务配置中完成：

1. 上传 Dearm 商户 RSA 公钥。
2. 配置服务器出口 IP 白名单。
3. 收单异步回调地址：
   `https://dearm.ai/api/payproo/webhook`
4. 开通使用的 `PAYPROO_PAY_TYPE / PAYPROO_PAY_MODEL` 组合。当前台湾测试配置为
   `CARD / CREDIT_CARD`；测试价格沿用原数字，但按 TWD 整数下单。
5. 测试环境与生产环境分别配置，不能混用。

PayProo 文档要求下单回跳地址以 `http://` 或 `https://` 开头；代码使用
`NEXT_PUBLIC_APP_URL` 构造 `/shop?pay=success&order_id=...`。

## 订单与幂等

`payment_orders` 新增：

- `provider`：支付渠道
- `merchant_order_id`：Dearm 商户订单号，PayProo 请求/回调/查询的唯一关联键
- `payproo_order_no`：PayProo 平台订单号
- `package_id` / `gold_amount`：金币包履约所需的本地商品快照

迁移文件为 `drizzle/0046_payproo_payment_orders.sql`。PayProo 回调使用事务内
`SELECT ... FOR UPDATE`，已 `paid` 的订单直接 no-op，避免重复发货。

台湾付款要求用户资料里有手机号；迁移 `drizzle/0047_user_phone.sql` 给 `users`
增加可选 `phone` 字段。只有台湾 PayProo 下单前会强制校验邮箱和手机号。

## 联调验收

1. 配置测试环境变量和测试后台回调地址。
2. 设置 `PAYMENT_PROVIDER=payproo`，启动 `bun run dev`。
3. 选择月卡和金币包，确认浏览器跳转接口返回的 `payUrl`。
4. 验证 `payment_orders` 先为 `pending`，回调验签成功后为 `paid`。
5. 验证会员、金币余额和 `currency_transactions` 只增加一次。
6. 重放同一回调，确认不会重复发货。
7. 测试支付失败通知，确认订单变为 `failed`。
8. 生产切换前替换全部测试 appId、密钥、平台公钥、IP 白名单和回调配置。
