# 产品思考：为什么自托管 Supabase

> 技术交接见 [../handover/self-host-supabase.md](../handover/self-host-supabase.md)。

## 决策背景

认证迁到 Supabase Auth 后，面临「Cloud vs 自托管」的部署分叉。选了**自托管到自己的 VPS**。

## 为什么不上 Supabase Cloud

寄情的产品定位决定了这个选择，不是技术偏好：

1. **零内容审核是核心立场**。数据放第三方，就要受其 ToS / 滥用策略约束 —— 而平台本来就服务
   NSFW 受众、不做任何检测。数据留在自己机器上，这条立场才站得稳。
2. **creator 的 prompt 工程是核心资产**（persona/opening/sampleDialogue 等 6 个字段是护城河）。
   越少经手第三方越好。
3. **数据主权**：用户私信、角色卡全在自己可控的 VPS。

代价是清醒的：自己当 DBA + 运维（备份 / 升级 / 监控）。对一个重数据主权的小团队，这笔交换划算。

## 一个意外的安全红利

自托管时，Supabase 那个**默认开放公网的 PostgREST Data API**可以直接从网关层关掉（kong.yml 删
`/rest/v1` 路由）。Cloud 上它默认开着，逼你必须把 RLS 写对才安全；自托管让我们干脆把这个入口
焊死 —— 公网只剩 auth 和 storage。于是裸 IP 阶段连 RLS 都不必先写，攻击面反而比 Cloud 更小。

「少给一个入口」往往比「给入口配对一堆策略」更可靠。

## 为什么裁剪而非用官方全栈

官方 self-host compose 有十几个容器（realtime / edge functions / 连接池 / 日志分析 / 后台 UI）。
本产品一个都没用到。4c4g 上全开会逼近 OOM；裁到 6 个核心容器后内存 ~1G，宽裕。

裁剪的纪律：**砍掉的每个服务，都要同步砍掉它在 kong 网关、db init 脚本里的依赖**，否则启动即挂。
这也是为什么不手写、而是 vendoring 官方文件再删 —— self-host 的复杂度藏在服务间的隐式耦合里。

## 裸 IP 起步的取舍

域名/HTTPS 没就绪，先裸 IP 跑通全链路。唯一被迫推迟的是**强制邮箱验证** —— 裸 IP + http 的确认
邮件链接送达率差、且当前代码连 `/auth/callback` 回调页都还没有。所以裸 IP 阶段 autoconfirm 关掉
验证，把「开验证」整体留到域名阶段一次做完（配 SMTP + 写回调链路）。

避免了配出一个「发得出邮件但点了链接 404」的半成品。先让系统活起来，再让它体面。
