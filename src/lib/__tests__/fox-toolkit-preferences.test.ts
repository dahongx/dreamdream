import { expect, test } from "bun:test";
import {
  clampFoxPosition,
  defaultFoxPreferences,
  readFoxPreferences,
  validFoxImage,
} from "../opening/fox-toolkit";

test("only bounded native preferences restore, without importing source storage or arbitrary image schemes", () => {
  const image = "data:image/png;base64,iVBORw0KGgo=";
  const saved = {
    ...defaultFoxPreferences(),
    track: 6,
    playing: true,
    position: { x: 300, y: 900 },
    avatars: [image, null],
    background: image,
  };
  expect(readFoxPreferences(JSON.stringify(saved))).toEqual(saved);
  for (const bad of [
    null,
    "{",
    JSON.stringify({ ...saved, track: 7 }),
    JSON.stringify({ ...saved, playing: "true" }),
    JSON.stringify({ ...saved, position: { x: null, y: 3 } }),
    JSON.stringify({ ...saved, avatars: ["javascript:bad", null] }),
    JSON.stringify({
      ...saved,
      background: "https://user:secret@example.com/private",
    }),
    JSON.stringify({ ...saved, avatars: [image] }),
  ])
    expect(readFoxPreferences(bad)).toEqual(defaultFoxPreferences());
  expect(validFoxImage("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
  expect(validFoxImage("blob:anything")).toBe(false);
  expect(
    readFoxPreferences(JSON.stringify({ ...saved, unknown: "ignored" })),
  ).not.toHaveProperty("unknown");
});

test("restored and resized floating positions stay inside the current viewport", () => {
  expect(clampFoxPosition({ x: 90000, y: 90000 }, 390, 844)).toEqual({
    x: 348,
    y: 802,
  });
  expect(clampFoxPosition({ x: -3, y: Infinity }, 390, 844)).toEqual({
    x: 0,
    y: 0,
  });
  expect(clampFoxPosition({ x: 90, y: 70 }, 20, 30)).toEqual({ x: 0, y: 0 });
});
