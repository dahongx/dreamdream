import { expect, test } from "bun:test";
import { localIdentityFacts } from "../import/mufy-local-identity";
test("extract actual primary character rather than index name", () => {
  expect(
    localIdentityFacts("应逐星的姓名：应逐星\n应逐星的年龄：18岁"),
  ).toMatchObject({ name: "应逐星", age: 18 });
  expect(
    localIdentityFacts("#姓名：程今越\n年龄：40\n职业：总裁"),
  ).toMatchObject({ name: "程今越", age: 40 });
  expect(localIdentityFacts("姓名：宋怀远。\n年龄：32岁").name).toBe("宋怀远");
  expect(localIdentityFacts("姓名：费也。昵称狒狒").name).toBe("费也");
});
test("do not mistake an NPC age for a non-numeric primary age", () => {
  expect(
    localIdentityFacts("char_name: 白矖\nage: 大概两千岁\nNPC\n年龄：35岁"),
  ).toMatchObject({ name: "白矖", age: null });
});
test("missing age/name and placeholders do not count as verified facts", () => {
  expect(localIdentityFacts("姓名：{{char}}\n人物不详")).toMatchObject({
    name: null,
    age: null,
  });
});
