# Studio 皮肤 CSS 直接编辑

> Companion: [insights/studio-direct-css-edit.md](../insights/studio-direct-css-edit.md)
> Related: [beautification-packs.md](./beautification-packs.md) · [global-styling.md](../insights/global-styling.md) · [ai-generators.md](./ai-generators.md)

pack studio 的 CSS 抽屉从「只读源码 + 只能开 AI 皮肤会话」升级为「可直接编辑源码 + 一键保存」。creator 现在可以把现成 CSS（含外部迁移卡）直接粘进 textarea 保存，不必走多轮 AI 对话。

## 改动概览

| 改动 | 文件 |
|---|---|
| CSS 抽屉加可编辑 textarea + 保存按钮 | `StudioLayout.tsx` |
| 引入 `updatePackAction` 写 `globalCss` | `StudioLayout.tsx` |
| AI 皮肤会话入口降级为次要选项（filled → outlined） | `StudioLayout.tsx` |

`updatePackAction`（`src/lib/packs/actions.ts`）已存在，本次只是新增一个调用点，未改 action 本体。

## 代码改动

### `src/components/packs/studio/StudioLayout.tsx`

**新增两个本地状态：**
```tsx
const [directCssDraft, setDirectCssDraft] = useState(pack.globalCss ?? "");
const [directCssSaving, setDirectCssSaving] = useState(false);
```

`pack.globalCss` 变化时同步 draft（与 `persistedCss` 同源）：
```tsx
useEffect(() => setDirectCssDraft(pack.globalCss ?? ""), [pack.globalCss]);
```

**保存 handler：**
```tsx
async function handleDirectCssSave() {
  setDirectCssSaving(true);
  const result = await updatePackAction(pack.id, { globalCss: directCssDraft });
  setDirectCssSaving(false);
  if (!result.ok) { alert(result.error); return; }
  setPersistedCss(directCssDraft);
  router.refresh();
}
```

**CSS 抽屉 UI（`drawer === "css"`）：**
- 上半：可编辑 textarea（`min-h-200px`，`max-h-50vh`，`resize-y`，等宽字体，`spellCheck={false}`），placeholder 给一段 `.nj_ai_message_bubble {}` 示例
- 保存按钮：`disabled` 条件 `directCssSaving || directCssDraft === persistedCss`（无改动不可保存），文案走 `dict.packs.studioSaving` / `studioSave`
- 左下角提示「只能使用 `nj_*` 选择器」
- 下半（分隔线下）：保留「新建 AI 皮肤会话」入口，但样式降为 outlined，文案从「新建皮肤会话」改为「新建 AI 皮肤会话」

原先这里只有一个只读 `<details><pre>` 展示 `persistedCss`，现已被可编辑 textarea 取代。

## 安全性

`updatePackAction` **不在保存时校验 CSS** —— 原样写库（`globalCss: opts.globalCss || null`）。白名单兜底在**渲染层**：

- 生产聊天页：`src/app/chat/[characterId]/page.tsx:71` 注入前跑 `sanitizeAndScopeCss(rawCss, character.id)`
- studio 预览：`PreviewCanvas.tsx` / `PackPreview.tsx` 同样在注入前跑 `sanitizeAndScopeCss`

这与 AI 皮肤会话的「确认应用」路径一致 —— 两条路径都把 CSS 存原文、渲染时 sanitize + scope。直接编辑没有引入新的注入面：任何越界 selector（`body` / `position:fixed` / `@import` 等）在渲染时被剥离，作用域被 scope 前缀限制在该 pack。

## 验证

- `bun run typecheck` —— 通过
- `bun test` —— 通过
- 手动：编辑 CSS → 保存 → `router.refresh()` 后预览生效；无改动时保存按钮 disabled

## 关联文件

- action 本体：`src/lib/packs/actions.ts` `updatePackAction`（无改动）
- 白名单实现：`src/lib/styling/whitelist.ts` `sanitizeAndScopeCss`（无改动）
- i18n：`dict.packs.studioSave` / `studioSaving`（已存在，未新增）
- 渲染注入点：`src/app/chat/[characterId]/page.tsx:71`
