# 外部角色卡导入原文留底 (文件系统)

> Companion: [insights/external-card-import-backup.md](../insights/external-card-import-backup.md)

每次作者通过导入入口上传/粘贴原始内容时，把那份**原文**在服务器上落一份文件。Parser 升级、prefix 规则改了、作者本地 XML 丢了、线上事故复盘——都能从这堆原文里批量重跑。

## 覆盖的 5 个入口

| 入口 | Action | 内容 | 留底类型 |
|---|---|---|---|
| `/mine` 一键导入角色卡 | `importExternalCharacterAction` | 外部角色卡 XML 全文 | `xml` |
| Pack studio 粘贴全局美化 | `importExternalCssToPackAction` | 外部全局 CSS 原文（未经选择器前缀替换） | `css` |
| Pack studio 粘贴小剧场 | `importExternalOpeningToPackAction` | 外部小剧场 HTML 原文 | `xiaojuchang` |
| Pack studio 上传正则 JSON | `importExternalRulesToPackAction` | 外部正则规则 JSON 原文 | `rules` |
| `/packs` 从 JSON 直接建新包 | `importExternalRulesAction` | 同上 | `rules` |

XML 路径上有两次落点：解析失败时（save 一份用于排查 parser）、解析成功且角色已建好时（再 save 一份带 characterId/packId 关联）。

## 落点结构

默认根目录 `./data/card-imports/`（用 env `IMPORT_BACKUP_DIR` 覆盖；生产请挂卷）。

每个角色一个文件夹，命名 `<safeName>-<charId 前 8 位>`：

```
data/card-imports/
├── 林婉儿-3f8a9c10/
│   ├── xml-20260624T103015.xml          ← 角色卡 XML 原文
│   ├── css-20260624T103120.css           ← 作者粘贴的全局美化原文
│   ├── xiaojuchang-默认-20260624T103245.html   ← 小剧场原文（label 进文件名）
│   ├── rules-20260624T103302.json        ← 正则 JSON 原文
│   └── meta.jsonl                        ← 每行一条事件元信息
├── 不知火舞-7c4b...
└── pack-9a2f31e8/                        ← 没有角色挂的孤儿 pack 落这里
    └── ...
```

`meta.jsonl` 每行一个 JSON 对象：
```json
{"ts":"2026-06-24T10:30:15.022Z","kind":"xml","filename":"xml-20260624T103015.xml",
 "originalFilename":"林婉儿.xml","userId":"...","characterId":"3f8a9c10-...",
 "packId":"...","label":null,"byteSize":48217,"parseOk":true,
 "parseError":null,"lockedFields":["小剧场"]}
```

## 文件夹归属决策（saveImportBackup → resolveFolder）

XML 路径上 action 直接传 `characterId + characterName + packId`，命中规则 1。

Pack-级粘贴时只有 `packId`，按下面顺序反查：

1. `characterId + characterName` 都已知 → `<safe(name)>-<id8>`
2. 只有 `characterId` → 查一次 `characters.name`
3. 只有 `packId` → 在 `character_pack_subscriptions` 里按 `orderIndex asc` 取**第一条**绑定的角色，回到规则 1/2
4. 都没有 → `pack-<packId8>`；连 packId 都没有 → `user-<userId8>`

**多角色共享 pack 时**：始终落到 orderIndex 最小那条订阅对应的角色文件夹下。一份 pack 的多次粘贴可能跨越「无订阅 → 有订阅」状态，所以同一 packId 在不同时刻可能落到不同文件夹。`meta.jsonl` 里始终带 `packId`，方便事后合并查询。

## 失败语义

`saveImportBackup` **永不抛**。所有 IO / DB 失败被 `console.error` 后返回。理由：

- 业务（导入本身）此时已经成功（XML 解析完 + 角色建好 / CSS 已 merge）
- 留底失败只影响**以后我们能不能批量重做**，不影响作者**当下**的体验
- 留底失败统一靠 stderr/日志收集监控，作者无感

## 涉及文件

- `src/lib/import/external-card-backup.ts` — 留底主入口 + 文件夹归属反查 + 路径 sanitize
- `src/lib/characters/import-actions.ts` — XML 入口（解析失败 / 成功两次 save）
- `src/lib/packs/import-actions.ts` — pack-级 3 个入口 + 建新包入口
- `src/components/characters/ImportExternalCardButton.tsx` — 上传时传 `file.name` 进 action
- `.gitignore` — `/data/card-imports/` 不入仓库

## 部署侧待办

1. 生产容器挂卷：把 `IMPORT_BACKUP_DIR`（或默认的 `./data/card-imports/`）映射到宿主持久盘
2. 定期 rsync / S3 sync 到异机
3. 监控：盘空间 + `[card-import-backup] save failed` 日志告警

## 重做（replay）

**没有 UI/CLI**，按需手写脚本。重做的入口是 `parseExternalCharacterXml(text)` / `parseExternalRulesJson(text)` / `convertLegacyCss(text)`——把 `data/card-imports/*/xml-*.xml` 喂回去即可。

为什么不预写脚本：重做语义因事故而异（覆盖现有角色？diff 报告？dry-run？新建副本？），提前预设容易选错；先把原料存好，事故来时再写脚本就 30 行的事。
