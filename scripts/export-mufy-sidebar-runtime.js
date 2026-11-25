/*
 * Run this file in the browser console while the target Mufy chat page is open.
 * It performs read-only requests and downloads a local JSON snapshot. It never
 * serializes the login token.
 */
(async () => {
  const url = new URL(window.location.href);
  const characterId = url.searchParams.get("roleId");
  const sessionId = url.searchParams.get("sessionId");
  const token = window.localStorage.getItem("mufy-token");

  if (!characterId || !sessionId) {
    throw new Error("当前网址缺少 roleId 或 sessionId");
  }
  if (!token) {
    throw new Error("当前页面没有登录令牌，请先确认 Mufy 已登录");
  }

  const selector = [
    "#injected-ghost-sidebar-root",
    '[id*="sidebar" i]',
    '[class*="sidebar" i]',
    '[id*="player" i]',
    '[class*="player" i]',
    '[id*="audio" i]',
    '[class*="audio" i]',
    '[id^="cen_"]',
    '[class*="censy"]',
    "audio",
  ].join(",");

  const candidates = [...document.querySelectorAll(selector)];
  const roots = [];
  const seen = new Set();

  for (const node of candidates) {
    let root = node;
    let cursor = node;
    for (let depth = 0; depth < 6 && cursor?.parentElement; depth += 1) {
      const style = getComputedStyle(cursor);
      if (style.position === "fixed") root = cursor;
      cursor = cursor.parentElement;
    }
    if (seen.has(root)) continue;
    seen.add(root);

    const style = getComputedStyle(root);
    const rect = root.getBoundingClientRect();
    roots.push({
      tagName: root.tagName,
      id: root.id || null,
      className:
        typeof root.className === "string" ? root.className : String(root.className),
      position: style.position,
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      zIndex: style.zIndex,
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      outerHTML: root.outerHTML,
    });
  }

  const tokens = new Set();
  for (const root of roots) {
    if (root.id) tokens.add(`#${root.id}`);
    for (const className of String(root.className).split(/\s+/)) {
      if (className) tokens.add(`.${className}`);
    }
  }

  const matchingCssRules = [];
  for (const sheet of [...document.styleSheets]) {
    let rules;
    try {
      rules = [...sheet.cssRules];
    } catch {
      continue;
    }
    for (const rule of rules) {
      const cssText = rule.cssText || "";
      if ([...tokens].some((tokenValue) => cssText.includes(tokenValue))) {
        matchingCssRules.push(cssText);
      }
    }
  }

  const inlineStyles = [...document.querySelectorAll("style")]
    .map((style, index) => ({ index, text: style.textContent || "" }))
    .filter(({ text }) =>
      [...tokens].some((tokenValue) => text.includes(tokenValue)),
    );

  const audio = [...document.querySelectorAll("audio")].map((element) => ({
    id: element.id || null,
    className: element.className || null,
    src: element.getAttribute("src"),
    currentSrc: element.currentSrc || null,
    duration: Number.isFinite(element.duration) ? element.duration : null,
    paused: element.paused,
    loop: element.loop,
    outerHTML: element.outerHTML,
  }));

  const resourceUrls = performance
    .getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((resourceUrl) =>
      /audio|music|\.mp3(?:\?|$)|\.m4a(?:\?|$)|\.wav(?:\?|$)|\.ogg(?:\?|$)/i.test(
        resourceUrl,
      ),
    );

  const dialogPages = [];
  for (let pageNum = 1; pageNum <= 100; pageNum += 1) {
    const params = new URLSearchParams({
      sessionId,
      pageNum: String(pageNum),
      pageSize: "80",
      characterId,
    });
    const response = await fetch(`/api/dialogs/query?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json().catch(() => null);
    dialogPages.push({ status: response.status, body });
    if (!response.ok || !body?.data?.hasNext) break;
  }

  const snapshot = {
    version: 1,
    exportedAt: new Date().toISOString(),
    pageUrl: window.location.href,
    characterId,
    sessionId,
    tokenPresent: true,
    runtimeNodes: roots,
    audio,
    resourceUrls: [...new Set(resourceUrls)],
    matchingCssRules,
    inlineStyles,
    dialogPages,
  };

  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = "mufy-shen-zhiheng-sidebar-runtime.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

  console.table({
    runtimeNodes: roots.length,
    audioElements: audio.length,
    mediaResources: snapshot.resourceUrls.length,
    dialogPages: dialogPages.length,
  });
})();
