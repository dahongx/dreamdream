import { describe, expect, test } from "bun:test";
import { characterFormSchema } from "../characters/schema";

describe("characterFormSchema", () => {
  test("parses minimal valid input", () => {
    const fd = new FormData();
    fd.set("name", "测试角色");
    fd.set("persona", "一个测试用人设");

    const parsed = characterFormSchema.safeParse(
      Object.fromEntries(fd.entries()),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("测试角色");
      expect(parsed.data.gender).toBe("unset");
      expect(parsed.data.nsfw).toBe(false);
      expect(parsed.data.visibility).toBe("private");
      expect(parsed.data.tags).toEqual([]);
    }
  });

  test("rejects empty name", () => {
    const parsed = characterFormSchema.safeParse({
      name: "",
      persona: "x",
    });
    expect(parsed.success).toBe(false);
  });

  test("rejects empty persona (LLM-bound, can't be blank)", () => {
    const parsed = characterFormSchema.safeParse({
      name: "x",
      persona: "",
    });
    expect(parsed.success).toBe(false);
  });

  test("accepts fixed tag selections as arrays", () => {
    const parsed = characterFormSchema.safeParse({
      name: "x",
      persona: "y",
      tags: ["古风", "校园", "治愈", "群像"],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.tags).toEqual(["古风", "校园", "治愈", "群像"]);
    }
  });

  test("keeps custom tags (外部迁移), only dedupes", () => {
    const parsed = characterFormSchema.safeParse({
      name: "x",
      persona: "y",
      tags: ["古风", "悬疑", "校园", "古风"],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      // 自定义标签「悬疑」保留;重复的「古风」去重
      expect(parsed.data.tags).toEqual(["古风", "悬疑", "校园"]);
    }
  });

  test("coerces nsfw='on' checkbox to boolean true", () => {
    const parsed = characterFormSchema.safeParse({
      name: "x",
      persona: "y",
      nsfw: "on",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.nsfw).toBe(true);
  });

  test("turns empty optional textareas into undefined", () => {
    const parsed = characterFormSchema.safeParse({
      name: "x",
      persona: "y",
      bio: "",
      adversity: "   ",
      plotSetting: "",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.bio).toBeUndefined();
      expect(parsed.data.adversity).toBeUndefined();
      expect(parsed.data.plotSetting).toBeUndefined();
    }
  });

  test("rejects invalid URL on coverImageUrl", () => {
    const parsed = characterFormSchema.safeParse({
      name: "x",
      persona: "y",
      coverImageUrl: "not-a-url",
    });
    expect(parsed.success).toBe(false);
  });
});
