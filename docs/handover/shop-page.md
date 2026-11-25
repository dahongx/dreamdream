# Shop Page (/shop) — 商城技术交接

> 产品视角：[../insights/shop-page.md](../insights/shop-page.md)
> 设计参考：`/tmp/page/1.jpg` / `/tmp/page/2.jpg`（竞品月卡页对标）

## 路由 + 文件清单

| 文件 | 角色 |
|------|------|
| `src/app/shop/page.tsx` | RSC 入口；fetch 用户会员状态 + 当日签到状态，未登录跳 `/signin?next=/shop` |
| `src/components/shop/ShopPageClient.tsx` | 客户端总容器；管月卡 / 直购顶层 tab，处理「提升收益」按钮的页内滚动 |
| `src/components/shop/MembershipStatusCard.tsx` | 三档 lock/unlock 状态卡，左 |
| `src/components/shop/DailyClaimCard.tsx` | 每日银两展示卡 + 提升收益 CTA，右 |
| `src/components/shop/PlanRecharger.tsx` | 月卡充值区：3 档 tab + 价格卡 + 订阅按钮 + 权益对比表 |
| `src/lib/membership/constants.ts` | tier 枚举 + 三档权益 + 普通用户权益 + 派生常量 |
| `src/lib/membership/queries.ts` | `getUserMembership(userId)` → `{ tier, expiresAt, active }` |
| `src/lib/membership/actions.ts` | `subscribeToTier(tier)` server action：写库 + 发瞬时银两 + revalidate |
| `drizzle/0031_user_membership.sql` | users 表加 `membership_tier` + `membership_expires_at` |
| i18n: `src/i18n/zh.ts` / `en.ts` / `types.ts` | 新增 `dict.shop.*` |

## 数据模型

```sql
ALTER TABLE users
  ADD COLUMN membership_tier TEXT,                    -- 'gold' | 'platinum' | 'diamond' | NULL
  ADD COLUMN membership_expires_at TIMESTAMP WITH TIME ZONE;
```

未购买 / 已过期 → `tier IS NULL OR expires_at < now()`，应用层都按未订阅处理。
半结构化方案，不保留升级历史；要审计走 `currency_transactions`。

## 三档参数（`constants.ts` 单一来源）

| Tab 位 | 展示名 | 内部键 | 价格 | 立即银两 | 每日银两 | 无限存档 | 无队列 | 无限面具 | 记忆加成 |
|--------|--------|--------|------|---------|---------|---------|--------|---------|---------|
| 左 | 黄金会员 | gold | $4.99 | 900 | 90 | ✓ | ✓ | ✗ | ✗ |
| **中** | 钻石会员 | platinum | **$19.9** | 6400 | 30 | ✓ | ✓ | ✓ | ✓ |
| 右 | 铂金会员 | diamond | $9.9 | 2700 | 30 | ✓ | ✓ | ✓ | ✓ |
| — | 普通（参照） | — | — | 0 | 30 | ✗ | ✗ | ✗ | ✗ |

⚠️ **展示名与内部键名是反的**：内部 `platinum` 对应展示「钻石会员」，内部 `diamond` 对应展示「铂金会员」。改 tier 名前先看 `src/lib/membership/actions.ts:tierLabel`。

⚠️ **最贵的「钻石会员」放在中间 tab 位**（同类平台惯用的 high-tier-middle）—— 不是价格升序排布。视觉上左边便宜入门 / 中间最贵主推 / 右边中档备选，刻意做成「中间是 hero pick」。改 `TIER_ORDER` 前要意识到这点。

⚠️ 「立即银两」「每日银两」非线性 —— 黄金的每日加成最大，中间档（钻石 $19.9，内部 platinum）的瞬时奖励最厚。这是产品 spec 的运营策略，不是 bug。

## 订阅 action 行为

`subscribeToTier(tier)`：
1. 同档续费叠加 expiresAt；跨档 / 已过期都从 now 起算 30 天
2. 一次性给 `silver_balance` 加 `instantSilver`
3. 写一条 `currency_transactions(transaction_type='recharge', note='订阅XXX月卡')` 流水
4. revalidate `/shop` `/me` `/settings`

⚠️ **v1 没有真实付款链路**。当前 action 对任何已登录用户开放，等同于「免费开通」。上生产前必须二选一：
- 改为 `requireAdmin()`，仅供 admin 后台手动开通
- 换成 Stripe / 苹果内购的 webhook 回调，把 action 拆成内部函数

## selector 契约（按 CLAUDE.md `nj_*` 前缀约定）

- `#nj_shop_top_tabs` — 月卡 / 直购顶层 tab
- `#nj_shop_membership_status` — 状态卡
- `#nj_shop_daily_claim` — 每日领取卡
- `#nj_shop_recharge_banner` — 「月卡充值」分隔条
- `#nj_shop_plan_recharger` — 月卡充值容器（也是「提升收益」滚动锚点）
- `#nj_shop_plan_tabs` — 3 档二级 tab
- `#nj_shop_plan_card` — 当前选中档的价格卡
- `#nj_shop_comparison_table` — 权益对比表

## 视觉契约（DESIGN.md）

- hero 衬线大标题（3xl 「商城」）
- glass-card 卡片
- 订阅按钮：紫→洋红 gradient
- 表格选中列：accent-primary 8% bg + accent-primary 字色

## 部署注意

[[restart-vs-deploy-script]]：`restart.sh` 不会重建 migrate 镜像 —— 新增 `drizzle/0031_user_membership.sql` 必须走 `deploy.sh` 才会执行。

## 已知 follow-up

- 订阅按钮接入实际支付（Stripe / 苹果内购）
- 直购 tab 实装（一次性买银两包）
- 权益落地：高峰队列 / 无限存档 / 无限面具 / 记忆加成 currently 只在表里写明，业务侧未读取 `membership_tier`
- 每日签到上限按 `membership_tier` 动态调整：`claimDailySilver` 目前固定 30，需要改成读 `TIER_SPECS[tier].benefits.dailySilver`
- admin 后台加「手动开通会员 / 调整到期日」工具（参 [[../handover/admin-recharge.md]] 模式）
