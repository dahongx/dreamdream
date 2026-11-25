/*
 * Dearm 测试服迁移验收导出器。
 *
 * 在迁移后的角色聊天页执行。脚本只读当前 DOM / computed style / 资源状态，
 * 不发送消息也不修改数据。输出与 export-mufy-runtime.js 的 quality 契约兼容，
 * 交给 `bun run mufy:verify -- --source ... --target ...` 自动判定是否搬完。
 */
(() => {
  const rectRecord = (rect) => ({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  });
  const visible = (node) => {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number.parseFloat(style.opacity || "1") > 0 &&
      rect.width > 0 &&
      rect.height > 0
    );
  };
  const pseudoRecord = (node, pseudo) => {
    const style = getComputedStyle(node, pseudo);
    return {
      content: style.content,
      display: style.display,
      opacity: style.opacity,
      animationName: style.animationName,
      animationDuration: style.animationDuration,
    };
  };
  const captureElement = (selector) => {
    const nodes = [...document.querySelectorAll(selector)];
    const node = nodes.find(visible) || nodes[0] || null;
    if (!node) {
      return {
        selector,
        count: 0,
        visibleCount: 0,
        rect: null,
        computed: null,
        before: null,
        after: null,
      };
    }
    const style = getComputedStyle(node);
    return {
      selector,
      count: nodes.length,
      visibleCount: nodes.filter(visible).length,
      rect: rectRecord(node.getBoundingClientRect()),
      computed: {
        position: style.position,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        color: style.color,
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        border: style.border,
        borderRadius: style.borderRadius,
        padding: style.padding,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        overflow: style.overflow,
        zIndex: style.zIndex,
      },
      before: pseudoRecord(node, "::before"),
      after: pseudoRecord(node, "::after"),
    };
  };

  const hostElements = {
    app: captureElement("#nj_chat_app"),
    header: captureElement("#nj_chat_header"),
    messages: captureElement("#nj_chat_messages"),
    inputContainer: captureElement("#nj_chat_input_container"),
    inputBox: captureElement("#nj_chat_input_box"),
    aiMessage: captureElement(".nj_ai_message_bubble"),
    userMessage: captureElement(".nj_user_message_bubble"),
    narration: captureElement(".nj_message_narration"),
    system: captureElement(".nj_message_system"),
    thinkToggle: captureElement(".nj_message_think"),
  };

  const floaterCandidates = new Set([
    ...document.querySelectorAll(
      "#nj_floating_slot > *, [id^='regex-floating-']",
    ),
  ]);
  for (const node of document.querySelectorAll("body *")) {
    const style = getComputedStyle(node);
    if (
      (style.position === "fixed" || style.position === "sticky") &&
      !node.closest(
        "#nj_chat_header, #nj_chat_input_container, #nj_chat_sidebar, [role='dialog']",
      )
    ) {
      floaterCandidates.add(node);
    }
  }
  const viewportArea = Math.max(1, innerWidth * innerHeight);
  const fixedElements = [...floaterCandidates]
    .filter(visible)
    .map((node) => {
      const style = getComputedStyle(node);
      const rect = rectRecord(node.getBoundingClientRect());
      const iframe =
        node instanceof HTMLIFrameElement
          ? node
          : node.querySelector?.("iframe") || null;
      let innerOverflowPx = 0;
      try {
        const root = iframe?.contentDocument?.documentElement;
        if (root)
          innerOverflowPx = Math.max(0, root.scrollWidth - root.clientWidth);
      } catch {
        // Keep the contract JSON-safe while still making a cross-origin
        // iframe fail the "not clipped" acceptance threshold.
        innerOverflowPx = 1_000_000;
      }
      const visibleWidth = Math.max(
        0,
        Math.min(innerWidth, rect.x + rect.width) - Math.max(0, rect.x),
      );
      const visibleHeight = Math.max(
        0,
        Math.min(innerHeight, rect.y + rect.height) - Math.max(0, rect.y),
      );
      const area = Math.max(1, rect.width * rect.height);
      return {
        signature: [node.id, node.className].filter(Boolean).join(" "),
        position: style.position,
        rect,
        visibleRatio: Math.min(1, (visibleWidth * visibleHeight) / area),
        innerOverflowPx,
        text: (node.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 240),
      };
    })
    .filter(
      (entry) => entry.rect.width * entry.rect.height < viewportArea * 0.9,
    );

  const thinkNodes = [...document.querySelectorAll(".nj_message_think")];
  const textarea = document.querySelector("#nj_chat_input_textarea");
  const inputBox = document.querySelector("#nj_chat_input_box");
  const dismissibleTexts = [...document.querySelectorAll("button")]
    .filter((button) =>
      /关闭|關閉|close|×/i.test(
        button.textContent || button.getAttribute("aria-label") || "",
      ),
    )
    .map((button) =>
      button.parentElement?.textContent?.replace(/\s+/g, " ").trim(),
    )
    .filter(Boolean)
    .map((text) => text.slice(0, 240));
  const quality = {
    version: 1,
    hostElements,
    fixedElements,
    requirements: {
      customMessageBubbles: false,
      customThinkToggle: false,
      composerOverlayText: null,
      dismissibleWarningText: null,
      floatingUiCount: 0,
    },
    interactions: {
      thinkToggleCount: thinkNodes.length,
      collapsedThinkToggleCount: thinkNodes.filter(
        (node) => node.getAttribute("data-collapsed") === "true",
      ).length,
      expandedThinkToggleCount: thinkNodes.filter(
        (node) => node.getAttribute("aria-expanded") === "true",
      ).length,
      composerPlaceholder: textarea?.getAttribute("placeholder") || null,
      composerBeforeContent: inputBox
        ? getComputedStyle(inputBox, "::before").content
        : null,
      dismissibleTexts,
    },
    media: {
      brokenImages: [...document.images]
        .filter((image) => image.complete && image.naturalWidth === 0)
        .map((image) => image.currentSrc || image.src)
        .filter(Boolean),
      failedMedia: [...document.querySelectorAll("audio,video")]
        .filter((media) => media.error)
        .map((media) => media.currentSrc || media.src)
        .filter(Boolean),
    },
    layout: {
      horizontalOverflowPx: Math.max(
        0,
        document.documentElement.scrollWidth - innerWidth,
      ),
    },
  };

  const characterId = location.pathname.match(/\/chat\/([^/?#]+)/)?.[1] || null;
  const snapshot = {
    version: 1,
    exportedAt: new Date().toISOString(),
    pageUrl: location.href,
    characterId,
    viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
    quality,
  };
  window.__DEARM_RUNTIME_SNAPSHOT__ = snapshot;
  const json = JSON.stringify(snapshot, null, 2);
  document.getElementById("dearm-runtime-snapshot-export")?.remove();
  const snapshotNode = document.createElement("script");
  snapshotNode.id = "dearm-runtime-snapshot-export";
  snapshotNode.type = "application/json";
  snapshotNode.textContent = json;
  document.body.appendChild(snapshotNode);

  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = `${characterId || "character"}-dearm-runtime.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  console.table({
    characterId,
    thinkToggles: thinkNodes.length,
    collapsedThinkToggles: quality.interactions.collapsedThinkToggleCount,
    floatingUi: fixedElements.length,
    brokenMedia:
      quality.media.brokenImages.length + quality.media.failedMedia.length,
    horizontalOverflow: quality.layout.horizontalOverflowPx,
  });
})();
