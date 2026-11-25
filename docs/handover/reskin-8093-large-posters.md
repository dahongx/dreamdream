# 8093 深色大图升级

目标仅 `115.29.213.73:8093`，源码 `/root/projects/yearn-reskin`，容器 `yearn-reskin-app-1`。8091、8094、正式环境不在此次部署范围。

设计依据见 [产品思考](../insights/reskin-8093-large-posters.md)。

## 文件
- `src/app/reskin-siyu.css` 追加受 `html[data-reskin="siyu"]` 限定的覆盖层。
- `src/app/me/page.tsx` 添加个人页样式 hook 和对话、收藏、角色的真实导航，复用现有字典。
- E 盘完整补丁、升级前快照位于 `outputs/reskin-8093-20261109/`。

## 视觉契约
底色 #191c19，表面 #242923，强调 #b5c39b，主文字 #f0efe5，弱文字 #a5ad9d。沿用已有自托管字体。手机双列海报，封面铺满卡片；底部渐暗区显示名字、标签、简介、真实计数。桌面按断点两到四列。新增手机页面 padding 仅作用探索和个人页，不触及聊天自定义内容。

## 构建与回滚
服务器备份 `/root/projects/yearn-reskin/backups/ui-20261109/`，旧镜像标签 `yearn-reskin-app:before-ui-20261109`。标准依赖下载停滞，改用已有镜像的 node_modules 构建，新增 `Dockerfile.ui`、`build-existing.py`，不升级依赖。

重建后只启动 app：`APP_PORT=8093 docker compose up -d --no-deps app`；重接 `yearn-chat_default` 后重启此容器。回滚可恢复两个备份源文件并重建，或将旧镜像重新标为 latest 后只重建此 app 容器、重接网络。

验收证据与最终状态在补丁目录记录。没有更改数据库或角色资产。

## 发布结果
已部署镜像 `sha256:825360b9c0c63189dcafd355f99d72f64125b2d17a1ad950f845f2509b88fb39`，HTTP 200；app 网络重接成功。构建包含 Next 编译、TypeScript、21 个静态页面生成及角色 client manifest 检查。样式检测无发现。

浏览器验证：手机390×844探索双列满幅海报，桌面1440×1000四列；手机个人页六入口，收藏点击抵达 `/sessions?tab=favorites`；搜索谢寻返回两张匹配卡，点击进入真实角色详情。320宽文档宽312，无横向溢出。截图在补丁目录，独立审图通过提供的三视图；未声称覆盖真机与全部角色美化包。8091和8094容器运行时长未变化。
