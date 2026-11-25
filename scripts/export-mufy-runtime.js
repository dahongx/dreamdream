/*
 * Mufy 登录页运行态导出器（通用版）。
 *
 * 用法：打开目标角色聊天页，等开场、小剧场、侧栏/播放器都出现后，把本文件
 * 全文粘贴到 DevTools Console / Sources -> Snippets 执行。脚本只读页面与接口，
 * 下载一个 JSON；不会发送消息、修改角色，也不会把登录 token 写入导出文件。
 *
 * 为什么详情 JSON 不够：codeRenderContent 保存作者源代码，但部分侧栏/播放器会
 * 在运行时注入 DOM；头像和封面 CDN 也可能只允许登录页读取。这个快照补齐运行后
 * DOM、相关 CSS、资源清单，并尽力把资源内嵌为 data URL，供寄情落到自己的存储。
 */
(async () => {
  const captureStartedAt = new Date().toISOString();
  const captureStarted = performance.now();
  const pageUrl = new URL(location.href);
  const characterId = pageUrl.searchParams.get("roleId");
  const token = localStorage.getItem("mufy-token");
  if (!characterId) throw new Error("当前网址缺少 roleId");
  if (!token) throw new Error("当前页面没有登录令牌，请先确认 Mufy 已登录");

  const detailResponse = await fetch(
    `/api/characters/get?id=${encodeURIComponent(characterId)}`,
    {
      credentials: "include",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    },
  );
  const detailBody = await detailResponse.json().catch(() => null);
  if (!detailResponse.ok || !detailBody?.data) {
    throw new Error(`角色详情读取失败：HTTP ${detailResponse.status}`);
  }
  const detail = detailBody.data;
  // Keep role source material, never the viewer's session or mask/persona fields.
  const publicDetailKeys = [
    "characterId",
    "name",
    "description",
    "creatorId",
    "creatorName",
    "avatarUrl",
    "backgroundUrl",
    "imageWidth",
    "imageHeight",
    "totalChats",
    "totalLikes",
    "tags",
    "updatedAt",
    "totalFollowers",
    "totalShares",
    "gender",
    "creatorDescriptionTitle",
    "creatorDescription",
    "age",
    "visibility",
    "greeting",
    "codeRenderContent",
    "items",
    "optimizationCode",
    "charaType",
    "shareMode",
  ];
  const publicDetail = Object.fromEntries(
    publicDetailKeys
      .filter((key) => Object.hasOwn(detail, key))
      .map((key) => [key, detail[key]]),
  );
  const sourceText = `${detail.optimizationCode || ""}\n${detail.codeRenderContent || ""}`;

  const rectRecord = (rect) => ({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  });
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

  const runtimeSelector = [
    "#injected-ghost-sidebar-root",
    '[id*="sidebar" i]',
    '[class*="sidebar" i]',
    '[id*="player" i]',
    '[class*="player" i]',
    '[id*="phone" i]',
    '[class*="phone" i]',
    '[id*="island" i]',
    '[class*="island" i]',
    '[id^="cen_"]',
    '[class*="censy"]',
    "audio",
  ].join(",");
  const roots = [];
  const seen = new Set();
  for (const candidate of document.querySelectorAll(runtimeSelector)) {
    let root = candidate;
    let cursor = candidate;
    for (let depth = 0; depth < 8 && cursor?.parentElement; depth += 1) {
      const style = getComputedStyle(cursor);
      if (style.position === "fixed" || style.position === "sticky")
        root = cursor;
      cursor = cursor.parentElement;
    }
    if (root.id?.startsWith("codex-") || root.closest?.('[id^="codex-"]'))
      continue;
    if (seen.has(root)) continue;
    seen.add(root);
    const style = getComputedStyle(root);
    const rect = root.getBoundingClientRect();
    roots.push({
      tagName: root.tagName,
      id: root.id || null,
      className:
        typeof root.className === "string"
          ? root.className
          : String(root.className),
      computed: {
        position: style.position,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        zIndex: style.zIndex,
        inset: [style.top, style.right, style.bottom, style.left],
        width: style.width,
        height: style.height,
      },
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      outerHTML: root.outerHTML,
    });
  }

  const selectorTokens = new Set();
  for (const root of roots) {
    if (root.id) selectorTokens.add(`#${root.id}`);
    for (const className of root.className.split(/\s+/)) {
      if (className) selectorTokens.add(`.${className}`);
    }
  }
  const matchingCssRules = [];
  const visitRules = (rules) => {
    for (const rule of rules) {
      const cssText = rule.cssText || "";
      if ([...selectorTokens].some((value) => cssText.includes(value))) {
        matchingCssRules.push(cssText);
      }
      if (rule.cssRules) visitRules([...rule.cssRules]);
    }
  };
  for (const sheet of document.styleSheets) {
    try {
      visitRules([...sheet.cssRules]);
    } catch {
      /* cross-origin sheet */
    }
  }
  const inlineStyles = [...document.querySelectorAll("style")]
    .map((node, index) => ({ index, text: node.textContent || "" }))
    .filter(({ text }) =>
      [...selectorTokens].some((value) => text.includes(value)),
    );

  const resourceUrls = new Set(
    [detail.avatarUrl, detail.backgroundUrl].filter(Boolean),
  );
  const addUrl = (raw, base = location.href) => {
    if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return;
    try {
      const value = new URL(raw, base).href;
      if (/^https?:/i.test(value)) resourceUrls.add(value);
    } catch {
      /* malformed author URL */
    }
  };
  for (const node of document.querySelectorAll("img,source,audio,video")) {
    addUrl(node.currentSrc || node.getAttribute("src"));
    addUrl(node.getAttribute("poster"));
  }
  for (const node of document.querySelectorAll("*")) {
    const background = getComputedStyle(node).backgroundImage;
    for (const match of background.matchAll(/url\(["']?([^"')]+)["']?\)/g))
      addUrl(match[1]);
  }
  for (const entry of performance.getEntriesByType("resource")) {
    if (
      /\.(?:avif|webp|png|jpe?g|gif|svg|mp3|m4a|wav|ogg)(?:\?|$)/i.test(
        entry.name,
      ) ||
      /cdn\.mufy\.ai\/images\//i.test(entry.name)
    ) {
      addUrl(entry.name);
    }
  }
  for (const match of sourceText.matchAll(
    /(?:src|href)\s*=\s*["']([^"']+)["']|url\(["']?([^"')]+)["']?\)/gi,
  )) {
    addUrl(match[1] || match[2]);
  }
  for (const match of sourceText.matchAll(/https?:\/\/[^\s"'<>`\\)]+/gi)) {
    const raw = match[0].replace(/[;,]+$/, "");
    try {
      if (
        /\.(?:avif|webp|png|jpe?g|gif|svg|mp3|m4a|wav|ogg)$/i.test(
          new URL(raw).pathname,
        )
      )
        addUrl(raw);
    } catch {
      /* malformed author URL */
    }
  }

  const MAX_ASSET_BYTES = 10 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 40 * 1024 * 1024;
  const ASSET_FETCH_TIMEOUT_MS = 3_000;
  const ASSET_FETCH_CONCURRENCY = 6;
  let totalBytes = 0;
  const resourceList = [...resourceUrls];
  const assets = new Array(resourceList.length);
  const blobToDataUrl = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () =>
        reject(reader.error || new Error("FileReader failed"));
      reader.readAsDataURL(blob);
    });
  let nextResourceIndex = 0;
  const fetchNextAsset = async () => {
    while (nextResourceIndex < resourceList.length) {
      const index = nextResourceIndex;
      nextResourceIndex += 1;
      const url = resourceList[index];
      const record = {
        url,
        ok: false,
        contentType: null,
        size: null,
        dataUrl: null,
        error: null,
      };
      let reservedBytes = 0;
      let assetTimeout = null;
      try {
        const sameOrigin = new URL(url).origin === location.origin;
        const controller = new AbortController();
        assetTimeout = setTimeout(
          () => controller.abort(new Error("asset fetch timed out")),
          ASSET_FETCH_TIMEOUT_MS,
        );
        const response = await fetch(url, {
          credentials: sameOrigin ? "include" : "omit",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        record.contentType =
          blob.type ||
          response.headers.get("content-type") ||
          "application/octet-stream";
        record.size = blob.size;
        if (blob.size > MAX_ASSET_BYTES)
          throw new Error("asset exceeds 10 MiB limit");
        if (totalBytes + blob.size > MAX_TOTAL_BYTES)
          throw new Error("snapshot exceeds 40 MiB asset limit");
        totalBytes += blob.size;
        reservedBytes = blob.size;
        record.dataUrl = await blobToDataUrl(blob);
        record.ok = true;
      } catch (error) {
        if (reservedBytes > 0) totalBytes -= reservedBytes;
        record.error = error instanceof Error ? error.message : String(error);
      } finally {
        if (assetTimeout !== null) clearTimeout(assetTimeout);
      }
      assets[index] = record;
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(ASSET_FETCH_CONCURRENCY, resourceList.length) },
      fetchNextAsset,
    ),
  );

  const hostElements = {
    app: captureElement("#mufy_chat_app"),
    header: captureElement("#mufy_chat_header"),
    messages: captureElement("#mufy_chat_messages"),
    inputContainer: captureElement("#mufy_chat_input_container"),
    inputBox: captureElement("#mufy_chat_input_box"),
    aiMessage: captureElement(".mufy_ai_message_bubble"),
    userMessage: captureElement(".mufy_user_message_bubble"),
    narration: captureElement(".mufy_message_narration"),
    system: captureElement(".mufy_message_system"),
    thinkToggle: captureElement(
      ".group.flex.w-fit.cursor-pointer.select-none.items-center.gap-1",
    ),
  };
  const viewportArea = Math.max(1, innerWidth * innerHeight);
  const fixedElements = roots
    .filter((root) =>
      ["fixed", "sticky"].includes(String(root.computed?.position)),
    )
    .map((root) => {
      const rect = root.rect;
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
        signature: [root.id, root.className].filter(Boolean).join(" "),
        position: root.computed.position,
        rect,
        visibleRatio: Math.min(1, (visibleWidth * visibleHeight) / area),
        text: String(root.outerHTML || "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 240),
      };
    })
    .filter(
      (entry) => entry.rect.width * entry.rect.height < viewportArea * 0.9,
    );
  const thinkNodes = [
    ...document.querySelectorAll(
      ".group.flex.w-fit.cursor-pointer.select-none.items-center.gap-1",
    ),
  ];
  const textarea = document.querySelector("#mufy_chat_input_box textarea");
  const inputBox = document.querySelector("#mufy_chat_input_box");
  const cssContent = (selectorPattern) => {
    const match = sourceText.match(
      new RegExp(
        `${selectorPattern}[^{}]*::before\\s*\\{[^}]*content\\s*:\\s*["']([^"']+)["']`,
        "i",
      ),
    );
    return match?.[1] || null;
  };
  const dismissibleTexts = [...document.querySelectorAll("button")]
    .filter((button) => /关闭|close|×/i.test(button.textContent || ""))
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
      customMessageBubbles: /\.mufy_(?:ai|user)_message_bubble\b/i.test(
        sourceText,
      ),
      customThinkToggle:
        /btn-(?:underline-slide|text-breathe)|偷看剧本|⩌\s*_\s*⩌|\.group(?:\\:hover)?\.flex\.w-fit\.cursor-pointer/i.test(
          sourceText,
        ),
      composerOverlayText: cssContent("#mufy_chat_input_box"),
      dismissibleWarningText: cssContent("\\.z-dropdown[^,{]*"),
      floatingUiCount: fixedElements.length,
    },
    interactions: {
      thinkToggleCount: thinkNodes.length,
      collapsedThinkToggleCount: thinkNodes.filter(
        (node) => node.getAttribute("aria-expanded") === "false",
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

  const snapshot = {
    version: 3,
    exportedAt: new Date().toISOString(),
    captureStartedAt,
    captureExecutionMs: performance.now() - captureStarted,
    pageUrl: `${pageUrl.origin}${pageUrl.pathname}?roleId=${encodeURIComponent(characterId)}`,
    characterId,
    characterName: detail.name,
    tokenPresent: true,
    detail: { data: publicDetail },
    viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
    documentMetrics: {
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    },
    runtimeNodes: roots,
    matchingCssRules: [...new Set(matchingCssRules)],
    inlineStyles,
    quality,
    assets,
    assetSummary: {
      discovered: assets.length,
      embedded: assets.filter((asset) => asset.ok).length,
      failed: assets.filter((asset) => !asset.ok).length,
      embeddedBytes: totalBytes,
    },
  };
  window.__MUFY_RUNTIME_SNAPSHOT__ = snapshot;
  const snapshotJson = JSON.stringify(snapshot, null, 2);
  document.getElementById("mufy-runtime-snapshot-export")?.remove();
  const snapshotNode = document.createElement("script");
  snapshotNode.id = "mufy-runtime-snapshot-export";
  snapshotNode.type = "application/json";
  snapshotNode.textContent = snapshotJson;
  document.body.appendChild(snapshotNode);
  const safeName = String(detail.name || characterId).replace(
    /[\\/:*?"<>|]/g,
    "_",
  );
  const blob = new Blob([snapshotJson], {
    type: "application/json;charset=utf-8",
  });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = `${safeName}-mufy-runtime.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  console.table({
    character: detail.name,
    runtimeNodes: roots.length,
    resources: assets.length,
    embedded: snapshot.assetSummary.embedded,
    failed: snapshot.assetSummary.failed,
  });
})();
