/**
 * 站点模式开关 —— SFW 版与主站共用一套代码，靠这个开关分叉。
 *
 * 为什么必须是 `NEXT_PUBLIC_` 前缀：
 *   SFW 模式要影响**客户端组件**的渲染（顶栏的 NSFW 开关是否出现、角色编辑
 *   表单里是否还有 NSFW 勾选框）。Next 只在 `next build` 时把 `NEXT_PUBLIC_*`
 *   内联进浏览器 bundle，运行时再改 env 对客户端无效。所以切换模式必须重新
 *   build + 部署 —— 这是有意的：两种模式共用同一份代码，但产出不同的镜像。
 *
 * 为什么默认 false：
 *   主站已经上线在跑，任何一次漏配 env 都不能把主站变成 SFW 版。只有显式
 *   `NEXT_PUBLIC_SFW_MODE=1` 才进入 SFW 模式，fail-safe 方向正确。
 *
 * SFW 模式做的事（四处收口，缺一处就会漏）：
 *   1. 展示层：隐藏 NSFW 角标与顶栏开关（本常量驱动组件）
 *   2. 查询层：所有探索/创作者查询强制 `nsfw = false`（resolveShowNsfw）
 *   3. 写入层：创建/编辑角色时强制 `nsfw = false`，creator 无法自报
 *   4. 访问层：已知 URL 直达 NSFW 卡的详情/聊天页一律 404
 *
 * 第 3 条是关键：SFW 版不能只是「看不见」，而是库里不存在可标记为 NSFW 的卡。
 * 第 4 条是纵深防御 —— 即便有人手工往库里塞了 nsfw=true，URL 也进不去。
 */
export const SFW_MODE = process.env.NEXT_PUBLIC_SFW_MODE === "1";

/**
 * 顶栏 / 探索查询共用的 NSFW 显示判定。
 *
 * 抽出来是因为同一段「cookie 缺省 = 显示」的逻辑原本散在 Shell.tsx、
 * explore/page.tsx、explore/actions.ts 三处，任何一处改漏都会让 SFW 版
 * 在某个入口漏出成人内容。SFW 模式下无条件 false，cookie 不再有话语权。
 */
export function resolveShowNsfw(cookieValue: string | undefined): boolean {
  if (SFW_MODE) return false;
  return cookieValue !== "0";
}

/**
 * 写入层的强制归一 —— 所有落库路径的唯一出口。
 *
 * 表单走 zod schema（lib/characters/schema.ts）已经处理过一次，但**导入链路
 * 完全不经过那张 schema**：
 *   - lib/characters/import-actions.ts 直接把解析结果 insert 进去
 *   - lib/import/external-card.ts 从外部卡 meta 读 NSFW 字段
 *   - lib/import/mufy-migration.ts 默认 `nsfw ?? true`（Mufy 无可靠布尔值）
 *
 * 其中 Mufy 那条最危险：它**默认 true**。若不拦，SFW 版的迁移工具会把每一张
 * 搬进来的卡都标成成人内容。此处统一收口，任何写入路径都必须过这个函数。
 */
export function forceSfwNsfw(nsfw: boolean): boolean {
  return SFW_MODE ? false : nsfw;
}
