#!/usr/bin/env bun
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
const dir = resolve("logs/mufy-profiles/full-20261013/pilot-5");
const read = async (file: string) =>
  JSON.parse(await readFile(join(dir, file), "utf8"));
const check = (await read("pilot-check.json")) as {
  rows: {
    name: string;
    roleId: string;
    sourceKey: string;
    reportPath: string;
  }[];
};
const writes = (await read("test-write-summary.json")) as {
  rows: {
    name: string;
    roleId: string;
    targetUrl?: string;
    databaseWrite?: unknown;
  }[];
};
const lines = [
  "首批5个角色迁移状态与差异表",
  "规则：用户允许图片、音频缺项后补；主体内容保留，身份核对、样式安全和TEST-only保护不降低。",
  `已写测试服${writes.rows.filter((row) => row.databaseWrite).length}个；写入成功不等于全交互验收完成。`,
  "角色 | 当前状态 | 缺失音频 | 其他待处理事项 | 下一步",
];
for (const row of check.rows) {
  const write = writes.rows.find((value) => value.roleId === row.roleId);
  const report = write?.databaseWrite
    ? JSON.parse(
        await readFile(
          join(dir, row.sourceKey, "test-write-report.json"),
          "utf8",
        ),
      )
    : JSON.parse(await readFile(row.reportPath, "utf8"));
  const issues = report.prepared.issues as {
    code: string;
    level: string;
    message: string;
  }[];
  const audio = issues.filter(
    (issue) => issue.code === "MISSING_AUDIO_OMITTED_WITH_APPROVAL",
  ).length;
  const css = report.prepared.audit.cssWarningCount as number;
  const images = issues.filter(
    (issue) => issue.code === "MISSING_IMAGE_OMITTED_WITH_APPROVAL",
  ).length;
  const decoration = issues.filter(
    (issue) => issue.code === "NONPORTABLE_HOST_DECORATION_DEFERRED",
  );
  const mobile = await readFile(
    join(dir, row.sourceKey, "dearm-mobile.json"),
    "utf8",
  )
    .then(() => true)
    .catch(() => false);
  lines.push(
    `${row.name} | ${write?.databaseWrite ? "已写测试服（私有）" : "尚未确认写入"} | ${audio}项省略；已取得且可上传的保留 | 图片缺项${images}项；安全样式警告${css}项；${decoration.length ? "非可移植宿主装饰已逐项记录后补" : "无装饰延期记录"}；${mobile ? "手机390px/桌面基础输入可用性已查，完整交互待查" : "目标页面验收待查"} | ${write?.databaseWrite ? "补齐成品交互验收" : "按检查点继续，不重复建卡"}`,
  );
  if (write?.targetUrl) lines.push(`测试页：${write.targetUrl}`);
}
lines.push(
  "说明：缺失音频原始地址和失败证据保留在内部报告，不伪造可播放资源；没有音频的原生播放控件不再显示为损坏播放器。",
  "年龄修复：祁远宁40岁、周岳山45岁，按已授权本地人物底稿写回原卡；人物设定原文未改写，来源年龄差异保留审计记录。",
  "2026-10-14补修验收：宋怀远云朵占位消失，浮层只有1个，可展开；未取得音源的按钮明确禁用为Audio pending。",
  "薛山烬：定制指令占位消失，来源18项快捷指令已生成；截断续写实测填入输入框271字符，未自动发送，测试草稿已清除。设定与MP3共享侧栏，开关均实际点击通过；本地化音频实际播放readyState=4、时长245.89932秒，测试后已停止。",
  "风满楼：手机内嵌卡片宽度随354px内容列收敛，文字不横向裁切；展开后iframe2328px、自然正文2327.4167px，修复只增不减导致的11111px空白。人物图与设定切换已点击验证。",
  "上述修复已进入通用迁移器。五卡手机390px/桌面1280px共10次输入命中与外层溢出检查通过；26项回归通过。该记录不是所有角色/所有来源功能的完整等价声明。完整证据见runtime-repair-browser-checks.json。",
  "本表仅表示当前实测状态，不等于100个已经全部迁移。正式服写入0。",
);
await writeFile(join(dir, "迁移状态与差异表.txt"), lines.join("\r\n") + "\r\n");
console.log(
  JSON.stringify({
    written: writes.rows.filter((row) => row.databaseWrite).length,
    report: join(dir, "迁移状态与差异表.txt"),
  }),
);
