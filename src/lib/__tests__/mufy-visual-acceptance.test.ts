import { describe, expect, test } from "bun:test";
import {
  type MufyRuntimeQuality,
  verifyMufyVisualAcceptance,
} from "@/lib/import/mufy-visual-acceptance";

function quality(
  overrides: Partial<MufyRuntimeQuality> = {},
): MufyRuntimeQuality {
  return {
    version: 1,
    hostElements: {
      aiMessage: {
        selector: ".nj_ai_message_bubble",
        count: 1,
        visibleCount: 1,
        rect: { x: 0, y: 0, width: 200, height: 80 },
        computed: {
          backgroundColor: "rgba(20, 30, 40, 0.4)",
          backgroundImage: "none",
          border: "1px solid rgb(255, 255, 255)",
        },
        before: null,
        after: null,
      },
      thinkToggle: {
        selector: ".nj_message_think",
        count: 1,
        visibleCount: 1,
        rect: { x: 0, y: 0, width: 98, height: 44 },
        computed: {},
        before: {
          content: '"⩌ _ ⩌"',
          animationName: "mufy-think-text-breathe",
        },
        after: { content: '""', animationName: "mufy-think-line-slide" },
      },
    },
    fixedElements: [
      {
        signature: "cat-sidebar",
        position: "fixed",
        rect: { x: 350, y: 300, width: 40, height: 80 },
        visibleRatio: 1,
        innerOverflowPx: 0,
        text: "",
      },
    ],
    requirements: {
      customMessageBubbles: true,
      customThinkToggle: true,
      composerOverlayText: "好想对你表白",
      dismissibleWarningText: "这个世界好坏",
      floatingUiCount: 1,
    },
    interactions: {
      thinkToggleCount: 1,
      collapsedThinkToggleCount: 1,
      expandedThinkToggleCount: 0,
      composerPlaceholder: null,
      composerBeforeContent: '"好想对你表白"',
      dismissibleTexts: ["这个世界好坏"],
    },
    media: { brokenImages: [], failedMedia: [] },
    layout: { horizontalOverflowPx: 0 },
    ...overrides,
  };
}

describe("Mufy visual acceptance", () => {
  test("passes a complete post-migration runtime", () => {
    const source = { version: 3, quality: quality() };
    const target = { version: 1, quality: quality() };
    const result = verifyMufyVisualAcceptance(source, target);
    expect(result.ok).toBe(true);
    expect(result.score).toBe(100);
  });

  test("blocks the regressions found while finishing 余斯是 and 宋聆语", () => {
    const source = { version: 3, quality: quality() };
    const target = {
      version: 1,
      quality: quality({
        fixedElements: [
          {
            signature: "cat-sidebar",
            position: "absolute",
            rect: { x: 380, y: 300, width: 40, height: 80 },
            visibleRatio: 0.25,
            innerOverflowPx: 24,
            text: "",
          },
        ],
        interactions: {
          thinkToggleCount: 1,
          collapsedThinkToggleCount: 0,
          expandedThinkToggleCount: 1,
          composerPlaceholder: null,
          composerBeforeContent: null,
          dismissibleTexts: [],
        },
        media: { brokenImages: ["huge-or-missing.jpg"], failedMedia: [] },
        layout: { horizontalOverflowPx: 28 },
      }),
    };
    const result = verifyMufyVisualAcceptance(source, target);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "NO_HORIZONTAL_OVERFLOW",
        "NO_BROKEN_MEDIA",
        "THINK_DEFAULT_COLLAPSED",
        "COMPOSER_COPY_PRESERVED",
        "DISMISSIBLE_WARNING_PRESERVED",
        "FLOATING_UI_VISIBLE",
      ]),
    );
  });
});
