# 8093 帮助与法律页面同步

产品说明见 [insights](../insights/reskin-legal-sync.md)。

## 范围

仅部署 /root/projects/yearn-reskin 的 yearn-reskin-app-1（8093）。共享 postgres 业务库不执行迁移或清理；8091 与 play.dearm.ai 容器保持不变。

新增 NEXT_PUBLIC_UPDATED_LEGAL=1，与 SFW_MODE 分离。site-documents.ts 根据普通版情况适配共用文书；LEGAL_PAGES_ENABLED 控制入口、注册确认与注销提示。旧站点未开启开关时继续使用原协议。不要为启用说明页面而把 8093 切成 SFW。

- 公司：StarEcho Technologies Limited，80678055；客服 support@dearm.ai，退款回复目标 10 个工作日，非银行到账保证。
- 普通版保留创作者分级和用户显示偏好，未承诺新增自动审查。
- 隐私文本反映国内服务器、自架 Supabase、模型中转及 HTTP 预览，没有沿用日本入口或 Cloudflare 的不适用描述。
- 注册保留邀请码相关参数和后台逻辑，只增加 18 岁与协议确认；注销文字与退款说明一致。
- 原界面、角色、图片、聊天及余额处理不变；增加页脚七个入口、商店购买前说明与测试付款提示。

## 部署与回滚

版本：yearn-reskin-app:legal-sync-20261120，兼容原自动镜像名 yearn-reskin-app:latest。原版本保留 yearn-reskin-app:before-legal-sync-20261120。

备份：/root/projects/yearn-reskin-legal-20261120。old-container.private.json、source-before/、runtime.private.env 等包含私密配置，不能上传 GitHub。source-before-hashes.json 与 source-restoration-map.json 记录源码备份。

已同步源目录，Dockerfile 添加公共开关和 APP_URL 的构建参数；Compose 添加对应 build args 及现有共享认证网络。APP_PORT 固定为实际的 8093；APP_SITE_URL 仅覆盖 app 的 SITE_URL，未修改共享 Auth 的站点配置。后续构建必须传 NEXT_PUBLIC_UPDATED_LEGAL=1。

部署时发现旧 .env 的 APP_PORT=8091 与实际运行端口不一致。第一次回滚造成 8093 短暂停止，已用旧容器快照恢复，并修正持久配置。8091 与 8094 容器未重建。回滚应依实际快照恢复端口和两个网络，不能盲用旧 .env。

## 检查

- 候选与 8093 上四种语言 28 个文书页面、公司身份及客服链接检查通过。
- 探索页 135 个角色链接与部署前一致，普通版内容分级未改。
- 登录后的商店说明、测试支付提示、后台注册确认拦截、密码恢复链接指向 8093 检查通过。
- 使用现有镜像的准确依赖构建，8 个专项测试、2283 项断言以及生产构建/角色客户端 manifest 检查通过。
- 文书模块 TypeScript 检查通过；114 个原有聊天、角色、探索和公开资源文件的哈希未变。目录数据仍为 188 张角色、135 张公开、83 张公开成人分级。
- 最后确认 8091、8093、8094 探索页均返回 200，8091 与合规站的容器 ID 与部署前一致；验收账号在认证及两套业务库均无残留。
- 临时验收账号仅用于本轮检查，完成后通过 Admin API 删除。不执行真实付款、退款或测试邮件发送。
- 客服邮箱实际收信与手机视觉检查不是本次服务器/API 验证的结论，不能据此宣称已经完成。
