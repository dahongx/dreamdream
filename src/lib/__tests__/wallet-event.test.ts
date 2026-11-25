import { describe, expect, test } from "bun:test";
import { classifyCurrencyTransactionEvent } from "@/lib/wallet/queries";

describe("wallet transaction event classification", () => {
  test("turns historical Chinese notes into locale-neutral event kinds", () => {
    const cases = [
      ["聊天", "角色甲", "chat"],
      ["续写", "角色甲", "continue"],
      ["美化包 - 替换 HTML", null, "pack"],
      ["图片生成 - 头像", null, "image"],
      ["退款 - 流式异常", "角色甲", "refund"],
      [null, null, "model_usage"],
    ] as const;

    for (const [note, characterName, expected] of cases) {
      expect(
        classifyCurrencyTransactionEvent({
          transactionType: "model_usage",
          note,
          characterName,
        }),
      ).toBe(expected);
    }
  });

  test("uses transaction type for non-model rows", () => {
    expect(
      classifyCurrencyTransactionEvent({
        transactionType: "daily_claim",
        note: "每日登录",
        characterName: null,
      }),
    ).toBe("daily_claim");
    expect(
      classifyCurrencyTransactionEvent({
        transactionType: "recharge",
        note: "订阅黄金会员月卡",
        characterName: null,
      }),
    ).toBe("recharge");
  });
});
