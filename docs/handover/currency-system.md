# 货币体系实现文档

## 概述

完成了金币 + 银币双币种货币体系的完整实现，包括数据库设计、后端逻辑、API 接口和前端 UI。

## 数据库设计（Migration 0024）

### 1. 扩展 `users` 表
```sql
ALTER TABLE users ADD COLUMN gold_coins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN silver_coins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN last_daily_claim_date DATE;
```

### 2. 扩展 `model_prices` 表
```sql
ALTER TABLE model_prices ADD COLUMN gold_cost_per_call INTEGER NOT NULL DEFAULT 0;
ALTER TABLE model_prices ADD COLUMN silver_cost_per_call INTEGER NOT NULL DEFAULT 0;
```

### 3. 新增 `currency_transactions` 表
记录所有货币变动，包括：
- `transaction_type`: daily_claim(每日领取) / recharge(充值) / model_usage(模型消耗)
- `currency_type`: gold(金币) / silver(银币)
- `amount`: 变动数量（正数增加，负数减少）
- `balance_after`: 交易后余额快照
- `model_id`: 关联的模型 ID（仅 model_usage）
- `message_id`: 关联的消息 ID（仅 model_usage）

### 初始化数据
- 所有模型默认设置：银币 1 枚/次，金币 0
- 所有现有用户初始赠送 100 银币

## 核心功能实现

### 1. 每日登录领取银币（`src/lib/currency/transactions.ts`）
- `claimDailySilver()`: 每天最多领取一次，每天 0 点刷新
- 每次领取 30 银币
- 使用数据库事务 + 行锁防止并发重复领取

### 2. 模型调用扣费（集成到 `/api/chat/route.ts`）
- 调用前检查用户余额
- 优先使用银币，银币不足时使用金币
- 扣费失败返回 402 状态码，并回滚已扣除的配额
- 记录交易到 `currency_transactions` 表

### 3. 充值金币（`rechargeGold()`）
- 预留接口，稍后实现充值页面时调用

### 4. 查询功能
- `getUserBalance()`: 查询用户货币余额和领取状态
- `getUserTransactions()`: 查询用户交易记录

## API 接口

### GET `/api/currency/balance`
查询用户货币余额
```json
{
  "gold": 0,
  "silver": 130,
  "canClaimToday": true,
  "lastClaimDate": "2026-06-25"
}
```

### POST `/api/currency/claim-daily`
每日登录领取银币
```json
{
  "claimed": true,
  "amount": 30,
  "newBalance": 160,
  "message": "成功领取 30 银币"
}
```

### GET `/api/currency/transactions?limit=50&offset=0`
查询交易记录
```json
{
  "transactions": [
    {
      "id": "...",
      "transactionType": "daily_claim",
      "currencyType": "silver",
      "amount": 30,
      "balanceAfter": 160,
      "modelId": null,
      "note": "每日登录领取",
      "createdAt": "2026-06-26T10:00:00Z"
    }
  ]
}
```

## 前端 UI

### 1. 个人主页货币 Tab（`src/components/me/CurrencyWallet.tsx`）
- 显示金币和银币余额
- 每日领取银币按钮（已领取时禁用）
- 交易记录表格，包含：
  - 时间
  - 类型（每日登录 / 充值 / 模型名）
  - 数量（正数绿色，负数红色）
  - 余额

### 2. 个人主页 Tab 结构更新（`src/components/me/ProfileTabs.tsx`）
- 从双 tab（钱包 / 角色）改为三 tab（钱包 / 货币 / 角色）
- 货币 tab 展示完整的货币体系

### 3. 管理员计费配置页（`src/components/settings/AdminBillingSection.tsx`）
- 新增两列：🪙金币/次、🥈银币/次
- 管理员可为每个模型配置每次调用消耗的金币和银币数量
- 表单验证：整数、非负、上限 10000

## 技术细节

### 1. 数据库事务
所有货币操作使用事务确保一致性：
```typescript
return await db.transaction(async (tx) => {
  const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
  // 检查、扣费、记录
});
```

### 2. 并发控制
- 使用 `SELECT ... FOR UPDATE` 行锁
- 防止同一用户并发领取或扣费导致的数据不一致

### 3. 扣费策略
优先使用银币，银币不足时使用金币：
```typescript
if (user.silverCoins >= silverCost) {
  deductedSilver = silverCost;
} else if (user.goldCoins >= goldCost) {
  deductedGold = goldCost;
} else {
  return { success: false, message: "余额不足" };
}
```

### 4. 余额不足处理
- 模型调用前先检查并扣除货币
- 扣费失败时回滚已扣除的 quota
- 返回 402 Payment Required 状态码

## 后续开发

### 1. 充值页面（稍后开发）
- 调用 `rechargeGold()` 充值金币
- 集成支付网关

### 2. 货币消耗优化
- 根据模型价格和用户等级动态计算消耗
- 会员折扣机制

### 3. 货币赠送
- 管理员手动赠送
- 活动奖励

## 部署步骤

1. **运行迁移**
   ```bash
   bun run db:migrate
   ```

2. **验证表结构**
   - 检查 `users` 表新增字段
   - 检查 `model_prices` 表新增字段
   - 检查 `currency_transactions` 表创建成功

3. **配置模型消耗**
   - 访问 /admin?tab=billing
   - 为每个模型配置金币/银币消耗

4. **测试流程**
   - 用户登录 → 领取银币
   - 发起对话 → 自动扣费
   - 查看货币消耗记录

## 文件清单

### 数据库
- `drizzle/0024_currency_system.sql` - 迁移文件
- `src/lib/db/schema.ts` - 数据模型更新

### 后端逻辑
- `src/lib/currency/transactions.ts` - 货币交易核心逻辑
- `src/lib/billing/admin.ts` - 管理员计费配置更新

### API 接口
- `src/app/api/currency/balance/route.ts` - 查询余额
- `src/app/api/currency/claim-daily/route.ts` - 每日领取
- `src/app/api/currency/transactions/route.ts` - 交易记录
- `src/app/api/chat/route.ts` - 集成扣费逻辑

### 前端组件
- `src/components/me/CurrencyWallet.tsx` - 货币钱包组件
- `src/components/me/ProfileTabs.tsx` - 个人主页 Tab 更新
- `src/components/settings/AdminBillingSection.tsx` - 管理员计费配置更新
