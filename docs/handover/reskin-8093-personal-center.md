# 8093 个人中心技术交接

日期：2026-11-10。产品依据见[产品思考](../insights/reskin-8093-personal-center.md)。

## 范围与实现

仅测试站 `115.29.213.73:8093`，源码 `/root/projects/yearn-reskin`，容器 `yearn-reskin-app-1`。本轮未改正式服。补丁及验收输出位于 `outputs/reskin-8093-me-20261110/`。

个人中心主页提供九个入口。邀请、钱包和收益通过 `/me?section=` 的三个白名单子视图呈现，每个子视图都有返回入口。角色入口仅通过 `/mine` 跳转到 `/create?tab=characters`。`ProfileTabs` 新增可选 `initialTab`、`hideNavigation`；其他调用保持默认行为。

## 部署状态

最终 QA 镜像 `sha256:edabddc57c157a5ed4f9298c53cc86886f40ad6fc412a4aa001b2fdbf8eb849a` 已部署并复测。构建包含 TypeScript 与 character client manifests 检查，日志 `/tmp/reskin-me-qa-20261110.log`；容器运行、RestartCount 为0。源码备份为服务器项目内 `backups/me-qa-before-20261110.tar.gz`。

## 已完成验收

验收访问真实 8093。因本机 SSH/HTTP 链路间歇 reset，使用临时 SSH 隧道 `127.0.0.1:18793`，并非 mock；尚无证据表明网络根因已永久修复。

- 九入口导航通过；个人中心桌面 1440px 呈三列入口。
- 钱包明细及充值记录空态、收益总览及明细空态通过。
- 邀请复制成功，展开可见三条记录。
- following 空态、settings 呈现、shop 呈现通过。
- sessions 近期与收藏空态通过；收藏页无效筛选条已移除并复测。
- create 与 explore 保持大图：390px 宽时卡片约 177×319px，360px 宽时约 162×292px；已检页面无横向溢出。

## QA 修正与复测

1. `ReferralSection` 增加可选 `hideTitle`，消除邀请子视图重复 h2；其余使用保留默认标题。
2. sessions 收藏页的空白 `FilterPills` 来自字典缺失，且收藏夹原为占位功能；移除无效占位条，保留搜索与收藏能力。

补丁部署后复测：邀请只显示一个 h1、没有重复 h2；收藏空态没有无文字按钮；钱包和收益入口及返回正常，最终个人中心浏览器 error 日志为空。邀请复制/记录展开在此前真实站点实测成功；收藏搜索与取消收藏的代码保留，经独立静态复查，没有对测试账号执行收藏增删。

补充小屏320px检查无横向溢出；390px聊天模型菜单为304×320px、内部滚动。截图位于输出目录：`me-mobile-final.png`、`invite-mobile-final.png`、`favorites-mobile-final.png`、`model-menu-mobile.png`。临时隧道、本机临时登录状态及视口已清理。服务日志另有付款手机号未填写的PayProo校验提示，未修改支付资料或逻辑，不计作支付验收通过。

手机实机触摸、真实支付、模型生成不在本次验收范围。
