/**
 * Developer allowlist for host-level debug surfaces (chat DebugPanel, etc.).
 *
 * Why this exists: the debug panel surfaces the assembled system prompt,
 * which includes host-level prompt engineering (canonical master, regex
 * guidance concatenation, section header phrasing) that creators should
 * not be able to reverse-engineer from their own cards. Owner gating
 * alone is not enough — every creator is owner of their own card.
 *
 * Config: NIMIR_DEBUG_EMAILS in .env.local, comma-separated, case-insensitive.
 *   NIMIR_DEBUG_EMAILS="dev@example.com,me@personal.tld"
 *
 * Empty / unset → no one is on the allowlist. Production-safe default.
 *
 * ## 生产环境硬闸（勿删）
 *
 * 这个开关远不止「看 debug 面板」。命中白名单的账号还能：
 *   - 保存任意角色卡（characters/actions.ts 的 updateCharacterAction）
 *   - 进任意卡的 edit 页 = 读全站创作者的 persona / opening / sampleDialogue
 *     等 6 个 prompt 资产字段原文（characters/[id]/edit/page.tsx）
 *
 * 也就是说它实质是「全站超级用户」，不是调试开关。原先只有一句注释写着
 * 「严禁配进 prod」，没有任何机制执行 —— 一旦有人在生产 .env 里填了它排障，
 * 泄的是全体创作者的护城河。所以这里在 NODE_ENV=production 下无条件返回
 * false，配了也不生效。
 *
 * 需要在生产排障就改代码 + 过 review，别靠环境变量开后门。
 */

function parseAllowlist(): Set<string> {
  const raw = process.env.NIMIR_DEBUG_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

let cached: Set<string> | null = null;

export function isDeveloperEmail(email: string | null | undefined): boolean {
  // 生产环境一律不认，配了也无效。放在最前面，早于任何解析 / 缓存。
  if (process.env.NODE_ENV === "production") return false;
  if (!email) return false;
  if (cached == null) cached = parseAllowlist();
  return cached.has(email.toLowerCase());
}
