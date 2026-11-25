#!/usr/bin/env bun
/**
 * AI 润色角色卡脚本
 *
 * 功能：
 * 1. 读取原始角色卡数据
 * 2. 用 Claude API 检测和润色敏感内容
 * 3. 生成安全版本存入 dearm_sfw 数据库
 * 4. 保留原版映射关系
 */

import Anthropic from "@anthropic-ai/sdk";
import postgres from "postgres";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error("❌ 缺少 ANTHROPIC_API_KEY 环境变量");
  process.exit(1);
}

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// 连接原始数据库（只读）
const sqlSource = postgres(process.env.DATABASE_URL || "", { max: 1 });

// 连接 SFW 数据库（写入）
const sqlTarget = postgres(
  process.env.DATABASE_URL?.replace("/postgres", "/dearm_sfw") || "",
  { max: 1 }
);

interface Character {
  id: string;
  name: string;
  persona: string | null;
  opening: string | null;
  sample_dialogue: string | null;
  avatar_url: string | null;
  nsfw: boolean;
  visibility: string;
  owner_id: string;
  bio: string | null;
  tags: any;
  gender: string | null;
  age: number | null;
  content_type: string | null;
  adversity: string | null;
  default_cognition: string | null;
  plot_setting: string | null;
  output_setting: string | null;
  created_at: Date;
  updated_at: Date;
}

interface SanitizedResult {
  name: string;
  persona: string;
  opening: string;
  sample_dialogue: string;
  bio: string;
  tags: string[];
  hasChanges: boolean;
  reasoning: string;
}

const SANITIZE_PROMPT = `你是一个内容审核专家。任务：审核角色卡内容，将明显敏感的内容适度改写，让内容可以通过支付平台审核。

## 审核标准（适度策略，不要太严格）
- **必须改**：露骨的色情描写、暴力血腥细节、违法犯罪行为
- **适度改**：擦边球暗示、不当关系（师生恋等）→ 淡化暗示，但可保留情节
- **可以保留**：正常的恋爱关系、成年人角色、轻微负面情绪、职业设定（只要不违法）
- **不需要改**：普通的性格描写、日常对话、背景故事

## 改写原则
1. **轻改为主**：只改明显问题，不要大刀阔斧
2. **保留特色**：角色个性、说话风格、背景设定尽量保持
3. **自然过渡**：改写后要通顺，不能生硬
4. **灵活判断**：擦边但不露骨的内容可以保留

## 输入格式
\`\`\`json
{
  "name": "角色名",
  "persona": "人设",
  "opening": "开场白",
  "sample_dialogue": "示例对话",
  "bio": "简介",
  "tags": ["标签1", "标签2"]
}
\`\`\`

## 输出要求
返回 JSON（不要用 markdown 代码块包裹）：
\`\`\`json
{
  "name": "润色后的名字（通常不改）",
  "persona": "润色后的人设",
  "opening": "润色后的开场白",
  "sample_dialogue": "润色后的示例对话",
  "bio": "润色后的简介",
  "tags": ["过滤后的标签"],
  "hasChanges": true/false,
  "reasoning": "改动说明（如果有改动）"
}
\`\`\`

如果内容完全安全，hasChanges 为 false，直接返回原内容。`;

async function sanitizeCharacter(char: Character): Promise<SanitizedResult> {
  const input = {
    name: char.name,
    persona: char.persona || "",
    opening: char.opening || "",
    sample_dialogue: char.sample_dialogue || "",
    bio: char.bio || "",
    tags: char.tags || [],
  };

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `${SANITIZE_PROMPT}\n\n请审核以下角色卡：\n\`\`\`json\n${JSON.stringify(input, null, 2)}\n\`\`\``,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    // 提取 JSON（可能被包在 markdown 代码块里）
    let jsonText = content.text.trim();
    const match = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
    if (match) {
      jsonText = match[1];
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```\w*\s*/g, "").replace(/```\s*$/g, "");
    }

    const result = JSON.parse(jsonText) as SanitizedResult;
    return result;
  } catch (error) {
    console.error(`❌ 润色失败 [${char.name}]:`, error);
    // 失败时返回原内容
    return {
      name: char.name,
      persona: char.persona || "",
      opening: char.opening || "",
      sample_dialogue: char.sample_dialogue || "",
      bio: char.bio || "",
      tags: char.tags || [],
      hasChanges: false,
      reasoning: `API 调用失败: ${error}`,
    };
  }
}

async function main() {
  console.log("🚀 开始 AI 润色处理\n");

  // 1. 读取 107 张公开卡
  console.log("📖 读取角色卡数据...");
  const characters = await sqlSource<Character[]>`
    SELECT
      id, name, persona, opening, sample_dialogue,
      avatar_url, nsfw, visibility, owner_id,
      bio, tags, gender, age, content_type,
      adversity, default_cognition, plot_setting, output_setting,
      created_at, updated_at
    FROM characters
    WHERE visibility = 'public'
    ORDER BY conversation_count DESC
  `;

  console.log(`✓ 找到 ${characters.length} 张公开角色卡\n`);

  const results: Array<{
    original: Character;
    sanitized: SanitizedResult;
  }> = [];

  // 2. 逐张润色（带进度）
  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    const progress = `[${i + 1}/${characters.length}]`;

    console.log(`${progress} 处理中: ${char.name} (NSFW: ${char.nsfw})`);

    const sanitized = await sanitizeCharacter(char);
    results.push({ original: char, sanitized });

    if (sanitized.hasChanges) {
      console.log(`  ✏️  有改动: ${sanitized.reasoning}`);
    } else {
      console.log(`  ✓ 无需改动`);
    }

    // 避免 API 限速，每次间隔 1 秒
    if (i < characters.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n✅ AI 润色完成！共 ${results.length} 张卡\n`);

  // 3. 统计
  const changedCount = results.filter((r) => r.sanitized.hasChanges).length;
  console.log(`📊 统计：`);
  console.log(`  - 有改动: ${changedCount} 张`);
  console.log(`  - 无改动: ${results.length - changedCount} 张\n`);

  // 4. 写入 SFW 数据库
  console.log("💾 写入 dearm_sfw 数据库...");

  for (const { original, sanitized } of results) {
    await sqlTarget`
      INSERT INTO characters (
        id, owner_id, name, persona, opening, sample_dialogue,
        avatar_url, nsfw, visibility, bio, tags, gender, age, content_type,
        adversity, default_cognition, plot_setting, output_setting,
        created_at, updated_at
      ) VALUES (
        ${original.id}, ${original.owner_id}, ${sanitized.name},
        ${sanitized.persona}, ${sanitized.opening}, ${sanitized.sample_dialogue},
        ${original.avatar_url}, false, ${original.visibility},
        ${sanitized.bio}, ${JSON.stringify(sanitized.tags)},
        ${original.gender}, ${original.age}, ${original.content_type},
        ${original.adversity}, ${original.default_cognition},
        ${original.plot_setting}, ${original.output_setting},
        ${original.created_at}, ${original.updated_at}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        persona = EXCLUDED.persona,
        opening = EXCLUDED.opening,
        sample_dialogue = EXCLUDED.sample_dialogue,
        bio = EXCLUDED.bio,
        tags = EXCLUDED.tags,
        nsfw = false,
        updated_at = NOW()
    `;
  }

  console.log("✓ 数据写入完成\n");

  // 5. 生成报告
  console.log("📝 生成审核报告...");
  const report = {
    timestamp: new Date().toISOString(),
    total: results.length,
    changed: changedCount,
    unchanged: results.length - changedCount,
    details: results
      .filter((r) => r.sanitized.hasChanges)
      .map((r) => ({
        id: r.original.id,
        name: r.original.name,
        wasNsfw: r.original.nsfw,
        reasoning: r.sanitized.reasoning,
      })),
  };

  await Bun.write(
    "/tmp/sanitize-report.json",
    JSON.stringify(report, null, 2)
  );

  console.log("✓ 报告已保存到 /tmp/sanitize-report.json\n");
  console.log("🎉 全部完成！");

  await sqlSource.end();
  await sqlTarget.end();
}

main().catch((err) => {
  console.error("❌ 脚本执行失败:", err);
  process.exit(1);
});
