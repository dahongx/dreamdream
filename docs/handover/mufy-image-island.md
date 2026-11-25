# 段信头像表情小岛（本地候选）

产品取舍见 [insights](../insights/mufy-image-island.md)。尚未保存 TEST 或构建发布。

来源 source4 是父页面注入的三页小岛，不是无可见内容的 helper。真实页面有音乐、9 张头像、16 张表情；当前 TEST 父根缺失。`stage-mufy-duanxin-image-island.ts` 在通过正常美化工作台读回的当前 owner 基线上，核对公开 `htmlFragment/styleText` 字面量一致后替换唯一原文档，逆向替换恢复所有其他字节。原图、颜色、结构和音乐 URL 不替换。

严格 `image-island` 配置限定25个无凭据原始 HTTPS 图片链接、原始单曲 URL 和零子文档。`MufyImageIsland` 用独立 ShadowRoot、清理后的原 CSS 与有限事件控制器；不执行作者脚本、不读取来源存储、不开放 iframe/父 DOM/RPC。三个页签显隐由有限控制器明确管理，原字体现实测值、根盒模型恢复；外层仅限制手机边界。父级重绘不重建 audio 或图片。

复制仅响应真实用户事件，复用宿主复制工具，等待成功后显示原文“链接已复制”，失败明确显示；没有发送接口。音频初始 preload=none 且不设置 src，真实用户点击才加载，保留原站 loop，不自动播放。关闭不暂停，卸载清理事件/计时器并停止媒体。

本次浏览器对 music.163.com 明确限制访问，因此不启动该原曲，也不通过其他浏览器、协议或嵌套页面绕过；播放未通过不得伪称原站资源失效。真实 UI、复制、尺寸和图片结果以 `final-acceptance/35/image-island-*-20261031.json` 为准，整卡仍未验收。
