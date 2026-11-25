import { expect, test } from "bun:test";
import { decideIdentity } from "../import/mufy-identity-decision";
const story =
  "张三回到老家，遇见了许多年没见的朋友，回忆起曾经一起读书和生活的故事。".repeat(
    10,
  );
test("confirm substantial narrative and primary identity, not basic metadata alone", () => {
  expect(
    decideIdentity(
      "张三",
      { primaryName: "张三", persona: "姓名张三", opening: story, age: 30 },
      { roleId: "id", name: "张三", status: "found", greeting: story, age: 20 },
      [],
    ).status,
  ).toBe("confirmed");
  expect(
    decideIdentity(
      "张三",
      { primaryName: "张三", persona: "姓名张三", opening: "你好", age: 30 },
      {
        roleId: "id",
        name: "张三",
        status: "found",
        greeting: "你好",
        age: 30,
      },
      [],
    ).status,
  ).toBe("pending");
});
test("wrong protagonist and existing target cannot enter final list", () => {
  expect(
    decideIdentity(
      "张三",
      { primaryName: "李四", persona: "李四", opening: story, age: 30 },
      { roleId: "id", name: "张三", status: "found", greeting: story },
      [],
    ).status,
  ).toBe("reject");
  expect(
    decideIdentity(
      "张三",
      { primaryName: "张三", persona: "张三", opening: story, age: 30 },
      { roleId: "id", name: "张三", status: "found", greeting: story },
      [{ id: "target", name: "张三" }],
    ).status,
  ).toBe("existing");
});
test("generic long greeting and missing public reads cannot establish identity", () => {
  expect(
    decideIdentity(
      "张三",
      {
        primaryName: "张三",
        persona: "张三",
        opening: "你好欢迎来到故事世界。".repeat(30),
        age: 30,
      },
      {
        roleId: "id",
        name: "张三",
        status: "found",
        greeting: "你好欢迎来到故事世界。".repeat(30),
      },
      [],
    ).status,
  ).toBe("pending");
  expect(
    decideIdentity(
      "张三",
      { primaryName: "张三", persona: "张三", opening: story, age: 30 },
      undefined,
      [],
    ).status,
  ).toBe("awaiting-read");
});
