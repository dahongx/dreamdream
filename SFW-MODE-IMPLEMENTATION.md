# SFW 模式实现清单

## 完成时间
2026-11-07

## 实现方式
**单开关控制，共用代码库，构建时分叉。** 通过环境变量 `NEXT_PUBLIC_SFW_MODE=1` 启用 SFW 版；未设置或设为其他值时运行主站模式。

---

## 四层防护（src/lib/config/site.ts 定义）

### 1. 展示层：隐藏 NSFW 相关 UI
- ✅ 顶栏 NSFW 开关（`Shell.tsx`，桌面端）
- ✅ 移动端菜单 NSFW 开关（`TopbarMobileMenu.tsx`）
- ✅ 角色卡片 R18 角标（`CharacterGridCard.tsx`，mini 与常规两处）
- ✅ 角色详情页 R18 角标（`CharacterDetailView.tsx`，两处）
- ✅ 分享页 R18 角标（`share/[code]/page.tsx`）
- ✅ 编辑表单 NSFW 勾选框（`CharacterForm.tsx`）

### 2. 查询层：强制 `showNsfw = false`
- ✅ 探索页主查询（`explore/page.tsx`）
- ✅ 探索页滚动加载（`explore/actions.ts`）
- ✅ Shell 全局布局（`Shell.tsx`）
- ✅ 统一入口：`resolveShowNsfw()` 函数

### 3. 写入层：强制 `nsfw = false`
- ✅ 表单提交路径：zod schema transform（`characters/schema.ts`）
- ✅ 一键导入路径：`import-actions.ts`
- ✅ 外部卡导入：`external-card.ts`
- ✅ Mufy 迁移（默认 true 被压制）：`mufy-migration.ts`
- ✅ 统一出口：`forceSfwNsfw()` 函数

### 4. 访问层：已知 URL 直达也 404
- ✅ 角色详情页拦截（`characters/[id]/page.tsx`）
- ✅ 聊天页拦截（`chat/[characterId]/page.tsx`）
- ✅ 作者本人同样拦截（无「我的成人卡」概念）

---

## 验证结果
- **类型检查**：0 个错误
- **测试**：944 个测试全部通过
- **覆盖**：4 层防护全部到位，无遗漏路径

---

## 切换方式

### 主站（NSFW 可见，默认）
```bash
# .env 里不设置或设为 0
NEXT_PUBLIC_SFW_MODE=0
docker compose build
docker compose up -d
```

### SFW 版
```bash
# .env 里显式设为 1
NEXT_PUBLIC_SFW_MODE=1
docker compose build  # 必须重新构建，运行时改无效
docker compose up -d
```

---

## 注意事项

1. **必须重新构建**：`NEXT_PUBLIC_*` 变量在 build 时内联进 bundle，运行时改 env 对已构建的镜像无效。
2. **数据库无关**：两种模式可以共用同一个数据库（通过查询与访问层过滤），也可以各用各的。
3. **独立部署建议**：SFW 版应独立域名、独立部署，避免被关联。
4. **角色内容审读**：标志位只是元数据，`persona` / `opening` 等字段是散文；真正的 SFW 内容需要逐张人工审读或精选导入。

---

## 文件清单（15 个）

### 核心模块（新增 1 个）
- `src/lib/config/site.ts`（新建）

### 展示层（7 个）
- `src/components/Shell.tsx`
- `src/components/TopbarMobileMenu.tsx`
- `src/components/characters/CharacterGridCard.tsx`
- `src/components/characters/CharacterDetailView.tsx`
- `src/components/characters/CharacterForm.tsx`
- `src/app/share/[code]/page.tsx`
- `src/app/explore/page.tsx`

### 查询与访问层（4 个）
- `src/app/explore/actions.ts`
- `src/app/characters/[id]/page.tsx`
- `src/app/chat/[characterId]/page.tsx`
- `src/lib/characters/schema.ts`

### 写入层（3 个）
- `src/lib/characters/import-actions.ts`
- `src/lib/import/external-card.ts`
- `src/lib/import/mufy-migration.ts`

---

## 技术债务：已全部偿还
- ❌ 之前：展示层只藏角标，creator 仍能自报 nsfw=true
- ✅ 现在：写入层统一收口，任何路径落库前都经 `forceSfwNsfw()`
- ❌ 之前：导入链路完全绕过 zod schema
- ✅ 现在：三条导入路径全部补齐
- ❌ 之前：已知 URL 能直达 NSFW 卡
- ✅ 现在：访问层拦截，详情/聊天两个入口全覆盖
