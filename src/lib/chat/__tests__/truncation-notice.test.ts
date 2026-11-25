import { describe, expect, test } from "bun:test";
import {
  isTrailingPanelTruncation,
  safetyTruncationNoticePlacement,
  shouldShowSafetyTruncationNotice,
  stateTruncationRenderSuffix,
} from "../truncation-notice";

const parts = (text: string) => [{ type: "text", text }];

describe("safety truncation notice", () => {
  test("hides the warning when generation stops inside a trailing memory panel", () => {
    const text = `这是一段已经完整结束、具有足够正文内容的角色回复，用户可以正常继续阅读。\n<div class="status-box"><details><summary>状态</summary><div>完整</div></details><details><summary>记忆区</summary><div>最后一条记忆写到一`;
    expect(isTrailingPanelTruncation(parts(text))).toBe(true);
    expect(safetyTruncationNoticePlacement(parts(text))).toBe("inside-state");
    expect(shouldShowSafetyTruncationNotice(parts(text))).toBe(false);
  });

  test("hides the warning when the first trailing status panel is cut", () => {
    const text = `这是已经完整结束的一段正文，用户可以正常阅读并继续对话。\n<div class="status-box"><details><summary>状态</summary><div>内心状态生成到一半`;
    expect(isTrailingPanelTruncation(parts(text))).toBe(true);
    expect(safetyTruncationNoticePlacement(parts(text))).toBe("inside-state");
  });

  test("keeps the warning when the narrative itself is cut", () => {
    const text = "这段正文还没有说完，故事正进行到";
    expect(isTrailingPanelTruncation(parts(text))).toBe(false);
    expect(shouldShowSafetyTruncationNotice(parts(text))).toBe(true);
    expect(safetyTruncationNoticePlacement(parts(text))).toBe("external");
  });

  test("does not mistake a style-only prefix for completed narrative", () => {
    const text = `<style>${".status{color:red}".repeat(4)}</style><details><summary>状态</summary>`;
    expect(isTrailingPanelTruncation(parts(text))).toBe(false);
  });

  test("keeps the warning when all details panels are structurally closed", () => {
    const text = `这是一段已经完整结束并且长度足够的叙事正文，人物已经完成了这一轮动作与对话。<details><summary>状态</summary><div>关系：朋友；好感度：36</div></details>`;
    expect(isTrailingPanelTruncation(parts(text))).toBe(false);
    expect(safetyTruncationNoticePlacement(parts(text))).toBe("none");
    expect(shouldShowSafetyTruncationNotice(parts(text))).toBe(false);
  });

  test("hides all warnings when state subpanels close but outer wrapper is cut", () => {
    const text = `这是一段已经完整结束并且长度足够的叙事正文，人物已经完成了这一轮动作与对话。<!-- DEARM_STATE_START --><div class="status-wrapper"><details><summary>状态</summary><div>关系：朋友；好感度：41</div></details>`;
    expect(safetyTruncationNoticePlacement(parts(text))).toBe("none");
  });

  test("render-only state warning uses semantic tokens and escapes its label", () => {
    const suffix = stateTruncationRenderSuffix("此部分生成被截断 <script>");
    expect(suffix).toContain("border-semantic-warning/40");
    expect(suffix).toContain("此部分生成被截断 &lt;script&gt;");
    expect(suffix).not.toContain("<script>");
  });
});
