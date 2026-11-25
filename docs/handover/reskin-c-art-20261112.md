# C预览图案与构图纠偏

最新用户澄清：重点是布局美化与漂亮图案，保留之前更亮堂/提高对比度方向。纯压暗版本未部署，服务器源码已恢复到c-dark-before后再追加本轮art.css。

复用C可运行预览src.html内已有的ICON.branch原始SVG，不新造占位装饰。加入既有探索页头右侧留白、桌面侧栏下部、个人信息面板的淡化装饰；只用CSS伪元素与背景，无新增功能/DOM/路由/数据。手机收敛到110×140，不挤占双列大图；保留既有明亮对比度配色。

构建/tmp/reskin-c-art-20261112.log；源码备份backups/c-art-before-20261112.css；原运行镜像d51d3fb45cc3已标记before-c-art-20261112，非未发布的纯深色镜像。detector []。

## 发布与验收

最终镜像36fe4454350bab59896ae21024d89c0cd6ff2a43b7e35a900e672f3de82f1ea6，容器running。日志/tmp/reskin-c-art-verified-20261112.log。中间图案版338f曾发现hero-copy继承left28/top104导致错位，已立即回滚d51，再修复inset和SVG xmlns后重新完整构建。最终样式由线上CSS与public SVG提供，截图没有注入临时CSS。

实际IAB手机390标题归位，枝叶右侧正常、无横向溢出；320与1440亦无溢出；个人中心9入口保留。截图explore-mobile-final.png/explore-desktop-final.png/me-mobile-final.png。临时Chrome预检CSS已reload清理，两浏览器viewport已reset。未做业务消耗测试。纯压暗版从未发布。
