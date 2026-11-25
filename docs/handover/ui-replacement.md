# 整站界面升级（ui-replacement）技术交接

> 产品思考与取舍见 [docs/insights/ui-replacement.md](../insights/ui-replacement.md)。
>
> 状态：**候选原型 + 汇报用概念图阶段**。方向未选定，未接入业务，未部署，未改 `src/`，未动数据库。

---

## 一、这一轮到底交付了什么

严格区分两条产出线，汇报和后续开发都不能混为一谈：

| 产出 | 位置 | 性质 | 能否直接上线 |
|------|------|------|--------------|
| **C 方案可上线预览** | 测试服 `8899/siyu/` | 单文件 HTML + jpg | **是**（演示用，已部署） |
| 三套高清设计效果图 | `outputs/ui-report-20261103/*.png` | **图像生成的概念图** | 不能。是视觉方向示意 |
| 三套可点击网页原型 | `outputs/ui-candidates/` | 手写 HTML/CSS/JS | 不能。是独立原型，不是项目组件 |
| 早期视觉概念图 | `outputs/ui-candidates/original-concepts/` | 图像生成 | 不能。但它是本轮**设计源头** |
| 四页对比长图 | `outputs/ui-candidates/screenshots/*-pages-20261103.jpg` | 原型真实截图 | — 供评审用 |

**最容易出错的认知**：`outputs/ui-report-20261103/` 里那三张大图不是代码渲染出来的。图里的排版、字体、人物细节大量是生成结果。有人问"这个什么时候能上线"时，正确答案是"这是方向稿，落地要按代码重做一遍"。

**唯一的例外是 C 方案预览**：`#/siyu` 那套是真实代码渲染的，可以直接给人看、可以在手机上滑动、可以点开模型菜单。它不是概念图。

---

## 二、四个技能的安装位置与各自职责

全部装在项目内 `E:\agent\YearnAI\yearn-chat\.agents\skills\`，**不占 C 盘**，C 盘旧副本已确认移除。

| 技能 | 体积 | 实际是什么 | 在本轮的作用 |
|------|------|------------|--------------|
| `impeccable` | 2.3 MB | 带可执行程序（`scripts/impeccable.cmd`）+ 40 余份工作手册 + 浏览器截图引擎 | **主干**。载入项目上下文、生成设计方向、检测问题 |
| `ui-ux-pro-max` | 3.7 MB | 本地可检索数据库（79 风格 / 192 配色 / 74 字体搭配 / 119 条 UX 规则），入口 `scripts/search.py` | 检索移动端布局、长文阅读、触控规范 |
| `frontend-design` | 24 KB | **纯说明文档**，无脚本无数据 | 提供视觉判断原则：配色性格、字体层级、版式取舍 |
| `web-design-guidelines` | 4 KB | **纯审查工具**，每次从 Vercel GitHub 拉最新规范 | 逐条比对，**只输出 `file:line` 报告，不改代码** |

### 归属要说准的两点

1. **网页是手写的，不是 `frontend-design` 写的。** 它给的是判断框架，代码由开发者落地。
2. **`web-design-guidelines` 只发现问题，不负责修。** 收藏状态、浏览器返回、模型选择键盘操作这些修复，是拿到它的报告后手工改的。

另外，**浏览器截图验收不是 skill**，是工具加流程。但它是必要步骤——`impeccable` 自身也要求「按实际发布尺寸看渲染结果」。

### 一处容易讲错的措辞

「UI/UX Pro Max 舍弃了不适配的通用 SaaS 建议」这句是对的，且**正是它自己的明文要求**：检索结果只算建议，须验证是否适配；不适配应说明未找到可用匹配，不得硬套。放心这么写。

---

## 三、实际执行流程

1. 通读四个 `SKILL.md`，确认能力边界。
2. 跑 `impeccable context` 载入项目状态；写 `PRODUCT.md`（`impeccable:product-schema` 格式）固化需求与约束。
3. 跑 `concept-seed --scope direction --mode operate` 生成设计方向。
4. `ui-ux-pro-max` 检索：`entertainment roleplay immersive --design-system`、`social entertainment`、`popover mobile overflow`。首轮返回通用 SaaS 模式，已明确弃用；收窄到娱乐/消费类后才采纳。
5. 按方向手写原型：`outputs/ui-candidates/app.html` + `app.js` + `app.css`，覆盖发现 / 详情 / 聊天 / 收藏 / 模型选择。
6. `web-design-guidelines` 审查，按其报告修复：
   - 浏览器返回时角色消息串台
   - 搜索结果中的收藏语义不一致
   - 桌面导航缺少激活态
   - 模型选择 radiogroup 键盘操作与 tab stop
7. 浏览器按 390×844 手机尺寸实拍验收，抓出模型菜单宽度问题。
8. 用户反馈「三套区别不够大」→ 补 `boards.html` + `variants.css`，拉开详情页与聊天页版式差异，每套四页长图。
9. 用户指出「原概念图更好看、区分度更高」→ 找回 `original-concepts/`，确认设计源头应为那三张。
10. 出汇报用三张大幅效果图（Imagegen）。

---

## 四、已知限制（交付时必须说明）

- **概念图 ≠ 可运行页面**，见第一节。
- **原型字体是系统字体**，跨设备排版未验收。
- **`nj_*` selector 契约与创作者自定义美化兼容性未验证。** 原型刻意不复用生产组件，所以它通过不代表接入后也通过。这是正式实现阶段最大的风险点。
- **模型健康状态全部是 `待观察`**，未接真实统计。原型不制造成功率、延迟或在线人数。
- **移动端模型菜单**：原型宽 252px、列表内部滚动。这是按此前多次反馈「过宽过长」做的，但尚未在真机验证。
- **原型的角色文案与对话均为原创演示**，不来自真实角色设定；封面沿用展示素材。
- 全程未改 `src/`、未改 `DESIGN.md`、未动测试服或正式服。

---

## 五、本地预览

```bash
python -m http.server 8767 --bind 127.0.0.1 --directory outputs/ui-candidates
```

- 三方案对比：`http://127.0.0.1:8767/`
- 四页评审长图：`http://127.0.0.1:8767/boards.html?skin=cinema|channel|letter`
- 单独体验：`http://127.0.0.1:8767/app.html?skin=cinema|channel|letter&page=explore|detail|chat|saved`

---

## 五点五、C 方案预览（已部署测试服，2026-11-03）

按用户确认的三个约束实现：**深色炭黑+灰绿 / 纯静态 / 核心三页**。

### 访问地址

```
http://115.29.213.73:8899/siyu/
```

- `#/explore` 探索页（默认）
- `#/detail/xiexun` 角色详情
- `#/chat/xiexun` 聊天页

### 为什么用 8899 而不是新开端口

测试服上已有 `dearm-preview.conf` 提供的静态服务（`/var/www/dearm-preview`，监听 8899，公网可通）。
直接复用，**没有新增 nginx 配置、没有改防火墙、没有新增容器**。8093 实测外网 502 不通，不是可靠选择。

### 该静态服务的限制（关键约束）

`dearm-preview.conf` 只声明了三种 MIME：

```nginx
types { video/mp4 mp4; image/jpeg jpg; text/html html; }
```

后果：`.css` / `.js` 会被当成 `text/html` 返回，浏览器拒绝执行。

**因此页面必须打成单文件**：CSS 内联在 `<style>`，JS 内联在 `<script>`，字体 base64 内嵌，封面用 `.jpg`。
往这个目录放多文件站点会静默失效——这是个只在真机验收时才暴露的坑。

### 实现要点

| 项 | 做法 |
|---|---|
| 中文字体 | 从 `@fontsource/noto-serif-sc` 取 600/900 字重，用 `pyftsubset` 按页面实际用字（517 字）子集化，各约 82 KB 后 base64 内嵌；全文不依赖网络字体 |
| 封面图 | 取测试服现有角色封面（谢寻/许霖/温予辞/文时安/江淮/文然），压到 760px 宽、quality 82，每张 40–63 KB |
| 字体体积 | 未子集化时每个字重 1.5 MB，直接内嵌会让单文件超过 3 MB；子集化是必需步骤，不是优化 |
| 构建 | `src.html` 内留 `__FONT600__` / `__FONT900__` 占位，打包脚本替换为 base64 产出 `dist/index.html`（250 KB） |

### 实际验收结果（Playwright，真实渲染）

桌面 1440×900 与手机 390×844 双语均实测：

- 页面零 JS 报错、零资源加载失败
- 手机端 `document.scrollWidth = 390`，**无横向溢出**
- 模型菜单：宽 248px（占屏 **64%**）、高 312px（占屏 **37%**）、完整在视口内
- 长模型名 `Gemini 3.1 Pro (thinking-128)` 正确省略为 `(thi…`，不撑破菜单
- 键盘：`ArrowDown` 可在选项间移动，`Esc` 关闭并把焦点还给触发按钮
- 选择模型后按钮标签同步更新（验证到 `Opus 4.7`）

### 按 Web Design Guidelines 修正的项

审查后逐条改的（不是"看了一遍"）：

- 补 `color-scheme: dark`、`theme-color`
- 输入框原有 `outline:0` 无替代 → 改为 `:focus-within` 边框 + 光晕
- `<label>` 里套 `<button>` 属无效结构 → 改 `div` + 独立 `aria-label`
- 所有图标补 `aria-hidden="true"`，所有 `<button>` 补 `type="button"`
- 图片补显式 `width`/`height` 防 CLS
- 搜索框补 `name`、`autocomplete="off"`，占位符省略号统一为 `…`
- 补跳过导航链接、`touch-action: manipulation`、`overscroll-behavior`

### 验收时抓到的真实缺陷（已修）

初次进入手机聊天页时，正文停在顶部、用户消息被输入框压住。
加 `scrollChatToEnd()` 在渲染后滚到底，复验：`atBottom: true`、`overlapped: false`。
这类问题静态检查发现不了，只有真机渲染能抓。

---

## 六、下一步

1. 用户选定方向（当前助手推荐 B 心动频道 + C 的阅读排版，**尚未获选**）。
2. 选定后先在项目里做 **selector 兼容性预研**，再动 `src/`。
3. 正式实现需覆盖：探索 / 详情 / 聊天 / 会话列表 / 创作 / 设置，全部页面都要过 `nj_*` 契约。
4. 在测试服验证通过后，再讨论正式服。

---

## 七、与 git / 服务器关系（重要）

**这一轮产物不进 git，也不应进 git。** 它们是设计素材，不是项目代码。

- `outputs/` 已加入 `.gitignore`，防止误 `git add -A`。
- 本地仓库**落后** `origin/main`，不在本地开发。实际在跑的是测试服和正式服上的代码。
- 需要核对线上版本时，直接只读登录服务器查 `git rev-parse HEAD`，不要以本地仓库为准。

---

## 八、汇报口径（可直接引用）

> 界面升级分两条产出线。
>
> **一、设计方向。** 用 Impeccable 载入项目现状、生成三套视觉方向并做问题检测；用 Frontend Design 确定每套的配色、字体与版式性格；用 UI/UX Pro Max 检索移动端布局、长文阅读和触控规范，不适配的通用建议已剔除。据此产出三套高清效果图，均含桌面首页与手机聊天。
>
> **二、可点击原型。** 按上述方向手写页面，覆盖发现、详情、聊天、模型选择四个页面；再用 Web Design Guidelines 逐条审查，按其报告修正了收藏状态、浏览器返回、模型选择键盘操作等问题；最后用浏览器按手机尺寸实际验收。
>
> 目前三套效果图为概念示意，原型为本地可交互版本，均未接入业务、未部署。

---

## 九、整站真实换皮（2026-11-06，已部署测试服）

上一节的 8899/siyu 是**独立静态原型**。这一节是把同一套视觉真的套到**运行中的完整应用**上，用于给团队做完整功能体验。

### 地址

```
http://115.29.213.73:8093
```

登录：直接用测试服已有账号（同一个数据库）。要新账号就现场注册，邮箱自动确认已开启。

### 它是什么

不是新项目、不是副本代码库。它跑的是**测试服的同一份源码 + 数据库**，只多了一层纯视觉覆盖：

| 文件 | 改动 | 是否影响功能 |
|------|------|--------------|
| `src/app/reskin-siyu.css` | 新增，511 行，全部规则挂在 `html[data-reskin="siyu"]` 下 | 否 |
| `src/app/layout.tsx` | 加一行 import + `<html data-reskin="siyu">` | 否 |
| `src/components/characters/CharacterGridCard.tsx` | 把立绘容器包进 `.nj-card-shot`，供手机端改成相对定位 | 否（桌面行为不变） |

**回滚方式**：删掉 `<html>` 上的 `data-reskin="siyu"` 属性，立刻回到原版设计，CSS 文件留着不生效。

服务器位置 `/root/projects/yearn-reskin/`（测试服源码的镜像副本），容器 `yearn-reskin-app-1`，镜像 `yearn-reskin-app:latest`。

### 部署时必须记住的两件事

1. **只起 app 一个服务**：`APP_PORT=8093 docker compose up -d --no-deps app`。不加 `--no-deps` 会连带拉起一整套第二份 Supabase（db/kong/auth…），起在空数据库上，页面会是空的。
2. **起完要接网络**：新容器只挂在 `yearn-reskin_default` 空网络上，解析不到 `db` / `kong`。
   ```
   docker network connect yearn-chat_default yearn-reskin-app-1
   docker restart yearn-reskin-app-1
   ```
   注意 `docker compose up` / `rebuild` 会重建容器、**丢掉这条网络连接**，每次重建后都要重接一遍。

### 验收结果（Playwright 真实渲染，2026-11-06）

桌面 1440×900 与手机 390×844 各跑一遍：

| 页面 | 桌面 | 手机 | 横向溢出 | 控制台错误 |
|------|------|------|----------|------------|
| `/explore` | 200，107 卡 | 200，双列 178px 海报 | 无 | 无 |
| `/sessions` | 200 | 200 | 无 | 无 |
| `/create` | 200 | 200 | 无 | 无 |
| `/me` | 200 | 200 | 无 | 无 |
| `/shop` `/packs` `/settings` `/mine` | 200 | 200 | 无 | 无 |
| `/characters/<id>` | 200 | 200 | 无 | 无 |
| `/chat/<id>`（真实发消息） | 200 | 200 | 无 | 无 |

底色全站统一 `rgb(31, 32, 29)`（`#1f201d`），圆角 2px，无一处溢出色。

### 修掉的四个真实缺陷

这些都是**第一版 CSS 写错、靠真实渲染才看出来**的，不是设计问题：

1. **副标题变成一整条灰绿色带**。原 CSS 把 `background` 加在 `.hero-eyebrow` 上（它是 `display:flex` 的整行），整块被涂满、文字压在色块里。改成只染 `::before` 那道短分隔线。
2. **桌面 hero 下方 500px 死白**。原版在桌面给 `.explore-hero` 写死 `height: clamp(420px, 61.9vw, 760px)`，是为了容纳月门场景图；场景一关就只剩空气。改成 `height:auto` + 内容撑开。
3. **文案层是绝对定位**。`.explore-hero-copy` 用 `position:absolute` + 写死 `top` 钉在月门图上，容器必须是固定高度。改回 `position:static`，缩进用 padding 表达。
4. **手机端 ☰ 删不掉**。探索页手机端把 `#app-topbar` 整个 `display:none`，改用 hero 内 `.explore-hero-chrome` 浮层顶栏接管，☰ 在标准顶栏里、根本不可见。正确做法是把标准顶栏请回来、关掉 hero 浮层，再把桌面那组控件（语言 / NSFW）在手机端摊平直出。**这两个是真功能入口，不能直接删**——已验证 NSFW 切换后卡片 107→52、语言菜单 4 项可用。

### 已知非问题（原版就有，不是换皮引入）

已逐一在 8091 原版对照确认：

- `/creators` 返回 404。
- `/characters/new` 显示「故人不在此」。
- **个人页中间那个只有图标、没有文字的按钮**——原版同样缺文案（`<a>` 里只有一个 lucide 图标，无文字节点）。
- **聊天页背景是棕褐色而非炭黑**。那是角色自带的「美化包」（creator CSS / iframe），属于角色内容，不在全站换肤范围内。这正是设计上正确的边界。
- **无头浏览器截图在已登录的长列表页会超时**。214 个元素各带一层 `backdrop-filter`，无头合成器卡住。原版 8091 同样复现。绕过办法：先用一次登录拿 `storageState`，再用**全新 browser context** 打开目标页截图。**这不影响真实浏览器**，不是产品缺陷。

### 还没验的

- 角色编辑页 `/characters/<id>/edit`（需要 owner 权限，QA 账号不是任何卡的 owner）。
- 调试模式面板（只有卡 owner 可见，同上）。
- 正则 `runtime:iframe` 双轨渲染的完整规则集（聊天页只碰到了一个美化包）。
- 移动端真机（只在 Chromium 模拟视口验过）。
