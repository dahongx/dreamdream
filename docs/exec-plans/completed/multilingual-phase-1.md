# 多语言第一阶段执行计划

**状态：** 已完成（2026-08-02）
**范围：** 台湾繁中、日语、泰语为主推语言；简中、英文兼容保留。

## 交付项

- [x] 拉取并确认主干最新代码，保留用户工作树文件。
- [x] 审计上游线上数据与 single-master prompt 资产。
- [x] 以结构化 canonical master 替换 Dearm 旧手拼 host prompt。
- [x] 统一新回复与续写的 prompt lead 语义，并让用户关闭的 visible rule 不再影响模型。
- [x] 完整繁中、日语、泰语 UI 词典与动态加载基础。
- [x] Cookie / `Accept-Language` locale 协商、目标语言输出约束、Unicode 用户名。
- [x] TC / JP / Thai 自托管字体并保持设计 token 契约。
- [x] 本地化平台标签、官方包/规则/手机 iframe、支付、分享 metadata 与 PWA manifest。
- [x] 完成全量测试、生产构建和文档验收。

## 不在本次范围

- `[locale]` URL、hreflang / localized sitemap。
- 数据库中的 session locale 与 creator 内容翻译 schema。
- 大规模角色卡翻译或把原始日志复制进产品仓库。
- 未经回放评测的日语/泰语/繁中原生 master prompt。
- 内部 admin 运维台的完整多语言化。

## 完成验收

- `prompt:check`：canonical 模板 174 units、10,839 张卡重建一致。
- TypeScript typecheck 通过。
- `bun test`：404 pass、0 fail、9,231 assertions。
- Next.js production build 通过。
- changed-file Biome 无 error（保留一条既有 reduced-motion `!important` warning）。
- `git diff --check` 通过。
- 五语 SSR `<html lang>`、页面标题和动态 PWA manifest 生产服务冒烟通过。
- Prompt 来源、版本、哈希和 adapter version 可由 debug metadata 追溯。
- handover / insights 双份文档完成并互链。
