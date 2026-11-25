# 8093 手机宽度及共享大图卡

用户于2026-11-10要求所有手机页面去掉过多留白，角色卡所有位置（包括创作）都用大图。实现范围仅8093。

## 改动
`src/app/reskin-siyu.css`追加`outputs/reskin-8093-width-20261110/width-cards.css`。
- 手机普通应用外壳统一10px左右边距，页面宽/窄容器不再重复添加padding；探索页额外16px margin归零。
- 创作`nj-my-char-rows`从44px缩略图行改为双列满幅竖版角色图；个人角色tab和创作者卡复用海报样式。
- 收藏已有满幅图片结构，统一竖版比例；不更改收藏操作和真实数据。
- 新的外壳规则排除包含`#nj_chat_app`的主区及其内部元素。

## 证据
390px浏览器下，页面client宽382（滚动条8px），主区内容宽362。探索每卡177px，x=10；此前每卡158px，x=28。创作卡同为177×318.6，图片和文案absolute叠层。
个人、设置、商城、对话：main边距10，页面wrapper边距0，scrollWidth382≤390。探索/创作截图独立复查通过；其它页面宽度测量不等于所有交互验收。未添加收藏测试数据；缺图角色维持其现有素材状态。

## 构建及备份
编译、TypeScript、角色client manifest检查通过。构建复用已有依赖；仅重建8093 app，接回yearn-chat_default。备份`/root/projects/yearn-reskin/backups/width-20261110/reskin-siyu.css`，旧镜像`yearn-reskin-app:before-width-20261110`。补丁和截图均在E盘目录。

产品理由见[设计思考](../insights/reskin-8093-mobile-width.md)。

最终部署：镜像`84f41946ddd52a41914320455460fd7fbdad2e8dd8c4fe026ac0828af42ce6c6`，HTTP200，网络重接成功。复查要求的聊天隔离选择器修正已部署；最终探索和创作截图已重取，创作卡在无滚动条时宽181px、x10。桌面1440下创作为四列257px竖图。缺图角色沿用现有资产，并未更换或虚构图片。
