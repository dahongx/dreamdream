export interface RuntimeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RuntimeVisualElement {
  selector: string;
  count: number;
  visibleCount: number;
  rect: RuntimeRect | null;
  computed: Record<string, string> | null;
  before: Record<string, string> | null;
  after: Record<string, string> | null;
}

export interface RuntimeFixedElement {
  signature: string;
  position: string;
  rect: RuntimeRect;
  visibleRatio: number;
  innerOverflowPx?: number;
  text: string;
}

export interface MufyRuntimeQuality {
  version: 1;
  hostElements: Record<string, RuntimeVisualElement>;
  fixedElements: RuntimeFixedElement[];
  requirements: {
    customMessageBubbles: boolean;
    customThinkToggle: boolean;
    composerOverlayText: string | null;
    dismissibleWarningText: string | null;
    floatingUiCount: number;
  };
  interactions: {
    thinkToggleCount: number;
    collapsedThinkToggleCount: number;
    expandedThinkToggleCount: number;
    composerPlaceholder: string | null;
    composerBeforeContent: string | null;
    dismissibleTexts: string[];
  };
  media: {
    brokenImages: string[];
    failedMedia: string[];
  };
  layout: {
    horizontalOverflowPx: number;
  };
}

export interface RuntimeVisualSnapshot {
  version: number;
  pageUrl?: string;
  characterId?: string;
  characterName?: string;
  viewport?: { width?: number; height?: number };
  quality?: MufyRuntimeQuality;
}

export interface VisualAcceptanceIssue {
  level: "error" | "warning" | "info";
  code: string;
  message: string;
}

export interface VisualAcceptanceResult {
  version: 1;
  ok: boolean;
  score: number;
  checks: Array<{
    code: string;
    passed: boolean;
    message: string;
  }>;
  issues: VisualAcceptanceIssue[];
}

function normalizedContent(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/^['"]|['"]$/gu, "")
    .replace(/\\(["'])/gu, "$1")
    .trim();
}

function hasVisiblePresentation(element: RuntimeVisualElement | undefined) {
  if (!element || element.visibleCount < 1 || !element.computed) return false;
  const background = element.computed.backgroundColor ?? "";
  const image = element.computed.backgroundImage ?? "";
  const border = element.computed.border ?? "";
  return Boolean(
    (background && !/rgba?\(0, 0, 0, 0\)|transparent/iu.test(background)) ||
      (image && image !== "none") ||
      (border && !/^0px\s+none/iu.test(border)),
  );
}

/**
 * Compare the browser-exported Mufy source contract with the browser-exported
 * Dearm result. This deliberately verifies observable outcomes instead of CSS
 * text equality: host DOMs differ, but the migrated card must preserve the
 * same visible affordances and must not introduce clipping or broken media.
 */
export function verifyMufyVisualAcceptance(
  source: RuntimeVisualSnapshot,
  target: RuntimeVisualSnapshot,
): VisualAcceptanceResult {
  const issues: VisualAcceptanceIssue[] = [];
  const checks: VisualAcceptanceResult["checks"] = [];
  const sourceQuality = source.quality;
  const targetQuality = target.quality;

  const check = (code: string, passed: boolean, message: string) => {
    checks.push({ code, passed, message });
    if (!passed) issues.push({ level: "error", code, message });
  };

  if (!sourceQuality || sourceQuality.version !== 1) {
    check(
      "SOURCE_VISUAL_CONTRACT_MISSING",
      false,
      "Mufy 来源快照没有视觉验收合同；请用最新版 export-mufy-runtime.js 重新导出",
    );
  }
  if (!targetQuality || targetQuality.version !== 1) {
    check(
      "TARGET_VISUAL_CONTRACT_MISSING",
      false,
      "寄情测试服快照没有视觉验收数据；请运行 export-dearm-runtime.js",
    );
  }
  if (!sourceQuality || !targetQuality) {
    return { version: 1, ok: false, score: 0, checks, issues };
  }

  check(
    "NO_HORIZONTAL_OVERFLOW",
    targetQuality.layout.horizontalOverflowPx <= 2,
    targetQuality.layout.horizontalOverflowPx <= 2
      ? "页面没有横向溢出"
      : `页面横向溢出 ${targetQuality.layout.horizontalOverflowPx}px，移动端会被裁切`,
  );
  check(
    "NO_BROKEN_MEDIA",
    targetQuality.media.brokenImages.length === 0 &&
      targetQuality.media.failedMedia.length === 0,
    targetQuality.media.brokenImages.length === 0 &&
      targetQuality.media.failedMedia.length === 0
      ? "图片与音视频资源均可加载"
      : `存在损坏媒体：${[
          ...targetQuality.media.brokenImages,
          ...targetQuality.media.failedMedia,
        ].join("、")}`,
  );

  if (sourceQuality.requirements.customMessageBubbles) {
    check(
      "MESSAGE_BUBBLE_PRESENTATION",
      hasVisiblePresentation(targetQuality.hostElements.aiMessage) ||
        hasVisiblePresentation(targetQuality.hostElements.userMessage),
      "来源卡自定义了对话气泡，寄情必须保留可见的背景、边框或纹理",
    );
  }

  if (sourceQuality.requirements.customThinkToggle) {
    const allCollapsed =
      targetQuality.interactions.thinkToggleCount > 0 &&
      targetQuality.interactions.collapsedThinkToggleCount ===
        targetQuality.interactions.thinkToggleCount;
    const think = targetQuality.hostElements.thinkToggle;
    const hasAnimation = Boolean(
      think &&
        [think.before?.animationName, think.after?.animationName].some(
          (name) => name && name !== "none",
        ),
    );
    check(
      "THINK_DEFAULT_COLLAPSED",
      allCollapsed,
      "思考内容首次进入必须默认收起",
    );
    check(
      "THINK_CUSTOM_PRESENTATION",
      hasAnimation ||
        Boolean(
          normalizedContent(think?.before?.content) ||
            normalizedContent(think?.after?.content),
        ),
      "来源卡定制了思考按钮，寄情必须保留图标、文字或动效",
    );
  }

  const expectedComposer = normalizedContent(
    sourceQuality.requirements.composerOverlayText,
  );
  if (expectedComposer) {
    const actualComposer = normalizedContent(
      targetQuality.interactions.composerBeforeContent ||
        targetQuality.interactions.composerPlaceholder,
    );
    check(
      "COMPOSER_COPY_PRESERVED",
      actualComposer.includes(expectedComposer),
      actualComposer.includes(expectedComposer)
        ? "输入框定制文案已保留"
        : `输入框文案不一致：期望“${expectedComposer}”，实际“${actualComposer || "空"}”`,
    );
  }

  const expectedWarning = normalizedContent(
    sourceQuality.requirements.dismissibleWarningText,
  );
  if (expectedWarning) {
    check(
      "DISMISSIBLE_WARNING_PRESERVED",
      targetQuality.interactions.dismissibleTexts.some((text) =>
        normalizedContent(text).includes(expectedWarning),
      ),
      `顶部可关闭提示必须保留“${expectedWarning}”`,
    );
  }

  if (sourceQuality.requirements.floatingUiCount > 0) {
    const targetFloaters = targetQuality.fixedElements.filter(
      (element) =>
        element.visibleRatio >= 0.9 && (element.innerOverflowPx ?? 0) <= 2,
    );
    check(
      "FLOATING_UI_VISIBLE",
      targetFloaters.length >= sourceQuality.requirements.floatingUiCount,
      `来源页有 ${sourceQuality.requirements.floatingUiCount} 个悬浮组件；寄情需保持固定且完整可见`,
    );
  }

  const passed = checks.filter((entry) => entry.passed).length;
  const score = checks.length ? Math.round((passed / checks.length) * 100) : 0;
  return {
    version: 1,
    ok: issues.every((issue) => issue.level !== "error"),
    score,
    checks,
    issues,
  };
}
