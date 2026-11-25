import { describe, expect, test } from "bun:test";
import {
  EMAIL_PEPPER_ENV,
  hashDeactivatedEmail,
  hashDeactivatedEmailFromEnv,
} from "@/lib/account/email-hash";

/**
 * 已注销邮箱指纹 —— 账号注销硬删除后全库唯一的残留物。
 *
 * 三条断言撑起它的正当性：
 *   1. 同邮箱同 pepper → 同哈希（否则挡不住重复领新人币，闸形同虚设）
 *   2. 换 pepper → 换哈希（否则 pepper 没起作用，等于裸 SHA256，可字典枚举反查）
 *   3. 没 pepper → 抛错（绝不静默降级成可反查的裸哈希）
 */
describe("hashDeactivatedEmail", () => {
  const pepper = "test-pepper";

  test("同一邮箱同一 pepper 稳定同值", () => {
    expect(hashDeactivatedEmail("a@example.com", pepper)).toBe(
      hashDeactivatedEmail("a@example.com", pepper),
    );
  });

  test("大小写与首尾空白归一 —— 注册与注销两侧必须算出同一个值", () => {
    const base = hashDeactivatedEmail("a@example.com", pepper);
    expect(hashDeactivatedEmail("  A@Example.COM  ", pepper)).toBe(base);
  });

  test("不同邮箱不同值", () => {
    expect(hashDeactivatedEmail("a@example.com", pepper)).not.toBe(
      hashDeactivatedEmail("b@example.com", pepper),
    );
  });

  test("换 pepper 换值 —— 证明 pepper 真的进了摘要", () => {
    expect(hashDeactivatedEmail("a@example.com", pepper)).not.toBe(
      hashDeactivatedEmail("a@example.com", "other-pepper"),
    );
  });

  test("输出是 64 位十六进制（sha256）", () => {
    expect(hashDeactivatedEmail("a@example.com", pepper)).toMatch(
      /^[0-9a-f]{64}$/,
    );
  });

  test("pepper 缺失时抛错，绝不退回裸哈希", () => {
    expect(() => hashDeactivatedEmail("a@example.com", "")).toThrow(
      EMAIL_PEPPER_ENV,
    );
  });

  test("从 env 读 pepper；未配置同样抛错", () => {
    const original = process.env[EMAIL_PEPPER_ENV];
    try {
      process.env[EMAIL_PEPPER_ENV] = pepper;
      expect(hashDeactivatedEmailFromEnv("a@example.com")).toBe(
        hashDeactivatedEmail("a@example.com", pepper),
      );

      delete process.env[EMAIL_PEPPER_ENV];
      expect(() => hashDeactivatedEmailFromEnv("a@example.com")).toThrow();
    } finally {
      if (original === undefined) delete process.env[EMAIL_PEPPER_ENV];
      else process.env[EMAIL_PEPPER_ENV] = original;
    }
  });
});
