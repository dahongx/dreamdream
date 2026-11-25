#!/usr/bin/env bun
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
const dir = resolve(process.argv[2] ?? "logs/mufy-profiles/full-20261013");
const json = async (name: string) =>
  JSON.parse(await readFile(join(dir, name), "utf8"));
const job = await json("job.json");
const selection = await json("test-selection.json");
const audit = await json("selection-identity-version-audit.json");
const plan = await json("local-baseline-plan.json");
const staged = await json("priority-source-preflight.json");
const live = await json("selection-live-evidence.json");
const rejected = await json("audited-rejections.json");
type StageRow = {
  name: string;
  requiredTextPresent: boolean;
  dryRunNoBlockingErrors: boolean;
  blockingIssues: { code: string; message: string }[];
  warnings: { code: string }[];
  publicSync: string;
};
const rows = staged.rows as StageRow[];
const failed = rows.filter((r) => !r.dryRunNoBlockingErrors);
const stamp = new Date().toLocaleString("zh-CN", {
  timeZone: "Asia/Shanghai",
  hour12: false,
});
const lines = [
  `Mufy筛选与迁移实验：本轮进度（北京时间 ${stamp}）`,
  "完整规则见同目录《工作流程与验收口径.txt》。本页读取当前实验文件生成，不将预检数量当成成品数量。",
  "",
  "一、当前计数",
  `本地档案：${job.sourceCount}条；收藏排序并排除已有/错配后，保留${selection.rows.length}张候选草稿。`,
  `最新草稿详情读取：${audit.summary.readSuccess}/${audit.summary.requested}成功，失败${audit.summary.readFailed}。`,
  `优先预检：${plan.priorityCount}张；其余${plan.remaining.length}张继续身份核对或公开资料同步。`,
  `优先卡原文指纹验证与素材导出：${staged.staged}张；人物和开场字段具备：${rows.filter((r) => r.requiredTextPresent).length}张。`,
  `迁移器dry-run无阻断：${rows.filter((r) => r.dryRunNoBlockingErrors).length}张；阻断：${failed.length}张。`,
  "本批次服务器迁移写入0；手机/桌面成品验收通过0。无阻断不等于资源、运行态或成品合格。",
  "",
  "二、为何排除与如何处理",
  ...rejected.rows.map(
    (r: { name: string; reason: string }) =>
      `- ${r.name}：${r.reason} → 排除本地-线上关联，向下补位。`,
  ),
  "名称不相容、明确不同版本的初筛排除另见rejected-associations.json；同卡如果另有正确来源可重新候选。",
  "",
  "三、预检阻断（保留修适配，不自动换卡）",
  ...failed.map(
    (r) =>
      `- ${r.name}：${r.blockingIssues.map((i) => i.message).join("；")}。方案：保留原始混合内容，将CSS与HTML/音频等组件分开适配，捕获来源运行态，修通用兼容层后重验；不得删掉非CSS内容骗过检查。`,
  ),
  "",
  "四、通过与不过的口径",
  "采集通过：完整读取查询或详情并保存时间；只证明读取成功。",
  "初筛保留：真实roleId去重、名称对应、排除测试库存碰撞及已审定错配；仍需核对改名来源。",
  "优先预检：本地主角名对应，公开开场或足够长正文一致，已知年龄有一致证据；并非写库准入。",
  "可同步：身份、世界观一致且差异只在可见开场/HTML/样式等有来源字段；保留本地隐藏Prompt底稿，不猜改人物。",
  "替换：明确不同人物、人生版本或档案内部错配；另找来源/候选。",
  "需确认：身份或核心设定差异不能从已有证据解决；展示两侧事实、原因与建议。",
  "预检不过：迁移器错误、原文指纹改变、必需文本缺失、关键运行态未取到；修复/补采并重验，不计迁移完成。",
  "成品通过：TEST-only目标防重、原文与来源一致、资源可用、运行态和手机/桌面交互验收均通过；本批次尚未达到。",
  "",
  "五、本轮取证耗时",
  ...live.rounds.map(
    (r: {
      purpose?: string;
      requested: number;
      startedAt: string;
      finishedAt: string;
    }) =>
      `- ${r.purpose ?? "角色详情核对"}：${r.requested}次，${((Date.parse(r.finishedAt) - Date.parse(r.startedAt)) / 1000).toFixed(3)}秒（含串行等待），UTC ${r.startedAt} → ${r.finishedAt}。`,
  ),
  `- 最近一次优先卡文本导出与dry-run：${(staged.elapsedMs / 1000).toFixed(3)}秒。身份取证、系统开发、登录暂停、资源检查和视觉验收分开记录。`,
  "",
  "六、下一步",
  "18张无阻断预检卡仍需来源运行态、完整道具/媒体、资源可用性、目标防重及视觉验收。",
  "2张混合样式/HTML阻断卡先修通用适配并重跑；其余80张继续人物与公开差异核对。具体数量以下次动态报告为准。",
];
await writeFile(join(dir, "本轮进度与决策.txt"), lines.join("\r\n") + "\r\n");
console.log(
  JSON.stringify({
    report: "本轮进度与决策.txt",
    priority: plan.priorityCount,
    noBlockingErrors: rows.filter((r) => r.dryRunNoBlockingErrors).length,
    blocked: failed.length,
    serverWrites: 0,
  }),
);
