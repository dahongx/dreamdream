import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { isDeveloperEmail } from "../dev-allowlist";

/**
 * 这个开关不是「调试面板可见性」那么轻 —— 命中白名单还能编辑任意角色卡、
 * 进任意卡的 edit 页读全站创作者的 prompt 资产原文。原先「严禁配进 prod」
 * 只是一句注释，没有任何东西执行它。这些用例就是那条执行机制。
 *
 * 删这个文件前先想清楚：生产 .env 里一旦出现 NIMIR_DEBUG_EMAILS，泄的是
 * 全体创作者的护城河。
 */

// NODE_ENV 在 next-env 里被收窄成字面量联合且只读，测试要改它得绕过类型。
function setNodeEnv(value: string): void {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_ALLOWLIST = process.env.NIMIR_DEBUG_EMAILS;

describe("isDeveloperEmail", () => {
  beforeAll(() => {
    // 白名单是首次调用时惰性解析并缓存的，所以在任何断言之前设好即可。
    process.env.NIMIR_DEBUG_EMAILS = "dev@example.com,Me@Personal.TLD";
  });

  afterAll(() => {
    setNodeEnv(ORIGINAL_NODE_ENV ?? "test");
    if (ORIGINAL_ALLOWLIST === undefined) {
      delete process.env.NIMIR_DEBUG_EMAILS;
    } else {
      process.env.NIMIR_DEBUG_EMAILS = ORIGINAL_ALLOWLIST;
    }
  });

  test("生产环境一律返回 false —— 配了也不生效", () => {
    setNodeEnv("production");
    expect(isDeveloperEmail("dev@example.com")).toBe(false);
    expect(isDeveloperEmail("me@personal.tld")).toBe(false);
  });

  test("非生产环境命中白名单，大小写不敏感", () => {
    setNodeEnv("development");
    expect(isDeveloperEmail("dev@example.com")).toBe(true);
    expect(isDeveloperEmail("DEV@EXAMPLE.COM")).toBe(true);
    expect(isDeveloperEmail("me@personal.tld")).toBe(true);
  });

  test("非生产环境下白名单外的账号仍是 false", () => {
    setNodeEnv("development");
    expect(isDeveloperEmail("stranger@example.com")).toBe(false);
    expect(isDeveloperEmail(null)).toBe(false);
    expect(isDeveloperEmail(undefined)).toBe(false);
    expect(isDeveloperEmail("")).toBe(false);
  });
});
