#!/usr/bin/env bun
/**
 * 诊断：某个角色的 chat 页注入了什么 character CSS、为什么注入了 / 为什么没注入。
 *
 * Why this exists:
 *   chat 页的 globalCss 链路是
 *     character → character_pack_subscriptions (css_enabled=true) → beautification_packs.globalCss
 *   → loadCharacterGlobalCss 拼接 → sanitizeAndScopeCss 翻译+白名单+scope → 注入 <style>。
 *   任何一环断了表现都是「美化没生效」。F12 看不出是「未注入」还是「注入但被白名单砍光」。
 *   这个脚本一次扒清楚每一环。
 *
 * Usage:
 *   bun scripts/debug-character-css.ts <character-id>
 *
 * Output:
 *   1. character 行（名字 + owner）
 *   2. 该 character 的全部 pack 订阅（订阅状态 + cssEnabled + pack 的 globalCss 长度）
 *   3. loadCharacterGlobalCss 实际拼接产物（前 60 行原文）
 *   4. sanitizeAndScopeCss 后的最终 CSS（前 60 行 + 统计：旧前缀/nj_ 出现次数 + warnings）
 *
 * 不写库、纯只读。
 */

import { config } from "dotenv";
import postgres from "postgres";
import { LEGACY_SELECTOR_PREFIX_RE } from "../src/lib/import/legacy-format";
import { sanitizeAndScopeCss } from "../src/lib/styling/whitelist";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing (check .env.local / .env)");
  process.exit(1);
}

const arg = process.argv[2];
if (!arg) {
  console.error(
    "用法:\n" +
      "  bun scripts/debug-character-css.ts <character-id>\n" +
      "  bun scripts/debug-character-css.ts --all   # 列库里全部 pack 的 globalCss 长度 + enabled 规则数",
  );
  process.exit(1);
}

const isNeonPooler = url.includes("-pooler.");
const sql = postgres(url, { max: 1, prepare: !isNeonPooler });

// ============================================================
// --all 模式：库里所有 pack 的全景表（globalCss 长度 + enabled 规则数 + 订阅它的角色列表）
// ============================================================
if (arg === "--all") {
  interface PackOverviewRow {
    pack_id: string;
    pack_name: string;
    pack_owner: string;
    css_len: number;
    rule_count: number;
    enabled_rule_count: number;
    iframe_rule_count: number;
    subscriber_names: string[];
  }
  const rows = await sql<PackOverviewRow[]>`
    SELECT
      bp.id            AS pack_id,
      bp.name          AS pack_name,
      bp.owner_user_id AS pack_owner,
      COALESCE(LENGTH(bp.global_css), 0) AS css_len,
      COUNT(rr.id)                                                  AS rule_count,
      COUNT(rr.id) FILTER (WHERE rr.enabled = true)                 AS enabled_rule_count,
      COUNT(rr.id) FILTER (WHERE rr.replacement ~* '<artifact|\`\`\`html')
                                                                    AS iframe_rule_count,
      COALESCE(ARRAY_AGG(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL), '{}')
                                                                    AS subscriber_names
    FROM beautification_packs bp
    LEFT JOIN regex_rules rr ON rr.pack_id = bp.id
    LEFT JOIN character_pack_subscriptions cps ON cps.pack_id = bp.id
    LEFT JOIN characters c ON c.id = cps.character_id
    GROUP BY bp.id, bp.name, bp.owner_user_id, bp.global_css
    ORDER BY css_len DESC, enabled_rule_count DESC, bp.name ASC
  `;

  console.log("=".repeat(95));
  console.log(`库里全部 pack 概览（${rows.length} 个）`);
  console.log("=".repeat(95));
  console.log("格式：[CSS 字符数] [规则数 (enabled/iframe)] pack名 → 订阅角色");
  console.log("-".repeat(95));
  for (const r of rows) {
    const subs =
      r.subscriber_names.length > 0
        ? r.subscriber_names.join(", ")
        : "(无角色订阅)";
    console.log(
      `[CSS ${String(r.css_len).padStart(6)}]  ` +
        `[规则 ${r.rule_count} (${r.enabled_rule_count}e / ${r.iframe_rule_count}iframe)]  ` +
        `${r.pack_name}  →  ${subs}`,
    );
  }

  // 一行总结：多少个 pack 有非空 globalCss
  const withCss = rows.filter((r) => r.css_len > 0).length;
  const withRules = rows.filter((r) => r.enabled_rule_count > 0).length;
  const onlyIframe = rows.filter(
    (r) => r.enabled_rule_count > 0 && r.iframe_rule_count === r.rule_count,
  ).length;
  console.log("-".repeat(95));
  console.log(
    `## 汇总\n` +
      `  有非空 globalCss 的 pack: ${withCss} / ${rows.length}\n` +
      `  有 enabled regex 规则的 pack: ${withRules} / ${rows.length}\n` +
      `  规则全是 iframe 类型（没 sanitize 类）: ${onlyIframe} / ${withRules}`,
  );
  if (withCss === 0 && rows.length > 0) {
    console.log(
      "\n  ⚠️  全部 pack 的 globalCss 都是空。这是数据一致的「未导入」状态，\n" +
        "     不是单卡丢失。如果之前某张卡有过 globalCss，说明全库被批量清过。",
    );
  }
  if (onlyIframe === withRules && withRules > 0) {
    console.log(
      "\n  ⚠️  所有有规则的 pack 都只剩 iframe 类规则。如果之前有 sanitize 类\n" +
        "     （比如状态栏装饰），说明它们被批量删了 —— 这是一致回归的强证据。",
    );
  }

  await sql.end();
  process.exit(0);
}

const characterId = arg;

interface CharacterRow {
  id: string;
  name: string;
  owner_id: string;
}

const [character] = await sql<CharacterRow[]>`
  SELECT id, name, owner_id
  FROM characters
  WHERE id = ${characterId}
  LIMIT 1
`;

if (!character) {
  console.error(`找不到 character: ${characterId}`);
  await sql.end();
  process.exit(1);
}

console.log("=".repeat(70));
console.log(`角色: ${character.name}  (id=${character.id})`);
console.log(`owner: ${character.owner_id}`);
console.log("=".repeat(70));

interface SubscriptionRow {
  pack_id: string;
  pack_name: string;
  order_index: number;
  css_enabled: boolean;
  global_css: string | null;
}

const subscriptions = await sql<SubscriptionRow[]>`
  SELECT
    cps.pack_id,
    bp.name AS pack_name,
    cps.order_index,
    cps.css_enabled,
    bp.global_css
  FROM character_pack_subscriptions cps
  INNER JOIN beautification_packs bp ON bp.id = cps.pack_id
  WHERE cps.character_id = ${characterId}
  ORDER BY cps.order_index ASC
`;

console.log(`\n## Pack 订阅（${subscriptions.length} 条）\n`);
if (subscriptions.length === 0) {
  console.log("  (无订阅记录 → loadCharacterGlobalCss 必返回空字符串)");
} else {
  for (const sub of subscriptions) {
    const cssLen = sub.global_css?.length ?? 0;
    const flag = sub.css_enabled ? "✓ enabled" : "✗ DISABLED";
    const cssNote =
      cssLen === 0 ? "globalCss 字段为空 / null" : `globalCss ${cssLen} 字符`;
    console.log(
      `  [${sub.order_index}] ${sub.pack_name}  (pack=${sub.pack_id})`,
    );
    console.log(`      ${flag} | ${cssNote}`);
  }
}

// ============================================================
// pack 内 regex 规则盘点
// ============================================================
// 美化通常两部分：CSS（globalCss）+ regex（把 LLM 输出的 marker 翻译成
// 富 HTML）。只有 CSS 没 regex，content 还是裸 markdown；只有 regex 没
// CSS，HTML 出来了但没装饰。两条都要看才能下结论。

interface RegexRuleRow {
  pack_id: string;
  pack_name: string;
  rule_id: string;
  rule_name: string;
  enabled: boolean;
  pattern: string;
  replacement: string;
  output_guidance: string | null;
}

const packIds = subscriptions.map((s) => s.pack_id);
const rules =
  packIds.length === 0
    ? []
    : await sql<RegexRuleRow[]>`
        SELECT
          rr.pack_id, bp.name AS pack_name,
          rr.id AS rule_id, rr.name AS rule_name,
          rr.enabled, rr.pattern, rr.replacement, rr.output_guidance
        FROM regex_rules rr
        INNER JOIN beautification_packs bp ON bp.id = rr.pack_id
        WHERE rr.pack_id IN ${sql(packIds)}
        ORDER BY rr.pack_id, rr.order_index ASC
      `;

console.log(`\n## Pack 内 regex 规则（${rules.length} 条）\n`);
if (rules.length === 0) {
  console.log("  (订阅 pack 内没有任何 regex 规则)");
} else {
  let lastPack = "";
  for (const r of rules) {
    if (r.pack_id !== lastPack) {
      console.log(`\n  Pack: ${r.pack_name}  (id=${r.pack_id})`);
      lastPack = r.pack_id;
    }
    const flag = r.enabled ? "✓" : "✗";
    const replKind = /<artifact|```html/i.test(r.replacement)
      ? "iframe"
      : "sanitize";
    const replPreview = r.replacement.replace(/\n+/g, " ").slice(0, 60).trim();
    console.log(
      `    ${flag} [${replKind}] ${r.rule_name}  (pattern ${r.pattern.length} 字符 / replacement ${r.replacement.length} 字符)`,
    );
    console.log(`        replacement 前 60: ${replPreview}`);
  }
}

// 复刻 loadCharacterGlobalCss 的拼接逻辑（不导入避免触发 RSC 限制）
const concatenated = subscriptions
  .filter((s) => s.css_enabled)
  .map((s) => s.global_css ?? "")
  .filter(Boolean)
  .join("\n");

console.log("\n## loadCharacterGlobalCss 输出\n");
console.log(`  长度: ${concatenated.length} 字符`);
console.log(
  `  原始旧前缀出现次数: ${(concatenated.match(LEGACY_SELECTOR_PREFIX_RE) ?? []).length}`,
);
console.log(
  `  原始 nj_ 出现次数:   ${(concatenated.match(/nj_/g) ?? []).length}`,
);

if (concatenated) {
  console.log("\n  前 60 行原文:");
  console.log(`  ${"-".repeat(66)}`);
  const head = concatenated.split("\n").slice(0, 60).join("\n");
  console.log(head.replace(/^/gm, "  "));
  console.log(`  ${"-".repeat(66)}`);
}

console.log("\n## sanitizeAndScopeCss 输出（render 时实际注入的 CSS）\n");
const { css: sanitized, warnings } = sanitizeAndScopeCss(
  concatenated,
  characterId,
);
console.log(`  长度: ${sanitized.length} 字符`);
console.log(
  `  sanitize 后旧前缀出现次数: ${(sanitized.match(LEGACY_SELECTOR_PREFIX_RE) ?? []).length}`,
);
console.log(
  `  sanitize 后 nj_ 出现次数:   ${(sanitized.match(/nj_/g) ?? []).length}`,
);
console.log(`  warnings (${warnings.length} 条):`);
for (const w of warnings.slice(0, 20)) console.log(`    - ${w}`);
if (warnings.length > 20)
  console.log(`    ... 还有 ${warnings.length - 20} 条`);

if (sanitized) {
  console.log("\n  前 60 行 sanitized 输出:");
  console.log(`  ${"-".repeat(66)}`);
  const head = sanitized.split("\n").slice(0, 60).join("\n");
  console.log(head.replace(/^/gm, "  "));
  console.log(`  ${"-".repeat(66)}`);
}

console.log("\n## 结论");
const enabledRuleCount = rules.filter((r) => r.enabled).length;
if (subscriptions.length === 0) {
  console.log(
    "  ⚠️  无 pack 订阅 → CSS 和 regex 都为空。去 /characters/<id>/edit 订阅一个 pack。",
  );
} else if (subscriptions.every((s) => !s.css_enabled)) {
  console.log(
    "  ⚠️  所有订阅 pack 的 cssEnabled=false → 注入空。edit 页面打开 globalCss 开关。",
  );
} else if (concatenated.length === 0 && enabledRuleCount === 0) {
  console.log(
    "  ⚠️  pack 既没 globalCss 也没 regex 规则 → 外部美化从未导入。去 /packs/<id>/studio 粘外部 CSS + 导入外部规则。",
  );
} else if (concatenated.length === 0 && enabledRuleCount > 0) {
  console.log(
    "  ⚠️  pack 有 regex 规则但 globalCss 字段为空 → LLM 输出会被 regex 翻译成 HTML，但没 CSS 装饰，content 出来是裸 HTML。补 CSS 到 pack。",
  );
} else if (concatenated.length > 0 && enabledRuleCount === 0) {
  console.log(
    "  ⚠️  pack 有 globalCss 但没 enabled 的 regex 规则 → LLM 输出按原样进 markdown，CSS 命不中任何 marker 类。补 regex 规则到 pack。",
  );
} else if (sanitized.length === 0) {
  console.log(
    "  ⚠️  原始 CSS 非空但 sanitize 后为空 → 全部选择器被白名单丢弃。看 warnings。",
  );
} else {
  console.log(
    `  ✓ CSS 链路正常 (${sanitized.length} 字符注入)，pack 内有 ${enabledRuleCount} 条 enabled regex 规则。如视觉仍不对，看每条规则的 replacement 是否生成了创作者 CSS 能命中的类名。`,
  );
}

await sql.end();
