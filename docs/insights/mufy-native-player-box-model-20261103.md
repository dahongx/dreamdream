# 迁移尺寸保护应尊重组件原始坐标系

窄 iframe 并不等于手机页面。将整站的防溢出规则注入独立文档，会改变作者用百分比加 padding 构成的布局；只有文本和颜色相等仍会漏掉明显挤压。

自查应同时核对计算盒模型、实际外宽和作者 padding。修复必须限制在已识别组件族、迁移自己注入的样式，不重写作者 CSS。20px相对 body 的差异还可能来自 margin collapse，不能据此直接补 padding。

交接与证据见 [handover](../handover/mufy-native-player-box-model-20261103.md)。
