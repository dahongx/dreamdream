import { describe, expect, test } from "bun:test";
import { truncateRepeatedStateCycles } from "@/lib/ai/repeated-state-cycles";

const start = "<!-- DEARM_STATE_START -->";
const end = "<!-- DEARM_STATE_END -->";

describe("truncateRepeatedStateCycles", () => {
  test("keeps one complete reply when the model restarts twice", () => {
    const panel = (value: string) =>
      `<div class="status-wrapper"><details><summary>状态</summary>${value}</details><details>记忆</details></div>`;
    const source = [
      "<message>第一版正文</message>",
      start,
      panel("第一版"),
      "<message>第二版正文</message>",
      start,
      panel("第二版"),
      "<message>第三版正文</message>",
      start,
      panel("第三版"),
      end,
    ].join("\n");

    const result = truncateRepeatedStateCycles(source);

    expect(result.changed).toBe(true);
    expect(result.stateStartCount).toBe(3);
    expect(result.text).toBe(
      `<message>第一版正文</message>\n${start}\n${panel("第一版")}\n${end}`,
    );
    expect(result.text).not.toContain("第二版");
  });

  test("preserves the existing first end marker", () => {
    const first = `<message>正文</message>\n${start}\n<div class='state card'>状态</div>\n${end}`;
    const source = `${first}\n<message>重开</message>\n${start}\n<div class='card state'>新状态</div>`;

    expect(truncateRepeatedStateCycles(source).text).toBe(first);
  });

  test("leaves one state cycle and its nested panels untouched", () => {
    const source = `<message>正文</message>\n${start}\n<div class="status-wrapper"><details>A</details><details>B</details></div>\n${end}`;
    expect(truncateRepeatedStateCycles(source)).toEqual({
      text: source,
      changed: false,
      originalChars: source.length,
      keptChars: source.length,
      stateStartCount: 1,
    });
  });

  test("does not guess when repeated markers have different roots", () => {
    const source = `${start}<div class="status-a">A</div>${start}<div class="status-b">B</div>`;
    expect(truncateRepeatedStateCycles(source).changed).toBe(false);
  });

  test("does not treat later markup as a marker root", () => {
    const source = `${start}plain state${start}more text<div class="status-wrapper">B</div>`;
    expect(truncateRepeatedStateCycles(source).changed).toBe(false);
  });

  test("keeps the first narrative but drops repeated malformed state HTML", () => {
    const source = `<message>完整正文</message>\n${start}<div class="status-wrapper"><details>A</details>\n<message>重开的正文</message>\n${start}<div class="status-wrapper">B`;
    expect(truncateRepeatedStateCycles(source).text).toBe(
      "<message>完整正文</message>",
    );
  });

  test("does not act before a second complete marker arrives while streaming", () => {
    const source = `<message>正文</message>${start}<div class="status-wrapper">生成中`;
    expect(truncateRepeatedStateCycles(source).changed).toBe(false);
  });
});
