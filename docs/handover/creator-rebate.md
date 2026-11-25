# 技术交接 · 创作者返利

> 产品思考见 [../insights/creator-rebate.md](../insights/creator-rebate.md)。

## 是什么

对标同类平台的「创作推广收益」。用户跟角色对话消耗金币、点赞、收藏、关注作者，按规则
返利给作者。每天早 8 点（Asia/Shanghai）遍历所有角色结算一次，形成收益记录 + 累加
到作者的独立「创作收益」余额。入口在 `/me` 第三个 tab「创作收益」。

## 返利规则（单一来源 `src/lib/creator/compute.ts` 的 `REBATE_RATES`）

| 维度 | 规则 | 基数口径 |
|------|------|----------|
| 对话 | 每消耗 **3 金币**返 **0.6**（20%） | **只算金币消耗**，银币不返；按 3 一档，余数结转 |
| 点赞 | 每 1 个净增点赞返 **1** | 累计总数净增量（防取消刷分） |
| 收藏 | 每 1 个净增收藏返 **1** | 同上 |
| 粉丝 | 每 1 个净增粉丝返 **3** | 账号级，非角色 |

## 数据模型（migration `0039_creator_rebate.sql`）

- `users.creator_earnings numeric(14,2)` — **独立收益余额**，与消费用的整数
  `gold_balance` 完全分离。返利只累加这里。未来若做「转换成金币」再单独实现。
- `creator_earning_records` — 收益详情 tab 数据源。一条 = 某角色某天某维度的进账；
  粉丝返利 `character_id = NULL`、`kind = 'fans'`。开了 RLS。
- `creator_character_cursors`（按角色）+ `creator_fans_cursors`（按作者）— **防刷/幂等
  游标**。存「上次结算时各累计���的快照」，每次只对正增量返利。

## 防刷 / 幂等机制（核心，别改错）

游标是高水位棘轮：
- **点赞/收藏/粉丝**：游标只增不减（`Math.max(snapshot, now)`）。取消再点，`now` 掉下去
  也不会退游标，涨回来 `delta=0` 不重复发。
- **对话金币**：游标只前进「已发档位」（`floor(delta/3)*3`），余数留到下次攒。例：8 金币
  发 2 档（1.2 金币）、游标推到 6，剩的 2 金币下次再算。
- **天然幂等**：同一时刻重复跑，第二次所有 delta=0，什么都不发。一天多跑安全。

⚠️ **首次上线必须先 seed**（把游标设成当前累计值、不发钱），否则第一次结算把全部历史
点赞/收藏/金币一次性补发。见下方部署。

## 代码结构

| 文件 | 职责 |
|------|------|
| `src/lib/creator/compute.ts` | **纯计算核心**（无 DB）：输入累计量+游标 → 输出进账明细+新游标。费率常量在此。 |
| `src/lib/creator/compute.test.ts`（`__tests__/`） | 18 个单元测试，覆盖余数结转/高水位防刷/浮点尾差。脱离 DB 验证算钱逻辑。 |
| `src/lib/creator/rebate.ts` | DB 编排：查 aggregate + 游标 → 调 compute → 一个事务落库（记录+余额+游标）。`runDailyRebate({dryRun})` / `seedCursors()`。 |
| `src/lib/creator/queries.ts` | 读侧：`getCreatorEarningsOverview`（余额+四项生涯数据）、`getCreatorEarningDetails`（流水）。 |
| `scripts/run-daily-rebate.ts` | 手动/定时入口。`--dry-run` / `--seed` / 真跑。 |
| `src/app/api/admin/rebate/run/route.ts` | admin 手动触发（POST，body `{dryRun?}`）。 |
| `src/components/me/CreatorEarningsPanel.tsx` | 收益 tab UI：总览子 tab（大数字+四格）+ 详情子 tab（角色/收益/时间三列）。 |

## 金币消耗怎么归到角色

`currency_transactions`（金币、`model_usage`、`amount<0`）→ `session_id` join
`chat_sessions` → `character_id`。美化包/图片扣费没有 `sessionId`，join 不到角色，
自然被排除——只有真正「跟这个角色对话」的金币消耗计入对话返利。

## 部署（关键顺序）

两个库独立（本地 dev = 云端 Supabase，生产 = 服务器 `supabase-db` 容器），迁移两边各跑。

**运行环境**：返利脚本（seed / 结算）跑在 **migrate 镜像**里——它有完整
`scripts/` + `node_modules` + `src/lib/{db,creator}`，且在 compose 网络内可达
`db:5432`。app（runner）镜像是 `.next/standalone`，没有原始脚本，跑不了。
migrate 是一次性服务（`restart: no`），用 `docker compose run --rm migrate <cmd>`
临时起一个跑完即弃。

**生产上线顺序（不可颠倒）：**
1. `docker compose build`（含 Dockerfile 改动：migrate 镜像新增 COPY src/lib/creator）。
2. 跑迁移：`docker compose run --rm migrate bun scripts/db-migrate.ts`
   （应用 0039 + 0040，建表 + 加列，非破坏性）。
3. **先 seed**：`docker compose run --rm migrate bun scripts/run-daily-rebate.ts --seed`
   （把游标对齐当前值，历史存量不补发）。**这步跳过 = 首次结算把全部历史一次性补发。**
4. dry-run 核对：`docker compose run --rm migrate bun scripts/run-daily-rebate.ts --dry-run`
   （刚 seed 完应几乎无进账）。
5. 重启 app 让新 UI 生效：`docker compose up -d --no-deps app`。
6. 挂 crontab（宿主机；容器内 TZ=Asia/Shanghai，宿主机时区若不同需换算到北京 8 点）：
   ```
   0 8 * * * cd /root/projects/yearn-chat && docker compose run --rm migrate bun scripts/run-daily-rebate.ts >> /var/log/dearm-rebate.log 2>&1
   ```

## 已验证 / 未验证

- ✅ typecheck、biome、18 个 compute 单元测试全绿。
- ⚠️ 端到端未在真库验证（写代码时云端 dev 库被 Supabase 闲置暂停连不上）。上线前务必
  在生产先 `--seed` 再 `--dry-run` 人工核对数字。
