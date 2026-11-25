# 公开头像复制适配

产品说明：[保留头像库，复制仅填草稿](../insights/mufy-avatar-draft-copy.md)。

`adaptMufyAvatarDraftCopy` 仅适配公开 IMG 上已知的 `navigator.clipboard.writeText(this.src);alert('Image Link Copied!')`。出现次数、IMG 处理器数量、HTTP(S) 图片来源必须全部通过边界检查；未知程序不改。处理器替换为 `window.host.fillComposer(this.src)`，不读剪贴板、不自动发送、不扩展沙箱。

裴宪宇候选基于正常 owner 美化编辑界面读取的 198747 字符基线，只改 33 个精确处理器；反向替换后其余字节完全相同。33 个原始头像地址保留。真实本地 OpeningSlot 预览点击前两个头像分别得到对应原始地址，发送计数为 0、iframe 数为 1。预览的 600px 高度限制仅用于隔离测试，不写入角色候选。

候选尚未写入 TEST，依赖整批待发布的草稿回填回调。未执行整批构建、发布或数据库操作。两项单测检查窄边界、幂等、原文保持与无自动发送；最新集中回归 211 项通过、920 断言，定向类型检查通过。过程耗时与 Agent 净工时分列，不推算净工时。
