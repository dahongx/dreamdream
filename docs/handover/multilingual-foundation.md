# 多语言第一阶段技术交接

**状态：** 已完成第一阶段（2026-08-02）
**产品思考：** [multilingual-foundation.md](../insights/multilingual-foundation.md)
**Prompt 基线：** [master-prompt.md](./master-prompt.md)

## 范围

第一阶段主推台湾繁体中文、日语、泰语，英文兜底。无 Cookie、无可识别浏览器语言时默认 `zh-TW`。

**2026-08-09 去简中化：** 简体中文从 `SUPPORTED_LOCALES` 整条下线 —— 不在选择器里、`Locale` 联合类型里也没有 `zh-CN`。所有中文标签（含 `zh-Hans*` / `zh-CN` / `zh-SG` 和存量 `nj_locale=zh-CN` Cookie）一律折进 `zh-TW`，老 Cookie 无需清理即可平滑落到繁中。`src/i18n/zh.ts` 保留但**只作为翻译对照源**：`i18n-dictionaries.test.ts` 拿它当 source-of-truth diff 其余四本词典的叶节点与占位符，运行时永远加载不到它。

本阶段没有把所有路由迁到 `/[locale]/...`。登录回跳、Stripe 回跳和现有收藏 URL 都保持不变，语言通过 `nj_locale` Cookie 与 `Accept-Language` 协商。角色分享 URL 会附加受控的 `?lang=`，只用于稳定社交卡 metadata 语言；实际落地页仍优先使用访问者自己的请求语言。

本阶段覆盖普通用户与 creator 的产品界面；内部 admin 运维台继续使用现有工作语言，不作为目标市场发布阻断项。

## 运行时结构

- `src/i18n/config.ts`：唯一 locale 清单、别名归一、默认语言、质量权重协商、选择器标签。
- `src/i18n/dictionaries.ts`：仅服务端动态加载选中词典，避免客户端静态打包全部语言。
- `src/i18n/server.ts`：每个请求解析 locale 并加载词典。
- `src/i18n/client.tsx`：只接收 RSC 已选中的 `{ locale, dict }`。
- `src/components/LanguageToggle.tsx`：四语言选择器；切换后写 Cookie 并刷新当前页面。**用 Radix `DropdownMenu` 自渲染，不用原生 `<select>`** —— 浏览器会把 `<option>` 列表画成系统菜单（亮底黑字、各平台各画各的），DESIGN.md 的 token 一个都吃不到。浮层沿用 chat 顶栏菜单同一套 `border-strong` + `surface-solid` + `shadow-overlay`，选中项用 `accent-primary` + `ItemIndicator` 打勾。手机端它嵌在 `TopbarMobileMenu` 的 Popover 里，两层 Radix 浮层可以共存，不会互相 dismiss。
- `src/app/manifest.webmanifest/route.ts`：按 URL locale 返回 PWA 名称、说明和 `lang`，并隔离缓存变体。
- 运行时词典：`zh-TW.ts`、`ja-JP.ts`、`th-TH.ts`、`en.ts`。`zh.ts` 只是翻译对照源，不在 `dictionaries.ts` 的 loader 表里。

兼容别名：任何 `zh` / `zh-*` 标签（含旧 Cookie `zh`、`zh-CN`、`zh-Hans-CN`、`zh-Hans-SG`、`zh-SG`、`zh-HK`、`zh-MO`）统一解析成 `zh-TW`；`ja`、`th` 和下划线 locale 同样接受。不存在“目标词典缺 key 时偷偷显示简中”的运行时回退；完整结构由测试锁定。

PWA manifest 由动态路由按受控 locale 查询参数生成；运行时 `<html lang>` 同样按每次请求的 locale 输出。界面中的评论、会话、关注、钱包与后台日期统一把当前 locale 传给 `Intl`。

## 字体与输入

设计 token 名不变，`html[lang]` 只切换底层字族：繁中/日语的 display serif 与泰语 serif/sans 由 `@fontsource` 自托管；繁中/日语 body 优先当地系统 sans，避免完整 CJK 三字重额外增加约 20MB 静态资源。这样不会破坏 `--font-display-zh`、`--font-body-zh` 或已发布的 `nj_*` selector 契约。

用户名校验已改为 Unicode Letter / Mark / Number + 下划线 / 连字符，允许繁中、假名和泰文组合音标，仍限制 2–32 个字符并拒绝空格和其他标点。

## 平台目录与内置资产

平台的 37 个角色标签继续以既有 canonical 值写入数据库和 URL；Explore、筛选、角色卡、详情、分享页与收藏搜索只在展示层映射为当前语言，自定义 creator 标签保持原文。这样不会因为翻译修改筛选语义或污染存量数据。

官方美化包和官方规则同样采用“稳定资产 + 请求级投影”：数据库保存 locale-neutral canonical copy，包名、说明、env / memory replacement、output guidance 和示例按请求词典生成。官方手机 iframe 由 `I18nProvider` 把 locale 传进 sandbox host context，再选择五语可见文案；rule ID、pattern、`$1` / `$2`、HTML、`nj_*` selector 和 bridge 协议不变。

所有普通用户与 creator 可达的失败路径只展示词典中的通用错误，不再透传 Server Action、上传 API、模型接口或 Stripe 的原始异常文本。钱包把历史中文 note 先归类为 locale-neutral event kind，再按词典展示；底层审计记录不改写。

## 对话语言

聊天 API 从同一 `nj_locale` Cookie（无 Cookie 时看 `Accept-Language`）选择自然语言输出：

| UI locale | 对话 locale | 主模板 instruction units |
|---|---|---|
| `zh-TW` | `zh-Hant` | 已审核英文版 + 繁中输出约束 |
| `ja-JP` | `ja-JP` | 已审核英文版 + 日语输出约束 |
| `th-TH` | `th-TH` | 已审核英文版 + 泰语输出约束 |
| `en` | `en` | 已审核英文版 |

模型必须保留 creator 的 HTML、CSS、JS、selector、变量和标签，不得把结构 token 翻译掉。Gemini 中文副词清洗只在简中/繁中对话运行，不作用于日语或泰语。

`ConversationLocale` 仍保留 `zh-Hans` 这一档（主模板 instruction units 的原始撰写语言就是简中），但 UI 侧已经产不出 `zh-CN`，所以聊天链路再也走不到它。相应地 `wrapPlayerTurn` / `resolveUserName` / `normalizeConversationLocale` 的兜底默认值从 `zh-Hans` 改成 `zh-Hant`，对齐站点默认语言 —— 否则没设 displayName 的玩家会在繁中开场白里被叫成简中的「用户」。

每轮玩家消息中的 OOC 说明、面具字段、玩家输入标记与格式提醒也跟随会话语言；主回复和续写共用同一套 localized player-turn wrapper。匿名玩家兜底称呼随 response locale 变化。

## 创作者 AI 工具语言

`/api/ai/generate` 与聊天 API 使用同一套 locale 协商，并把服务端解析出的 locale 传给所有六类生成器，包括多轮 pack assistant。生成器共用一套密封的技术模板，在末尾追加高优先级 `<response_language>` 契约；这样无需维护五套容易漂移的 HTML / CSS / proposal 协议模板。

语言契约只本地化 creator / 玩家可见的自然语言，包括说明、组件名称、描述、`outputGuidance`、自定义槽位名、组件内文案与图片 prompt。XML / HTML / CSS / JS、JSON key、proposal type、selector、URL、`$1` / `$2`、`{{char}}` / `{{user}}` 和 Dearm 保留协议标记必须原样保留。模板中的简中示例只说明结构，不能覆盖目标语言。

开场组件槽位扫描使用 Unicode Letter / Mark / Number 属性类，因此繁中、日语假名与带组合音标的泰文槽位均可提取和插值。只有参考图、没有文字的 pack assistant 请求，也使用当前词典中的内部提示，不再持久化固定简中文案。

## 支付、分享与安装

Stripe Checkout 的月卡与金币包名称、描述和托管收银台 locale 跟随当前请求；HKD、一次性 `mode: payment`、支付方式、metadata 与 webhook 唯一履约信号没有变化。付款回跳会根据订单 `tier` 区分月卡与金币包，避免金币到账时误报“会员已开通”；仍为 pending 时使用商品中性的入账提示。

分享按钮把当前 locale 放进 `?lang=`，`generateMetadata` 用它生成稳定的 OG / Twitter 品牌文案，访问者页面本身仍按 Cookie / `Accept-Language` 显示。PWA manifest 使用独立动态路由和 locale 查询参数，四种语言的安装名称、说明与 `lang` 不再共用一份繁中静态文件。

## 验证

```bash
bun run prompt:check
bun run typecheck
bun test
bun run build
```

重点测试：

- `i18n-dictionaries.test.ts`：完整叶节点、非空文案、占位符与结构 token 一致。
- `i18n-config.test.ts`：四语清单与选择器同步、所有中文标签折进 `zh-TW`、区域别名、`Accept-Language` 权重。
- `auth-identity.test.ts`：三种目标文字的用户名。
- `conversation-locale.test.ts`：UI / 对话语言与 instruction units 分工。
- `ai-generators.test.ts`：六类创作者生成器的 locale 契约与协议 token 保护。
- `opening-content.test.ts`：繁中、日语假名与泰文自定义槽位提取、插值。
- `official-assets-i18n.test.ts`：官方包、规则和手机 iframe 的本地化投影及协议不变量。
- `stripe-checkout-i18n.test.ts`：四语 Stripe locale、月卡与金币包商品文案。

第一阶段验收：`404 pass / 0 fail / 9,231 assertions`，TypeScript、`prompt:check`、changed-file Biome、`git diff --check` 与 Next.js production build 均通过。生产服务冒烟确认 `<html lang>`、页面标题和动态 manifest 正确。

去简中化后复测：`407 pass / 0 fail / 8,634 assertions`，typecheck 与 Biome 全绿。dev 冒烟覆盖桌面与手机 375px：新下拉在两处都渲染成暗紫浮层，四语切换写 Cookie 后整站语言跟随，手动塞回 `nj_locale=zh-CN` 刷新后落到繁中且触发器不空白。

## 明确后置

- URL locale 前缀、canonical / hreflang 与本地化 SEO 落地页。
- session 级持久化语言（当前语言切换会影响后续回合）。
- 角色卡展示字段的 creator 多语言版本与翻译工作流。
- 日语、泰语、繁中原生主模板 instruction units；上线前必须独立版本化并做角色卡回放评测，不能拿少量日志样本冒充完整基线。
- 内部 admin 运维台的完整多语言化。
