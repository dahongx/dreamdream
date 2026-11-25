# 沈砚四箭头导航（本地候选）

产品取舍见 [insights](../insights/mufy-narrow-navigation.md)。尚未写入或发布 TEST。

`stage-mufy-shenyan-narrow-navigation.ts` 仅解析公开的 `censy-narrow-nav-v14` 惰性壳、样式与四个动作标识，追加严格 `pageControls.navigation='narrow'` 配置。原作者父页面程序不执行。该组件位于父页面，不在九个 iframe 计数内，必须单独登记。

`MufySourceControls` 的有限控制器保留四箭头、35% 初始顶部定位、22×216 尺寸、中间拖动区域和原字体。仅滚动 `#nj_chat_messages`，上下步长为聊天可视高度的 0.8；不复制原站滚动所有容器的副作用。拖动约束在当前视口，键盘方向键以 10px 移动；卸载移除事件。仅在已识别根节点恢复被通用过滤移除的 fixed 定位，不扩大全站 CSS 权限。

实际桌面浏览器已对照回顶、到底、上下步长，真实拖动成功，稳定父级重绘保持坐标，输入未变、发送0。首次视口设置误绑到其他活动标签，未取得390布局的样本保留。关闭该临时媒体错误页、绑定新本地验收页后实际390×844补验：35%初始顶部位置、边缘拖动和键盘移动可用；位置动画的中间态与落定态分开记录，最终10px键盘位移确认。不是物理触屏。以 `final-acceptance/43/narrow-navigation-*-20261031.json` 为准。整卡验收未完成。
