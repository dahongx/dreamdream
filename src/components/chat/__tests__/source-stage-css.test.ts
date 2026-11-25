import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import postcss from "postcss";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const localByDefault = require("next/dist/compiled/postcss-modules-local-by-default");
const scope = require("next/dist/compiled/postcss-modules-scope");

test("source stage CSS Modules retain public host selectors inside the opted-in stage", async () => {
  const stylesheet = await Bun.file(
    new URL("../source-stage.module.css", import.meta.url),
  ).text();
  const result = await postcss([
    localByDefault({ mode: "pure" }),
    scope({ generateScopedName: (name: string) => `test_${name}` }),
  ]).process(stylesheet, { from: "source-stage.module.css" });
  const dom = new JSDOM(`<section class="test_sourceStage">
    <header id="nj_chat_header"></header>
    <div id="nj_chat_messages"></div>
    <form id="nj_chat_input_container"></form>
  </section><section><header id="ordinary_header"></header></section>`);
  try {
    const publicIds = new Set<string>();
    result.root.walkRules((rule) => {
      if (!rule.selector.includes("#nj_chat_")) return;
      const matches = dom.window.document.querySelectorAll(rule.selector);
      for (const element of matches) publicIds.add(element.id);
      expect(matches.length).toBeGreaterThan(0);
      expect([...matches].every((element) => element.closest(".test_sourceStage"))).toBe(true);
    });
    expect([...publicIds].sort()).toEqual([
      "nj_chat_header",
      "nj_chat_input_container",
      "nj_chat_messages",
    ]);
  } finally {
    dom.window.close();
  }
});
