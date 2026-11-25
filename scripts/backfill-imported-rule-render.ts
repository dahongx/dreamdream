#!/usr/bin/env bun
/**
 * Dearm 历史外部导入规则修复回填
 *
 * Why this exists:
 *   从外部一键导入的角色卡，规则是直接落库的，绕过了表单保存路径的两道处理。
 *   于是历史行有两个病：
 *
 *   ① 渲染外壳没归一：外部格式的 replaceString 用 ```html ... ``` 代码围栏当 iframe
 *      外壳。寄情只在 replacement 整体是 <artifact>...</artifact> 时才路由进沙箱
 *      iframe（regex/segments.ts），否则掉进 sanitize 路径、<script>/<style> 被删、
 *      围栏被 react-markdown 当代码块原样吐出 —— 整个互动组件就废了。
 *      （表单保存走 regex/schema.ts 的 normalizeReplacementEnvelope，导入没走。）
 *
 *   ② outputGuidance 与卡面正文重复：mapExternalCardRule 凭 pattern 自动补一份「把回复用
 *      <Tag> 包裹」的指导，但 creator 往往已经在「输出设定」等正文里文档化了同一
 *      标签。两份都进 system prompt → 同一标签的「何时/如何输出」被注入两遍且措辞
 *      冲突（自动那份是「全程包裹」，常跟卡面「仅线上聊天才吐」打架）。
 *
 *   导入器本身已修（src/lib/import/external-card.ts），新导入不再有这两个病；本脚本把存量
 *   行对齐到同样的结果。
 *
 * What this does:
 *   A. 围栏归一：对每条规则跑 normalizeReplacementEnvelope，结果有变才 UPDATE。
 *   B. 去重指导：仅当「规则所在包只被 1 个角色订阅」且「该角色正文已文档化此标签」
 *      时，把 output_guidance 清成 null。限定单订阅者是为了不误伤多人共享 / studio
 *      自建包里别的角色依赖的指导。
 *
 * Modes:
 *   --dry-run   只算不写，打印将要改动的行
 *
 * Safety:
 *   - 幂等：跑多次结果一样（A 已是 artifact / 非围栏的不动；B 已 null 的不动）
 *   - 只动 replacement 与 output_guidance 两列，不碰 pattern / enabled / visible
 *   - B 严格限定单订阅者包，绝不动共享包
 */

import { config } from "dotenv";
import postgres from "postgres";
import {
  extractLeadingTag,
  tagDocumentedInText,
} from "../src/lib/import/external-card";
import { normalizeReplacementEnvelope } from "../src/lib/regex/envelope";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing (check .env.local)");
  process.exit(1);
}

const dryRun = process.argv.slice(2).includes("--dry-run");

const isPooler = url.includes("-pooler.");
const sql = postgres(url, { max: 1, prepare: !isPooler });

function short(s: string, n = 60): string {
  const oneLine = s.replace(/\s+/g, " ").trim();
  return oneLine.length > n ? `${oneLine.slice(0, n)}…` : oneLine;
}

try {
  // ---- A. 围栏归一 -------------------------------------------------------
  const replRows = await sql<
    { id: string; name: string; replacement: string }[]
  >`SELECT id, name, replacement FROM regex_rules WHERE replacement IS NOT NULL`;

  let envelopeFixed = 0;
  for (const row of replRows) {
    const next = normalizeReplacementEnvelope(row.replacement);
    if (next === row.replacement) continue;
    envelopeFixed++;
    console.log(
      `  [A] ${row.name} (${row.id.slice(0, 8)}): ${short(row.replacement, 40)} → <artifact>…</artifact>`,
    );
    if (!dryRun) {
      await sql`UPDATE regex_rules SET replacement = ${next}, updated_at = now() WHERE id = ${row.id}`;
    }
  }

  // ---- B. 去重指导（仅单订阅者包） --------------------------------------
  const guidanceRows = await sql<
    {
      id: string;
      name: string;
      pattern: string;
      persona: string | null;
      adversity: string | null;
      default_cognition: string | null;
      opening: string | null;
      plot_setting: string | null;
      output_setting: string | null;
      sample_dialogue: string | null;
    }[]
  >`
    SELECT r.id, r.name, r.pattern,
           ch.persona, ch.adversity, ch.default_cognition, ch.opening,
           ch.plot_setting, ch.output_setting, ch.sample_dialogue
    FROM regex_rules r
    JOIN (
      -- 单订阅者包：count=1，用 array_agg 取那唯一的 character_id（uuid 无 min/max 聚合）
      SELECT pack_id, (array_agg(character_id))[1] AS only_char
      FROM character_pack_subscriptions
      GROUP BY pack_id
      HAVING count(*) = 1
    ) sub ON sub.pack_id = r.pack_id
    JOIN characters ch ON ch.id = sub.only_char
    WHERE r.output_guidance IS NOT NULL
  `;

  let guidanceCleared = 0;
  for (const row of guidanceRows) {
    const tag = extractLeadingTag(row.pattern);
    if (!tag) continue;
    const documented = tagDocumentedInText(tag, [
      row.persona,
      row.adversity,
      row.default_cognition,
      row.opening,
      row.plot_setting,
      row.output_setting,
      row.sample_dialogue,
    ]);
    if (!documented) continue;
    guidanceCleared++;
    console.log(
      `  [B] ${row.name} (${row.id.slice(0, 8)}): 标签 <${tag}> 已在卡面文档化 → outputGuidance = null`,
    );
    if (!dryRun) {
      await sql`UPDATE regex_rules SET output_guidance = NULL, updated_at = now() WHERE id = ${row.id}`;
    }
  }

  console.log("");
  console.log(`${dryRun ? "[dry-run] 将改动" : "已改动"}：`);
  console.log(
    `  A 围栏归一: ${envelopeFixed} 行 / 共 ${replRows.length} 条规则`,
  );
  console.log(
    `  B 去重指导: ${guidanceCleared} 行 / 共 ${guidanceRows.length} 条候选（单订阅者包 + 有自动指导）`,
  );
  if (dryRun) console.log("\n（dry-run，未写库。去掉 --dry-run 实际执行。）");
  else console.log("\n✓ 完成");
} finally {
  await sql.end();
}
