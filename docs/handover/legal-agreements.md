# 技术交接 —— 用户协议 / 隐私政策

> 产品思考见 [docs/insights/legal-agreements.md](../insights/legal-agreements.md)。

两份法律文书上线：`/agreement/user`（使用者協議）与 `/agreement/privacy`（隱私政策）。
四个语言版本（zh-TW / ja-JP / th-TH / en），与 `SUPPORTED_LOCALES` 一一对应。

---

## 文件地图

| 路径 | 作用 |
|------|------|
| `src/lib/legal/types.ts` | 文书的结构化模型（`LegalDocument` / `LegalSection` / `LegalBlock`） |
| `src/lib/legal/constants.ts` | 联系邮箱 / 域名 / 生效日期的单一来源 |
| `src/lib/legal/documents/user-agreement.<locale>.ts` | 使用者協議正文 ×4 |
| `src/lib/legal/documents/privacy-policy.<locale>.ts` | 隱私政策正文 ×4 |
| `src/lib/legal/index.ts` | locale → 文书的解析入口 + 路由常量 |
| `src/components/legal/LegalDocumentView.tsx` | 渲染器（目录 / 章节 / 高亮框） |
| `src/app/agreement/{user,privacy}/page.tsx` | 两个 RSC 页面 |
| `src/lib/__tests__/legal-documents.test.ts` | 跨语言结构对齐 + 脱敏回归 |

入口：注册页按钮下方的同意声明（`src/app/(auth)/signup/page.tsx`）、设置页页脚
（`src/app/settings/page.tsx`）。

---

## 为什么正文不进 i18n 词典

`src/i18n/types.ts` 的 `Dict` 被 `i18n-dictionaries.test.ts` 强制要求
**每个语言逐叶对齐**（含未上线但作为作者化源头的 `zh.ts`）。把上万字的法律正文塞进去会有两个后果：

1. 作为对齐源头的 `src/i18n/zh.ts` 也会被强制要求有一份简中全文 —— 简中已经下线，不想为一个不上线的语言维护一份中文合同。
2. 词典是 UI 文案的地方，法律文本混进去以后没人能再快速 diff「这次改的是按钮还是条款」。

所以只有**外壳文案**（返回 / 目录 / 生效日期 / 注册同意声明）走 `dict.legal`，
正文按 locale 单独成文件。

## 为什么是结构化 TS 而不是 Markdown

条款要跨语言交叉引用（「详见第 4.6 条」「第 6.3 条所列法律红线」）。
Markdown 里第 8.2 条在日文版漂到第 8.3 条不会有任何报错；结构化数据可以让
测试逐章节比对**块指纹**（`paragraph!` / `list[7]` / `notice[3]`），漏翻一条列表项
就会挂 CI。

代价是编辑体验略差（要写 `{ kind: "paragraph", text: "…" }`），但法律文本
一年改不了几次，正确性优先。

---

## 三条不能改错的约定

1. **章节 `id` 是已发布 API。** 它同时是 URL fragment（`/agreement/user#liability`）
   和交叉引用锚点。发布后改 id 会断掉所有外部链接。

2. **改文书必须同步推 `LEGAL_EFFECTIVE_DATE_ISO`，并改四个文件里的
   `effectiveDate`。** 用户无从判断自己同意的是哪一版，是实打实的合规风险。

3. **正本是日文版。** 使用者協議第 14.5 条写死了「各版本有歧义以日文版为准」——
   因为运营主体是日本个人开发者、准据法是日本法。**改条款先改 `ja-JP`，
   再同步其余三份**，反过来会让正本落后于译本。

---

## 脱敏回归测试

`legal-documents.test.ts` 里有一条 `carries no Lumeow residue`：

```ts
/lumeow|lumiao|撸猫|嚕貓|新加坡|SIAC|singapore|女性向|ButterKnife|AndroidID/i
```

这两份文书改写自竞品公开协议的结构。这条断言防的是「以后补条款时从旧稿复制粘贴，
把别人的主体 / 管辖 / 定位重新带回来」。**加新条款时不要绕过它** —— 命中说明真的抄漏了。

---

## 隐私政策与实现的耦合点

隐私政策里这些是**对代码的事实陈述**，改实现时必须回头改文书（四个语言都要）：

- 第 3 章 Cookie 清单：`nj_locale`（`src/i18n/config.ts`）、
  `nj_show_nsfw`（`src/lib/explore/preferences.ts`）、Supabase 登录态 cookie。
- 第 6 章第三方清单：Supabase（认证 / DB）、Cloudflare R2（`src/lib/r2/client.ts`）、
  Stripe、Resend、AI 供应商（`src/lib/ai/provider.ts`：Anthropic / OpenAI / Google / DeepSeek）。
- 第 7 章技术措施提到「RLS 预设全拒绝」—— 对应 CLAUDE.md 的 RLS 约定。
- 第 8.2 条保留期限的「30 日内清理」与使用者協議第 4.6 条必须一致。

**加一个新的第三方服务商 = 一次隐私政策更新**，不是可选项。

---

## 遗留 / 待确认

- `LEGAL_CONTACT_EMAIL = support@dearm.ai` 是按域名推的，**收件箱尚未确认存在**。
  上线前要么建这个信箱，要么改成真实地址（改一处即可，四个语言自动跟着走）。
- 主体只写到「位于日本的个人开发者」，未写姓名 / 住所。日本《特定商取引法》
  对付费服务通常要求公示事业者姓名、地址、联系方式 —— 上线收钱前需要补一个
  「特定商取引法に基づく表記」页面。
- 责任上限写的是 10,000 日圓；月卡计价却是 HKD（Stripe 香港主体）。
  两个币种并存在法律上没问题，但如果主体信息之后调整，这两处要一起看。
- DeepSeek 的 API 条款是否明确排除「用 API 数据训练模型」需要逐条核实 ——
  两份文书都写了「只选用明示排除训练的供应商」，这是对外承诺。
