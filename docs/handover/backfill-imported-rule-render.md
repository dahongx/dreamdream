# 运维手册：修复外部导入规则渲染 + 去重（一次性回填）

> 给在**正式服务器（自托管 Supabase / VPS）**上执行的 agent 看。这是一次性数据回填，
> 会写正式库。**严格按步骤来，遇到「⛔ STOP」必须停下等人类确认，不要自行决定实写。**

---

## 0. 这次在修什么（背景，30 秒）

从外部一键导入的角色卡，规则是直接落库的，绕过了表单保存路径的两道处理，于是历史行有两个病：

1. **渲染外壳没归一**：外部格式的 `replaceString` 用 markdown 代码围栏（```` ```html … ``` ````）当 iframe 外壳。寄情只在 `replacement` 整体是 `<artifact>…</artifact>` 时才路由进沙箱 iframe（`src/lib/regex/segments.ts`），否则掉进 sanitize 路径、`<script>`/`<style>` 被删、围栏被 react-markdown 当**代码块**原样吐出 —— 整个互动组件（「小手机」等）就废了。
2. **`outputGuidance` 与卡面正文重复**：旧导入器凭 pattern 自动补一份「把回复用 `<Tag>` 包裹」的指令，但 creator 往往已在「输出设定」等正文里写过同一标签。两份都进 system prompt → 同一标签的「何时/如何输出」被注入两遍且措辞冲突。

**导入器本身已经修好**（`src/lib/import/external-card.ts`：围栏归一 + 导入规则一律 render-only 不再自动生成指令）。新导入不会再有这两个病。**本手册只负责把存量历史行对齐到同样的结果。**

回填脚本：`scripts/backfill-imported-rule-render.ts`，做两件事：

- **A 围栏归一**：对每条规则跑 `normalizeReplacementEnvelope`，结果有变才 `UPDATE replacement`。幂等。
- **B 去重指导**：**仅当**「规则所在包只被 1 个角色订阅」**且**「该角色正文已文档化此标签」时，把 `output_guidance` 清成 `NULL`。
  - 限定**单订阅者包**，是为了不误伤多人共享 / studio 自建包、以及官方美化包（`寄情手机`/`<phone>` 等）里别的角色依赖的合法指导。**这条不会乱删官方包/手写规则的指导。**

只动 `replacement` 和 `output_guidance` 两列，不碰 `pattern` / `enabled` / `visible` / 别的表。

---

## 1. 前置确认

```bash
# 1.1 在仓库目录下（docker compose build 的同一个目录）
cd /path/to/repo        # 换成实际路径

# 1.2 确认代码是最新的（必须包含导入器修复 + backfill 脚本）
git log --oneline -5
ls scripts/backfill-imported-rule-render.ts      # 不存在就先 git pull

# 1.3 确认正式栈在跑、db 健康
docker compose ps        # supabase-db / 应为 healthy
```

如果 `scripts/backfill-imported-rule-render.ts` 不存在，说明正式服的代码还没同步到含本次修复的提交，**先把代码拉到位再继续**（`git pull` 或你们的部署流程）。

---

## 2. ⚠️ 先备份（自托管没有第三方兜底，必须做）

```bash
bash deploy/backup.sh
ls -lh "${DEARM_BACKUP_DIR:-./backups}" | tail -3      # 确认 db-<时间>.dump 刚生成
```

确认看到一份新的 `db-*.dump` 再往下。**没备份不许进第 4 步实写。**

---

## 3. 看清楚规模（只读，先心里有数）

```bash
docker exec supabase-db psql -U postgres -d postgres -P pager=off -c "
SELECT
  count(*)                                                               AS rules_total,
  count(*) FILTER (WHERE replacement ~ ('^\s*' || chr(96)||chr(96)||chr(96)))  AS fenced_replacements,
  count(*) FILTER (WHERE output_guidance IS NOT NULL)                    AS rules_with_guidance
FROM regex_rules;"
```

记下 `fenced_replacements`（A 的上限）和 `rules_with_guidance`（B 的候选上限）。

---

## 4. Dry-run（只算不写）

回填脚本 import 了 `src/lib/import` 和 `src/lib/regex`（还有 `@/` 别名要 `tsconfig.json`），而 `migrate` 镜像默认没 COPY 这些。所以用**运行时挂载源码**的方式跑 `migrate` 容器（它已有 bun、node_modules、`env_file: .env` 即正式库 `DATABASE_URL`、且在 compose 网络里能解析 `db`）：

```bash
docker compose run --rm --no-deps \
  -v "$PWD/src:/app/src:ro" \
  -v "$PWD/scripts:/app/scripts:ro" \
  -v "$PWD/tsconfig.json:/app/tsconfig.json:ro" \
  migrate bun scripts/backfill-imported-rule-render.ts --dry-run
```

脚本末尾会打印形如：

```
[dry-run] 将改动：
  A 围栏归一: N 行 / 共 M 条规则
  B 去重指导: P 行 / 共 Q 条候选（单订阅者包 + 有自动指导）
```

**校验**：`N` 应 ≈ 第 3 步的 `fenced_replacements`（允许略小：内部含 ```` ``` ```` 的边角围栏不转换，属正常）；`P ≤ Q ≤ rules_with_guidance`。每行 `[A]`/`[B]` 是具体要改的规则名 + id 前缀。

> 排错：若报 `Cannot find module` → 三个 `-v` 挂载没对（确认在仓库根目录、`$PWD` 正确）。
> 若报连接错误 → 正式栈没起或 `.env` 的 `DATABASE_URL` 不对（应是 `postgres://…@db:5432/postgres`）。

---

## 5. ⛔ STOP —— 把 dry-run 摘要交给人类确认

**不要自己决定实写。** 把第 3 步的规模数字 + 第 4 步的 `将改动` 摘要贴给人类，明确问一句：「A 改 N 行、B 改 P 行，是否执行实写？」**等到明确的「执行 / go / 跑吧」再进第 6 步。** 没有明确同意就停在这里。

---

## 6. 实写（去掉 `--dry-run`）

```bash
docker compose run --rm --no-deps \
  -v "$PWD/src:/app/src:ro" \
  -v "$PWD/scripts:/app/scripts:ro" \
  -v "$PWD/tsconfig.json:/app/tsconfig.json:ro" \
  migrate bun scripts/backfill-imported-rule-render.ts
```

结尾应打印 `✓ 完成` 和 `已改动：A … 行 / B … 行`，数字与第 4 步 dry-run 一致。

---

## 7. 验证

```bash
# 7.1 围栏应基本清零（剩余的是内部含 ``` 的边角，可接受）
docker exec supabase-db psql -U postgres -d postgres -P pager=off -c "
SELECT count(*) FILTER (WHERE replacement ~ ('^\s*' || chr(96)||chr(96)||chr(96))) AS still_fenced,
       count(*) FILTER (WHERE replacement LIKE '<artifact>%') AS now_artifact
FROM regex_rules;"

# 7.2 抽查一条被改的规则：replacement 应以 <artifact> 开头
docker exec supabase-db psql -U postgres -d postgres -P pager=off -c "
SELECT name, left(replacement,40) AS head, (output_guidance IS NULL) AS guidance_cleared
FROM regex_rules WHERE replacement LIKE '<artifact>%' LIMIT 5;"
```

**最终确认（人类）**：随便开一张带「小手机」的角色卡聊一句，确认手机/对话组件**真的渲染成组件**了（不再是一坨代码块），且回复里没有两份打架的组件标签说明。

---

## 8. 回滚

- 脚本幂等，重跑不会二次破坏。
- 若发现异常，用第 2 步的 dump 还原：
  ```bash
  # 谨慎：这是全库还原，会覆盖现状。先和人类确认。
  docker exec -i supabase-db pg_restore -U postgres -d postgres --clean --if-exists < ./backups/db-<时间>.dump
  ```
- 单卡级别想还原原始导入内容：原始导入 XML 留底在 `IMPORT_BACKUP_DIR`（默认 `./data/card-imports/`，见 `docs/handover/external-card-import-backup.md`），可据此重导。

---

## 附：让它变成可复用命令（可选，不做也行）

若以后还想跑这类脚本、不想每次挂载，给 `Dockerfile` 的 `migrate` 阶段加三行后 `docker compose build migrate`：

```dockerfile
# 在 `FROM … AS migrate` 段，已有的 COPY 之后追加：
COPY src/lib/import ./src/lib/import
COPY src/lib/regex  ./src/lib/regex
COPY tsconfig.json  ./tsconfig.json
```

之后就能直接（无需 `-v` 挂载）：

```bash
docker compose run --rm --no-deps migrate bun scripts/backfill-imported-rule-render.ts --dry-run
```

---

## 速查（TL;DR）

```bash
cd /path/to/repo
git pull                                   # 确保含本次修复
bash deploy/backup.sh                       # 1. 备份
# 2. dry-run
docker compose run --rm --no-deps \
  -v "$PWD/src:/app/src:ro" -v "$PWD/scripts:/app/scripts:ro" -v "$PWD/tsconfig.json:/app/tsconfig.json:ro" \
  migrate bun scripts/backfill-imported-rule-render.ts --dry-run
# 3. ⛔ 把摘要给人类确认
# 4. 实写（去掉 --dry-run）后验证 + UI 抽查
```
