# 货币配置不一致问题分析

## 问题描述

- **计费配置页面**：显示金币 0，银币 1
- **对话页面**：显示金币 1，银币 2

## 根本原因

根据代码分析，发现了 **fallback 机制** 导致的不一致：

### 1. 数据库查询路径（计费配置页面）

`src/components/settings/AdminCurrencyPricingSection.tsx` → 直接显示数据库中的值

```typescript
// 直接从数据库读取并显示
<td className="text-right text-amber-500">{row.goldPrice}</td>
<td className="text-right text-slate-400">{row.silverPrice}</td>
```

**显示结果：数据库中的实际值（0/1）**

### 2. 对话页面查询路径

`src/components/chat/CurrencySwitcher.tsx` → `/api/currency/model-costs` → 数据库

**但在 `src/lib/billing/currency.ts` 中有 fallback 逻辑：**

```typescript
// src/lib/billing/currency.ts:21-24
const price =
  currencyType === "gold"
    ? (priceRow?.goldPrice ?? 1)  // ❌ fallback 默认值：金币 1
    : (priceRow?.silverPrice ?? 2); // ❌ fallback 默认值：银币 2
```

**当数据库查询失败或返回空时，使用 fallback 值（1/2）**

## 可能的原因

### 情况 A：modelId 不匹配

数据库中存储的 modelId 与对话页面使用的 modelId 不一致，导致查询不到配置，使用了 fallback。

**验证方法：**
1. 检查计费配置页面中显示的 modelId
2. 检查对话页面实际使用的 modelId（打开浏览器开发者工具，查看 `/api/currency/model-costs` 的返回值）

### 情况 B：API 查询失败

`/api/currency/model-costs` 查询数据库失败，返回空结果，CurrencySwitcher 显示 fallback 值。

**验证方法：**
1. 打开浏览器开发者工具 → Network 标签
2. 刷新对话页面
3. 查看 `/api/currency/model-costs` 请求
4. 检查返回的 JSON 数据

### 情况 C：前端缓存

CurrencySwitcher 在组件挂载时只 fetch 一次数据（useEffect 依赖为空数组），如果在修改配置前就打开了对话页面，会一直显示旧值。

**验证方法：**
1. 在计费配置页面修改价格后
2. **强制刷新**对话页面（Ctrl+Shift+R 或 Cmd+Shift+R）
3. 检查是否更新

## 推荐解决方案

### 方案 1：移除 fallback（推荐）

**问题：** fallback 值掩盖了数据库配置缺失的问题

**修复：** 移除 fallback，强制使用数据库值

```typescript
// src/lib/billing/currency.ts
const price =
  currencyType === "gold"
    ? priceRow?.goldPrice
    : priceRow?.silverPrice;

if (price === undefined) {
  throw new Error(`No currency price configured for model: ${modelId}`);
}
```

### 方案 2：统一默认值

**问题：** fallback 值（1/2）与数据库配置（0/1）不一致

**修复：** 将 fallback 改为与数据库一致

```typescript
// src/lib/billing/currency.ts
const price =
  currencyType === "gold"
    ? (priceRow?.goldPrice ?? 0)  // 改为 0
    : (priceRow?.silverPrice ?? 1); // 改为 1
```

### 方案 3：诊断工具

运行以下命令检查数据库实际情况：

```bash
# 在主项目目录（非 worktree）运行
cd /root/projects/yearn-chat
bun --eval "
import { db } from './src/lib/db/client';
import { modelCurrencyPrices } from './src/lib/db/schema';
const prices = await db.select().from(modelCurrencyPrices);
console.table(prices);
"
```

或者在浏览器中检查 API 返回值：
1. 打开对话页面
2. F12 打开开发者工具 → Network
3. 找到 `/api/currency/model-costs` 请求
4. 查看 Response 内容

## 下一步行动

1. **确认问题类型**：使用浏览器开发者工具检查 `/api/currency/model-costs` 的返回值
2. **验证数据库**：确认数据库中所有模型的配置都是 0/1
3. **选择方案**：根据产品需求选择上述方案之一
4. **测试验证**：修复后在对话页面强制刷新验证

## 相关文件

- `src/lib/billing/currency.ts` - 包含 fallback 逻辑
- `src/app/api/currency/model-costs/route.ts` - API 端点
- `src/components/chat/CurrencySwitcher.tsx` - 对话页面货币显示
- `src/components/settings/AdminCurrencyPricingSection.tsx` - 计费配置页面
- `drizzle/0025_model_currency_prices.sql` - 初始 migration（默认 1/2）
