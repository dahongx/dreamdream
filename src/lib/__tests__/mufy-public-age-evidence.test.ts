import { expect, test } from "bun:test";
import { publicAgeEvidence } from "../import/mufy-public-age-evidence";
test("named public age can explain stale metadata", () => {
  expect(
    publicAgeEvidence("<div>祁远宁 40岁 187cm</div>", "祁远宁", 40)?.age,
  ).toBe(40);
  expect(publicAgeEvidence("是17岁的陈镇岳", "陈镇岳", 17)?.age).toBe(17);
});
test("other person, history and scripts do not resolve the conflict", () => {
  expect(publicAgeEvidence("祁远宁。父亲40岁", "祁远宁", 40)).toBeNull();
  expect(
    publicAgeEvidence(
      "<script>祁远宁40岁</script><div>年龄未知</div>",
      "祁远宁",
      40,
    ),
  ).toBeNull();
  expect(publicAgeEvidence("周岳山 5岁时丧母", "周岳山", 45)).toBeNull();
  expect(publicAgeEvidence("祁远宁父亲40岁", "祁远宁", 40)).toBeNull();
  expect(publicAgeEvidence("祁远宁18岁 父亲40岁", "祁远宁", 40)).toBeNull();
});
test("missing facts remain missing", () => {
  expect(publicAgeEvidence(null, "角色", 20)).toBeNull();
  expect(publicAgeEvidence("角色20岁", "角色", null)).toBeNull();
});
