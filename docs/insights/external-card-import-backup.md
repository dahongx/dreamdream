# 外部角色卡导入留底 — Insights

> Companion: [handover/external-card-import-backup.md](../handover/external-card-import-backup.md)

## 为什么要留底

外部导入有 5 个入口（一键 XML、pack 粘贴 CSS、pack 粘贴小剧场、pack 上传规则 JSON、从 JSON 建新包），但每一个都把作者**辛苦攒下的 prompt 工程产物**作为一次性输入消化掉，然后丢弃。如果：

- 作者本地文件被清缓存 / 误删 / 换电脑丢了
- 我们的解析器 / CSS 转换器某天升级，能解析出更多字段
- 线上某个角色出问题，需要回溯当初导入的源材料
- 来源平台那边卡下架，作者再也拿不到原始导出

——任何一种情况下，没有原文就是**一次性损失**。

留底是廉价的保险：导出 XML 平均不到 100 KB，CSS / 小剧场更小；几千次导入加起来还不到 1 GB。每次写一个文件 + 追加一行 jsonl，IO 微秒级。

## 为什么选文件系统而不是 Postgres / 对象存储

最初做了一版用 Postgres 文本字段存 xml 全文。用户的反馈是："我希望保存**原始文件**，例如建一个 `xml-data` 文件夹，把角色 A 的这 3 个部分保存在文件夹下 A-xml / A-css / A-xiaojuchang"。

这说明：

1. **心智模型是文件而不是行**。原始文件意味着以后能直接 `ls` / `cat` / `rsync`，不需要 SQL 查询和 base64 解码。
2. **按角色聚合是有意义的**。一个角色的 XML + CSS + 小剧场是一组，分散在不同 DB 表里查得很费劲。

对象存储（Supabase Storage）也排除了：现有的 `media` bucket 是 public，XML 里有 `persona` / `defaultCognition` 这些 CLAUDE.md 白名单**外**的 prompt 资产字段，不应该承担"URL 不被猜到 = 安全"的薄保护。新开私有 bucket 又要走 RLS / 签名 URL 那一套，比落本地盘麻烦得多。

落本地盘的代价：**容器重启会丢**。这交给部署侧用 volume mount 解决——比起新建 bucket 配 RLS，挂卷是更原生的做法。

## 为什么 pack-级粘贴要反查角色

用户的「按角色聚合」诉求里有个隐藏前提：**pack 通常和角色 1:1 绑定**。一键 XML 导入会自动创建「角色 A 的美化包」并自动订阅给角色 A，所以作者之后去 pack studio 粘 CSS / 小剧场时，pack 仍然只服务那个角色。

我们利用这一点：pack-级粘贴时按 `character_pack_subscriptions` 反查第一条绑定的角色，把 CSS / 小剧场也归到角色 A 的文件夹下。从作者角度看就是「我导入的所有原料都在 `林婉儿-xxx/` 里」，符合直觉。

边界情况（共享 pack、孤儿 pack）走兜底命名 `pack-<id8>`。这种情况很少（v1 暂时没有公开/共享 pack 流程），不值得为它优化。

## 为什么把 sanitize 做得这么紧

文件名拼接路径，又包含用户输入（角色名 / 小剧场组件名）——这是 path traversal 的经典攻击面。

`safeSegment` 的规则：

- 白名单：CJK 统一汉字 + 字母数字 + `_-.`
- 其它一律换 `_`
- 折叠连续 `_`，去首尾 `_`/`.`
- 最大 48 字符

这样保证：

- 角色名叫 `../../../etc/passwd` → `etc_passwd`
- 叫 `nul` 或 `con`（Windows reserved）→ 没影响，因为我们只跑 Linux
- 叫 `.hidden` → `hidden`
- 叫空字符串 → `untitled`

加上 charId 后 8 位做尾缀，同名角色也不会撞文件夹。

## 为什么备份失败不抛

到 save 这一步时，业务已经成功了：

- XML 路径：角色已经建好、pack 已经建好、规则已经写入、订阅已经挂上
- CSS 路径：pack.globalCss 已经更新
- 小剧场 / 规则路径：行已经 insert

留底只是给**我们**（工程师）以后能回溯。留底失败 = "以后这次事件没法重做"，但**对作者本次操作完全无感**。如果我们因为留底失败把整个 action 失败掉，作者会看到一个红色错误、以为导入没成功、可能去 retry——然后才是真正的 UX 灾难。

监控靠 stderr 日志和盘空间告警，不靠 user-facing error。
