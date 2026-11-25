# 独立播放器盒模型保真

实际来源与8091对照发现，独立播放器内两份迁移所有的 `mobile-box-model` 样式会因 iframe 宽度小于480px命中，将 `.censy-player-shard` 从 content-box 改成 border-box，外宽从217px挤到179.5px。

`nativePlayerDocumentPresentation` 只识别此公开组件族，并将带明确迁移标记的 universal reset 收窄到 html/body。作者样式、脚本、文案保持不变，其他组件不受影响。本地真实侧栏恢复217.5px；来源217px的亚像素差与155/151.667px高度差仍待最终字体/尺度验收，不能宣称整卡一致。

实际证据位于批次 `final-acceptance/44/black-box-model-diagnosis-20261103.json`。2项测试、7断言通过，生产依赖类型检查通过，UI检查无发现。仅准备11文件差异，没有构建或发布。播放器已通过正常控件暂停。作者原程序在音频错误时自动换曲播放，因此本地禁媒体环境不能用来认证播放或当前曲目。

产品思考见 [insights](../insights/mufy-native-player-box-model-20261103.md)。
