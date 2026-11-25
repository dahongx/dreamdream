/**
 * 外部导入留底（文件系统）—— 每次导入相关 action 调用一次。
 *
 * 目的：把作者上传/粘贴的**原始**载荷（XML / 全局 CSS / 小剧场 HTML / 正则 JSON）
 * 在服务器上落一份原文。Parser 升级了 / 线上事故了 / 作者本地丢了，都能从这里
 * 把原料找回来批量重跑。
 *
 * 落点：默认 `./data/card-imports/`，由 env `IMPORT_BACKUP_DIR` 覆盖。生产请挂卷。
 *
 * 文件夹结构（用户视角，与对话里那条「A-xml / A-css / A-xiaojuchang」原型一致）：
 *
 *   <BACKUP_DIR>/
 *     <safeName>-<charId8>/        ← 每个角色一个文件夹
 *       xml-<timestamp>.xml        ← 角色卡 XML 原文
 *       css-<timestamp>.css        ← 作者粘贴的全局美化 CSS 原文
 *       xiaojuchang-<safeName>-<ts>.html  ← 作者粘贴的小剧场原文
 *       rules-<timestamp>.json     ← 作者上传的正则 JSON 原文
 *       meta.jsonl                 ← 追加日志：每行一条事件（含 userId / packId / 错误等）
 *
 *   pack-<packId8>/                ← 当 pack-级粘贴反查不到关联角色时用 pack id 兜底
 *
 * 设计取舍：
 * - 文件系统而非 Postgres：用户明确希望"原始文件"形态，且 prompt 资产
 *   字段不应该进 `media` public bucket（CLAUDE.md 白名单立场）。落本地盘
 *   后由部署侧负责挂卷 / 备份。
 * - 备份失败**永不阻断业务**：try/catch 包死，只 `console.error`。原因
 *   是导入本身已经成功了，留底失败只影响以后我们能不能批量重做，不影响
 *   作者当下的体验。
 * - 不做去重：每次导入都是独立时间点，重复粘贴本身就是有意义的事件
 *   （比如作者改了 css 又重新粘）。
 * - 角色名做严格 sanitize：路径必须可预测、不可被注入。
 */

import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { characterPackSubscriptions, characters } from "@/lib/db/schema";

export type ImportBackupKind = "xml" | "css" | "xiaojuchang" | "rules";

export interface SaveImportBackupInput {
  kind: ImportBackupKind;
  userId: string;
  /** 文件原始字节内容（utf-8 文本）。 */
  content: string;
  /** 浏览器上传时的 file.name；只用于 meta，不参与路径。 */
  originalFilename?: string;
  /** 已知关联的角色 id —— XML 路径上 action 直接传；pack 路径上由本函数反查。 */
  characterId?: string;
  /** 已知角色名 —— 优先用作文件夹前缀，省一次 DB 查询。 */
  characterName?: string;
  /** 已知关联的 pack id —— pack-级粘贴必传，XML 路径建包后也会传。 */
  packId?: string;
  /** 用于小剧场组件名 / 给 meta 留辨识；会被 sanitize 进文件名。 */
  label?: string;
  parseOk?: boolean;
  parseError?: string;
  lockedFields?: string[];
}

const DEFAULT_DIR = "./data/card-imports";

function backupRoot(): string {
  const raw = process.env.IMPORT_BACKUP_DIR?.trim();
  return resolve(raw && raw.length > 0 ? raw : DEFAULT_DIR);
}

/**
 * 把任意输入串清洗成路径片段：
 *   - 中文 / 英数 / 下划线 / 连字符 / 点 保留
 *   - 其它一律换 _
 *   - 折叠连续 _，去首尾 _ 与 .
 *   - 防 path traversal（最终结果绝不含 `..` / `/` / `\`）
 *   - 限长，避免单个角色名 100+ 字符撑爆 ext4 文件名（255 字节）
 */
function safeSegment(input: string, maxLen = 48): string {
  const cleaned = input
    // nothing to strip; sanitization below handles all non-allowed chars
    .replace(/[^\w一-鿿.-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_.]+|[_.]+$/g, "");
  if (!cleaned) return "untitled";
  // 中文 1 字符多字节；按字符数截，max 估算 48 字符约 144 字节，安全。
  return cleaned.slice(0, maxLen);
}

/** ISO-like timestamp without colons/dots (filesystem-safe). */
function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  );
}

/**
 * 决定该次备份落到哪个文件夹：
 *   1. characterId + characterName 全有 → `<safe(name)>-<id8>`
 *   2. 只有 characterId → 查一次 name
 *   3. 只有 packId → 查 characterPackSubscriptions 的第一条挂的角色
 *   4. 都没有 → `pack-<packId8>` 兜底；连 packId 都没有 → `user-<userId8>`
 *
 * 反查失败时返回最稳的兜底，绝不抛。
 */
async function resolveFolder(input: SaveImportBackupInput): Promise<string> {
  let charId = input.characterId;
  let charName = input.characterName;

  if (!charId && input.packId) {
    try {
      const [sub] = await db
        .select({ characterId: characterPackSubscriptions.characterId })
        .from(characterPackSubscriptions)
        .where(eq(characterPackSubscriptions.packId, input.packId))
        .orderBy(characterPackSubscriptions.orderIndex)
        .limit(1);
      if (sub) charId = sub.characterId;
    } catch {
      // ignore — fall through to pack-level folder
    }
  }

  if (charId && !charName) {
    try {
      const [row] = await db
        .select({ name: characters.name })
        .from(characters)
        .where(eq(characters.id, charId))
        .limit(1);
      if (row) charName = row.name;
    } catch {
      // ignore
    }
  }

  if (charId) {
    return `${safeSegment(charName ?? "character")}-${charId.slice(0, 8)}`;
  }
  if (input.packId) {
    return `pack-${input.packId.slice(0, 8)}`;
  }
  return `user-${input.userId.slice(0, 8)}`;
}

function filenameFor(input: SaveImportBackupInput, ts: string): string {
  const ext =
    input.kind === "xml"
      ? "xml"
      : input.kind === "css"
        ? "css"
        : input.kind === "xiaojuchang"
          ? "html"
          : "json";
  if (input.kind === "xiaojuchang" && input.label) {
    return `xiaojuchang-${safeSegment(input.label)}-${ts}.${ext}`;
  }
  return `${input.kind}-${ts}.${ext}`;
}

/**
 * 留底主入口。永不抛——所有 IO / DB 失败被 catch 后只 log，业务调用方
 * 不需要包 try/catch。
 */
export async function saveImportBackup(
  input: SaveImportBackupInput,
): Promise<void> {
  try {
    const root = backupRoot();
    const folder = await resolveFolder(input);
    const dir = join(root, folder);
    await mkdir(dir, { recursive: true });

    const ts = timestamp();
    const filename = filenameFor(input, ts);
    const filepath = join(dir, filename);
    await writeFile(filepath, input.content, "utf8");

    const metaLine = `${JSON.stringify({
      ts: new Date().toISOString(),
      kind: input.kind,
      filename,
      originalFilename: input.originalFilename ?? null,
      userId: input.userId,
      characterId: input.characterId ?? null,
      packId: input.packId ?? null,
      label: input.label ?? null,
      byteSize: Buffer.byteLength(input.content, "utf8"),
      parseOk: input.parseOk ?? null,
      parseError: input.parseError ?? null,
      lockedFields: input.lockedFields ?? null,
    })}\n`;
    await appendFile(join(dir, "meta.jsonl"), metaLine, "utf8");
  } catch (err) {
    // 不抛：业务（导入本身）已经成功，留底只是为以后能重做。失败也要让
    // 作者把活干完。线上靠 stderr / 日志收集发现这里有异常。
    console.error("[card-import-backup] save failed", {
      kind: input.kind,
      userId: input.userId,
      characterId: input.characterId,
      packId: input.packId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
