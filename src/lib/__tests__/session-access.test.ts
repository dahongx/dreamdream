import { describe, expect, test } from "bun:test";
import { isSessionAccessible } from "@/lib/sessions/access";

const ME = "user-me";
const OTHER = "user-other";

describe("isSessionAccessible", () => {
  test("公开角色 → 可访问", () => {
    expect(
      isSessionAccessible(
        {
          characterId: "c1",
          characterVisibility: "public",
          characterOwnerId: OTHER,
        },
        ME,
      ),
    ).toBe(true);
  });

  test("不列出角色 → 可访问（有链接就能进）", () => {
    expect(
      isSessionAccessible(
        {
          characterId: "c1",
          characterVisibility: "unlisted",
          characterOwnerId: OTHER,
        },
        ME,
      ),
    ).toBe(true);
  });

  test("别人的私密角色 → 不可访问（曾聊过的公开卡被作者改私密）", () => {
    expect(
      isSessionAccessible(
        {
          characterId: "c1",
          characterVisibility: "private",
          characterOwnerId: OTHER,
        },
        ME,
      ),
    ).toBe(false);
  });

  test("自己的私密角色 → 可访问", () => {
    expect(
      isSessionAccessible(
        {
          characterId: "c1",
          characterVisibility: "private",
          characterOwnerId: ME,
        },
        ME,
      ),
    ).toBe(true);
  });

  /**
   * 账号注销的核心回归:创作者注销 → 他的角色卡被删 → migration 0042 把
   * chat_sessions.character_id 置 null。别人的这段会话**必须还在列表里**
   * （数据没被连坐删掉），但**不能点进去**（没有角色行就没有 prompt）。
   */
  test("角色已随创作者注销被删 → 不可访问", () => {
    expect(
      isSessionAccessible(
        {
          characterId: null,
          characterVisibility: null,
          characterOwnerId: null,
        },
        ME,
      ),
    ).toBe(false);
  });

  test("角色被删时不看 visibility —— null 角色一律拦住", () => {
    // leftJoin 理论上不会出现 characterId=null 而 visibility 有值的行，
    // 但判据必须以 characterId 为准，不能被残留字段带偏。
    expect(
      isSessionAccessible(
        {
          characterId: null,
          characterVisibility: "public",
          characterOwnerId: ME,
        },
        ME,
      ),
    ).toBe(false);
  });
});
