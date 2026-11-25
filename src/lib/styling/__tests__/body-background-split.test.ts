/**
 * Test for body background property splitting — verifies that body { background: ... }
 * rules from external imports get redirected to #nj_background_image while other properties
 * stay on the scope root.
 */

import { describe, expect, test } from "bun:test";
import { sanitizeAndScopeCss } from "../whitelist";

describe("body background splitting", () => {
  test("redirects body background-image to #nj_background_image", () => {
    const input = `
      body {
        background-image: url('https://example.com/bg.jpg');
        background-size: cover;
        background-position: center top;
        font-size: 16px;
        color: white;
      }
    `;

    const result = sanitizeAndScopeCss(input, "test-char");

    // Should have two rules: one for #nj_background_image, one for scope root
    expect(result.css).toContain("#nj_background_image");
    expect(result.css).toContain(
      "background-image: url('https://example.com/bg.jpg')",
    );
    expect(result.css).toContain("background-size: cover");
    expect(result.css).toContain("background-position: center top");

    // Non-background properties should be on the scope root
    expect(result.css).toContain("font-size: 16px");
    expect(result.css).toContain("color: white");

    // Background and non-background should be in separate rules
    const bgRule = result.css.match(
      /\[data-character-css="test-char"\] #nj_background_image \{[^}]+\}/,
    );
    const otherRule = result.css.match(
      /\[data-character-css="test-char"\] \{[^}]+\}/,
    );

    expect(bgRule).toBeTruthy();
    expect(otherRule).toBeTruthy();

    // Background rule should only have background properties
    expect(bgRule?.[0]).toContain("background-image");
    expect(bgRule?.[0]).not.toContain("font-size");
    expect(bgRule?.[0]).not.toContain("color");

    // Other rule should only have non-background properties
    expect(otherRule?.[0]).toContain("font-size");
    expect(otherRule?.[0]).toContain("color");
    expect(otherRule?.[0]).not.toContain("background-image");
  });

  test("handles body with only background properties", () => {
    const input = `
      body {
        background: url('test.png') no-repeat center;
      }
    `;

    const result = sanitizeAndScopeCss(input, "test-char");

    expect(result.css).toContain("#nj_background_image");
    expect(result.css).toContain(
      "background: url('test.png') no-repeat center",
    );

    // Should not emit an empty scope root rule
    const emptyRule = result.css.match(
      /\[data-character-css="test-char"\] \{\s*\}/,
    );
    expect(emptyRule).toBeNull();
  });

  test("handles body with only non-background properties", () => {
    const input = `
      body {
        font-family: Arial;
        margin: 0;
      }
    `;

    const result = sanitizeAndScopeCss(input, "test-char");

    // Should only have scope root rule, no #nj_background_image
    expect(result.css).not.toContain("#nj_background_image");
    expect(result.css).toContain("font-family: Arial");
    expect(result.css).toContain("margin: 0");
  });

  test("does not split background for non-body selectors", () => {
    const input = `
      #nj_chat_messages {
        background-color: red;
        padding: 10px;
      }
    `;

    const result = sanitizeAndScopeCss(input, "test-char");

    // Should be a single rule with both properties
    expect(result.css).toContain("background-color: red");
    expect(result.css).toContain("padding: 10px");

    // Should not create a separate #nj_background_image rule.
    // (注：sanitize 末尾会追加一条 #nj_chat_send_button 复位规则，所以不能再
    // 靠「总规则数 === 1」判断；直接断言没有 background 拆分产物更准。)
    expect(result.css).not.toContain("#nj_background_image");
  });

  test("handles webkit-mask properties as background", () => {
    const input = `
      body {
        -webkit-mask-image: linear-gradient(to right, transparent, black 100px);
        mask-image: linear-gradient(to right, transparent, black 100px);
        font-size: 14px;
      }
    `;

    const result = sanitizeAndScopeCss(input, "test-char");

    expect(result.css).toContain("#nj_background_image");
    expect(result.css).toContain("-webkit-mask-image");
    expect(result.css).toContain("mask-image");

    // mask properties should be in background rule
    const bgRule = result.css.match(
      /\[data-character-css="test-char"\] #nj_background_image \{[^}]+\}/,
    );
    expect(bgRule?.[0]).toContain("mask-image");
    expect(bgRule?.[0]).not.toContain("font-size");
  });
});
