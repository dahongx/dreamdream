# SFW 模式实现完成总结

## 交付时间
2026-11-07 19:45

## 完成内容

### 1. 磁盘清理
- **测试服**（115.29.213.73）
- 清理前：99G 总容量，68G 已用（72%），27G 可用
- 清理后：64G 已用（68%），31G 可用
- **释放空间**：约 4 GB（删除 3 个悬空镜像）
- `trusting_mclaren` 容器及所有回滚镜像、volumes 原样未动

### 2. SFW 模式核心实现
**单开关控制，四层防护，共用代码库，构建时分叉。**

#### 新增文件（1 个）
- `src/lib/config/site.ts`
  - `SFW_MODE`：读取 `NEXT_PUBLIC_SFW_MODE` 环境变量
  - `resolveShowNsfw()`：查询层统一入口
  - `forceSfwNsfw()`：写入层统一出口

#### 修改文件（15 个）
**展示层（7 个）**：隐藏 NSFW 角标与开关
- `src/components/Shell.tsx`
- `src/components/TopbarMobileMenu.tsx`
- `src/components/characters/CharacterGridCard.tsx`
- `src/components/characters/CharacterDetailView.tsx`
- `src/components/characters/CharacterForm.tsx`
- `src/app/share/[code]/page.tsx`
- `src/app/explore/page.tsx`

**查询层（2 个）**：强制 `showNsfw = false`
- `src/app/explore/actions.ts`
- `src/components/Shell.tsx`（cookie 读取）

**写入层（4 个）**：强制 `nsfw = false`
- `src/lib/characters/schema.ts`（zod transform）
- `src/lib/characters/import-actions.ts`（一键导入）
- `src/lib/import/external-card.ts`（外部卡）
- `src/lib/import/mufy-migration.ts`（Mufy 迁移，默认 true → false）

**访问层（2 个）**：NSFW 卡 URL 返回 404
- `src/app/characters/[id]/page.tsx`
- `src/app/chat/[characterId]/page.tsx`

#### 新增文档（2 个）
- `SFW-MODE-IMPLEMENTATION.md`：实现说明与验证结果
- `NEXT-STEPS-SFW.md`：部署执行清单（5 阶段，3–6 天 + 审批时间）

### 3. 验证结果
- ✅ **类型检查**：0 个错误
- ✅ **测试**：944 个测试全部通过
- ✅ **四层防护**：展示、查询、写入、访问全部到位
- ✅ **逻辑验证**：
  - `SFW_MODE=false`（默认）→ 主站行为不变
  - `SFW_MODE=true` → `resolveShowNsfw()` 无条件返回 false，`forceSfwNsfw()` 压制所有写入

### 4. 技术债务偿还
- ❌ **之前**：展示层只藏角标，creator 仍能自报 `nsfw=true`
- ✅ **现在**：写入层统一收口，任何路径落库前都经 `forceSfwNsfw()`
- ❌ **之前**：导入链路完全绕过 zod schema
- ✅ **现在**：三条导入路径（一键、外部卡、Mufy）全部补齐
- ❌ **之前**：已知 URL 能直达 NSFW 卡
- ✅ **现在**：访问层拦截，详情/聊天两个入口全覆盖

---

## 使用方式

### 主站模式（默认）
```bash
# .env 里不设置或设为 0
NEXT_PUBLIC_SFW_MODE=0
docker compose build
docker compose up -d
```

### SFW 模式
```bash
# .env 里显式设为 1
NEXT_PUBLIC_SFW_MODE=1
docker compose build  # 必须重新构建
docker compose up -d
```

---

## 下一步（见 NEXT-STEPS-SFW.md）

| 阶段 | 内容 | 预计时间 | 关键决策点 |
|---|---|---|---|
| 1 | 本地验证 | 0.5 天 | — |
| 2 | 数据库准备 | 1 天 | **方案 A（复用 Postgres）还是 B（新服务器）？** |
| 3 | 部署与配置 | 1 天 | **域名？精选角色谁审读？** |
| 4 | 功能验收 | 0.5 天 | — |
| 5 | 支付申请 | **3–7 工作日至 2–4 周** | **支付主体是否与主站相同？** |
| 6 | 真实支付验收 | 0.5 天 | — |

**总工程时间**：3–6 天（不含审批等待）

---

## 关键风险

1. **支付审批不可控**
   - Stripe 可能拒绝、要求补充材料、或关联到主站
   - 缓解：独立域名、独立部署、业务描述避开成人内容

2. **服务器资源不足**
   - 测试服 2 核 / 3 GB，已跑 17 个容器
   - 缓解：方案 A 只增 100 MB；监控内存，必要时升级

3. **内容审读遗漏**
   - `nsfw=false` 的卡里仍可能有成人主题（`persona` 是散文）
   - 缓解：精选导入，逐张人工审读

4. **两站关联**
   - 同 IP、同主体、同资质被 Stripe 关联
   - 缓解：独立域名、独立 TLS；长期考虑不同主体

---

## 已提交代码

**分支**：当前分支（待推送）
**提交 SHA**：（等后台 `git commit` 完成）
**文件数**：17 个（1 新增 + 15 修改 + 2 文档）

---

## 你需要做的决策

1. **数据库方案**：
   - 方案 A（推荐）：复用测试服 `supabase-db`，新建 `dearm_sfw` database
   - 方案 B：新买一台 4 GB 服务器

2. **域名**：`sfw.dearm.ai` 还是另选？

3. **精选角色**：谁来逐张审读 `persona` / `opening` 内容？

4. **支付主体**：是否与主站使用同一香港主体？

5. **时间节奏**：是否按 NEXT-STEPS-SFW.md 的 5 阶段推进，还是先做到某一步验证可行性？

---

## 我现在的状态

- ✅ 代码已实现，验证通过
- ⏳ `git commit` 在后台运行（处理中）
- ⏳ 等你确认上述 5 个决策点，我继续推进下一阶段

---

## 补充说明

### 为什么不只是「隐藏角标」
因为那只是展示层，creator 仍能通过表单勾选 `nsfw=true`，库里就会存在成人卡。SFW 版的定义是「库里不存在可标记为成人内容的卡」，所以必须四层全拦。

### 为什么导入路径也要拦
三条导入路径（一键、外部卡、Mufy）全部绕过 zod schema，直接 `db.insert()`。其中 Mufy 迁移最危险：它**默认 `nsfw = true`**（因为 Mufy 无可靠布尔值）。不拦的话，SFW 版跑一次迁移，每张卡都会被标成成人内容。

### 为什么访问层还要拦
即便展示层藏了、查询层过滤了、写入层拦了，如果有人手工往库里塞了 `nsfw=true` 的行（SQL、旧数据导入、迁移遗留），已知 URL 仍能进去。访问层是最后一道闸，保证「无论库里有什么，SFW 版的用户都进不去」。

### 为什么作者本人也拦
SFW 版不存在「我的成人卡」这个概念——那是另一套产品的事。如果作者能进自己的 NSFW 卡，就等于 SFW 版仍在提供成人内容创作功能，只是对外不展示；这在支付审核时是说不清的。

---

**如果你确认继续，告诉我上面 5 个决策点的答案，我立刻开工执行阶段 2（数据库准备）。**
