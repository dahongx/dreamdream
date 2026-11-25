import { describe, expect, test } from "bun:test";
import { DEARM_OUTPUT_PROTOCOL } from "@/lib/ai/output-protocol";
import {
  findLatestCompleteStateSnapshotIndex,
  findLatestUsableStateSnapshotIndex,
  hasCompleteStateSnapshot,
  hasUsableStateSnapshot,
  retainUsableStateSnapshot,
  STATE_END_MARKER,
  STATE_START_MARKER,
  stripHistoricalStateBlocks,
} from "@/lib/ai/state-history";

describe("state history", () => {
  test("统一标记的状态栏会从旧历史完整剥离", () => {
    const source = `正文保留。
${STATE_START_MARKER}
<div class="creator-anything">状态：稳定；好感度：38%</div>
${STATE_END_MARKER}`;

    expect(hasCompleteStateSnapshot(source)).toBe(true);
    expect(stripHistoricalStateBlocks(source)).toBe("正文保留。");
  });

  test("截断的统一状态栏会作为半成品剥离", () => {
    const source = `正文保留。
${STATE_START_MARKER}
<div>状态：稳定；好感度：`;

    expect(hasCompleteStateSnapshot(source)).toBe(false);
    expect(stripHistoricalStateBlocks(source)).toBe("正文保留。");
  });

  test("兼容 status-wrapper 并识别为完整快照", () => {
    const source = `足够长的叙事正文，用来确保状态块不会和正文混淆。
<div class="status-wrapper">
  <details class="status-card"><div>状态：放松</div></details>
  <details class="status-card"><div>关系：伴侣；好感度：36.5%</div></details>
</div>
已完成全部输出`;

    expect(hasCompleteStateSnapshot(source)).toBe(true);
    expect(stripHistoricalStateBlocks(source)).toBe(
      "足够长的叙事正文，用来确保状态块不会和正文混淆。\n\n已完成全部输出",
    );
  });

  test("兼容创作者自定义根类名", () => {
    const source = `这一段是应当继续进入历史的叙事正文，长度足够且不在状态容器内。
<div class="pei-ui-group">
  <div><span>状态：平静</span></div>
  <div><span>关系：熟人</span><span>好感度：+0.5%</span></div>
</div>`;

    expect(hasCompleteStateSnapshot(source)).toBe(true);
    expect(stripHistoricalStateBlocks(source)).toBe(
      "这一段是应当继续进入历史的叙事正文，长度足够且不在状态容器内。",
    );
  });

  test("截断在自定义状态容器内时只剥半成品尾部", () => {
    const source = `这一段是完整叙事，下一轮仍然必须看见这里发生的情节。
<div class="eg-box">
  <details><div>状态：紧张</div></details>
  <details><div>关系：陌生人；好感度：`;

    expect(hasCompleteStateSnapshot(source)).toBe(false);
    expect(stripHistoricalStateBlocks(source)).toBe(
      "这一段是完整叙事，下一轮仍然必须看见这里发生的情节。",
    );
  });

  test("正文中偶然提到好感度时不做删除", () => {
    const source = `<div class="story"><p>他不知道所谓好感度意味着什么，只保持沉默。</p></div>`;
    expect(hasCompleteStateSnapshot(source)).toBe(false);
    expect(stripHistoricalStateBlocks(source)).toBe(source);
  });

  test("没有正文前缀的整页 HTML 不会被当作尾部状态栏", () => {
    const source = `<div class="status-page"><div>状态：测试</div><div>关系：未知；好感度：1</div></div>`;
    expect(hasCompleteStateSnapshot(source)).toBe(false);
    expect(stripHistoricalStateBlocks(source)).toBe(source);
  });

  test("没有好感度的旧 status-card 仍会剥离", () => {
    const source = `正文保留。\n<details class="status-card"><p>群聊与记忆</p></details>`;
    expect(stripHistoricalStateBlocks(source)).toBe("正文保留。");
  });

  test("从后向前选择最近一份完整状态快照", () => {
    const messages = [
      {
        role: "assistant",
        text: `第一轮正文内容足够长，保留这一份完整状态。\n${STATE_START_MARKER}<div>状态：稳定；关系：熟人；好感度：20</div>${STATE_END_MARKER}`,
      },
      { role: "user", text: "继续" },
      {
        role: "assistant",
        text: `第二轮正文完整，但状态被截断。\n${STATE_START_MARKER}<div>状态：稳定；关系：朋友；好感度：`,
      },
      { role: "user", text: "再继续" },
    ];

    expect(
      findLatestCompleteStateSnapshotIndex(messages, (message) => message.text),
    ).toBe(0);
  });

  test("记忆区截断时继承已经闭合的当轮好感度模块", () => {
    const source = `这一轮叙事正文已经完整结束，下一轮需要看到正文和最新的核心状态。
${STATE_START_MARKER}
<div class="status-wrapper">
  <details><summary>状态</summary><div>关系：朋友；好感度：36</div></details>
  <details><summary>记忆区 MEMORY</summary><div>新记忆写到一半`;

    expect(hasCompleteStateSnapshot(source)).toBe(false);
    expect(hasUsableStateSnapshot(source)).toBe(true);

    const retained = retainUsableStateSnapshot(source);
    expect(retained).toContain("这一轮叙事正文已经完整结束");
    expect(retained).toContain("关系：朋友；好感度：36");
    expect(retained).not.toContain("新记忆写到一半");
    expect(retained).toContain(STATE_START_MARKER);
    expect(retained).toContain(STATE_END_MARKER);
  });

  test("核心好感度模块自身截断时回退上一份完整状态", () => {
    const messages = [
      {
        role: "assistant",
        text: `上一轮正文内容足够长。\n${STATE_START_MARKER}<details><div>关系：熟人；好感度：20</div></details>${STATE_END_MARKER}`,
      },
      { role: "user", text: "继续" },
      {
        role: "assistant",
        text: `这一轮正文也已经结束。\n${STATE_START_MARKER}<div class="status-wrapper"><details><div>关系：朋友；好感度：36`,
      },
    ];

    expect(hasUsableStateSnapshot(messages[2].text)).toBe(false);
    expect(
      findLatestUsableStateSnapshotIndex(messages, (message) => message.text),
    ).toBe(0);
  });

  test("状态子模块已闭合但外层和结束标记缺失时仍使用当前核心状态", () => {
    const messages = [
      {
        role: "assistant",
        text: `上一轮正文内容足够长。\n${STATE_START_MARKER}<details><div>关系：熟人；好感度：20</div></details>${STATE_END_MARKER}`,
      },
      {
        role: "assistant",
        text: `当前正文已经完整结束并进入状态栏。\n${STATE_START_MARKER}<div class="status-wrapper"><details><div>关系：朋友；好感度：41</div></details>`,
      },
    ];

    expect(
      findLatestUsableStateSnapshotIndex(messages, (message) => message.text),
    ).toBe(1);
    const retained = retainUsableStateSnapshot(messages[1].text);
    expect(retained).toContain("好感度：41");
    expect(retained).not.toContain("好感度：20");
  });

  test("完整状态被选中时模型历史内容保持原样", () => {
    const source = `完整正文内容。\n${STATE_START_MARKER}<div>状态：稳定；关系：朋友；好感度：42</div>${STATE_END_MARKER}`;
    expect(retainUsableStateSnapshot(source)).toBe(source);
  });

  test("宿主协议要求状态栏只输出一次并带统一边界", () => {
    expect(DEARM_OUTPUT_PROTOCOL).toContain(STATE_START_MARKER);
    expect(DEARM_OUTPUT_PROTOCOL).toContain(STATE_END_MARKER);
    expect(DEARM_OUTPUT_PROTOCOL).toContain("exactly once per reply");
  });
});
