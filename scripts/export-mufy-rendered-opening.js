/** Run only in the authorized, already-open Mufy page through the browser tool.
 * Public rendered opening only: no storage, cookies, credentials or requests.
 * Supply a distinctive visible opening text to avoid capturing another message.
 * The migration binder separately validates role ID and original greeting hash.
 */
function exportMufyRenderedOpening(needle, binding) {
  const roots = Array.from(document.querySelectorAll(".react-markdown"))
    .filter((e) => e.textContent.includes(needle))
    .sort((a, b) => a.textContent.length - b.textContent.length);
  const root = roots[0];
  const roleId = new URL(location.href).searchParams.get("roleId");
  if (!root || !roleId) throw Error("Visible opening and role ID required");
  // Lazy source artifacts may not mount their real DOM until their drawer is
  // opened normally. Never turn a collapsed/empty preview into a successful
  // migration capture. The operator must open it through the normal source UI.
  const sourceFrames = Array.from(root.querySelectorAll("iframe"));
  for (const frame of sourceFrames) {
    if (frame.closest("details:not([open])"))
      throw Error(
        "SOURCE_DRAWER_EXPANSION_REQUIRED: open source drawers through normal UI before capture",
      );
    if (!(frame.getAttribute("srcdoc") || "").trim())
      throw Error(
        "SOURCE_FRAME_NOT_READY: public preview is empty; not a successful capture",
      );
  }
  const capturedAt = new Date().toISOString();
  if (
    !binding ||
    binding.roleId !== roleId ||
    binding.responseCode !== 200 ||
    typeof binding.greetingSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(binding.greetingSha256) ||
    typeof binding.observedAt !== "string" ||
    !Number.isFinite(Date.parse(binding.observedAt)) ||
    Date.parse(binding.observedAt) <= 0 ||
    Date.parse(binding.observedAt) > Date.parse(capturedAt) + 60_000
  )
    throw Error("Normal public detail response binding required");
  const esc = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  // Keep authored, responsive layout values (1fr, %, media queries), rather
  // than freezing getComputedStyle's resolved grid tracks to source pixels.
  const layoutProps = [
    "display",
    "position",
    "inset",
    "top",
    "right",
    "bottom",
    "left",
    "width",
    "height",
    "min-width",
    "max-width",
    "min-height",
    "max-height",
    "overflow",
    "overflow-x",
    "overflow-y",
    "box-sizing",
    "grid",
    "grid-template",
    "grid-template-columns",
    "grid-template-rows",
    "grid-template-areas",
    "grid-area",
    "grid-auto-columns",
    "grid-auto-rows",
    "grid-auto-flow",
    "grid-column",
    "grid-row",
    "flex",
    "flex-basis",
    "flex-grow",
    "flex-shrink",
    "flex-direction",
    "flex-wrap",
    "align-items",
    "align-content",
    "align-self",
    "justify-content",
    "justify-items",
    "justify-self",
    "place-items",
    "place-content",
    "place-self",
    "gap",
    "row-gap",
    "column-gap",
  ];
  const nodes = [root, ...root.querySelectorAll("*")];
  const authored = new WeakMap();
  const layoutWarnings = [];
  function authoredRules(rules) {
    return Array.from(rules)
      .map((rule) => {
        if (rule.selectorText && rule.style) {
          let matched;
          try {
            matched = nodes.filter((n) => n.matches(rule.selectorText));
          } catch {
            return "";
          }
          if (!matched.length) return "";
          const customProperties = Array.from(rule.style).filter((p) =>
            p.startsWith("--"),
          );
          const declarations = [...layoutProps, ...customProperties]
            .filter((p) => rule.style.getPropertyValue(p))
            .map((p) => {
              matched.forEach((n) => {
                if (!authored.has(n)) authored.set(n, new Set());
                authored.get(n).add(p);
              });
              return (
                p +
                ":" +
                rule.style.getPropertyValue(p) +
                (rule.style.getPropertyPriority(p) ? "!important" : "")
              );
            });
          return declarations.length
            ? rule.selectorText + "{" + declarations.join(";") + "}"
            : "";
        }
        if (rule.cssRules) {
          const inner = authoredRules(rule.cssRules);
          // Keep @media / @supports / @layer conditions intact. @keyframes do
          // not contain selectorText and are not serialized as layout rules.
          const heading = rule.cssText.slice(0, rule.cssText.indexOf("{"));
          return inner &&
            /^\s*@(media|supports|layer|container)\b/i.test(heading)
            ? heading + "{" + inner + "}"
            : "";
        }
        return "";
      })
      .join("\n");
  }
  const authorLayoutCss = Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        return authoredRules(sheet.cssRules);
      } catch {
        layoutWarnings.push("stylesheet-unreadable");
        return "";
      }
    })
    .join("\n");
  const props = [
    "background-clip",
    "-webkit-background-clip",
    "-webkit-text-fill-color",
    "flex",
    "flex-basis",
    "min-width",
    "max-width",
    "object-fit",
    "display",
    "flex-direction",
    "flex-wrap",
    "align-items",
    "justify-content",
    "gap",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "line-height",
    "letter-spacing",
    "text-align",
    "color",
    "background-color",
    "background-image",
    "border-top",
    "border-right",
    "border-bottom",
    "border-left",
    "border-radius",
    "padding",
    "margin-top",
    "margin-bottom",
    "text-shadow",
    "box-shadow",
    "white-space",
    "overflow-wrap",
    "list-style",
    "vertical-align",
    "text-decoration",
    ...layoutProps,
  ];
  let frameCount = 0;
  function handlers(parent) {
    for (const e of parent.querySelectorAll("*")) {
      for (const a of Array.from(e.attributes))
        if (/^on/i.test(a.name))
          e.setAttribute(
            a.name,
            a.value.replace(/window\.parent\b/g, "window"),
          );
      if (e instanceof HTMLTemplateElement) handlers(e.content);
    }
  }
  function serial(n) {
    if (n.nodeType === 3) return esc(n.textContent);
    if (n.nodeType !== 1) return "";
    const tag = n.tagName.toLowerCase();
    if (["script", "style", "noscript", "template"].includes(tag)) return "";
    if (tag === "iframe") {
      frameCount++;
      const parsed = new DOMParser().parseFromString(
        n.getAttribute("srcdoc") || "",
        "text/html",
      );
      for (const s of parsed.querySelectorAll("script")) {
        if (
          /__MUFY_ARTIFACT_BRIDGE__|Network requests are blocked in sandbox|__MUFY_CLOSE_INITIAL_CONTEXT__/.test(
            s.textContent,
          )
        )
          s.remove();
        else
          s.textContent = s.textContent
            .replace(/window\.parent\b/g, "window")
            .replace(
              /navigator\.clipboard\.writeText\s*\(/g,
              "window.host.fillComposer(",
            );
      }
      handlers(parsed.body);
      // A standalone source document may define its only grid/scroll styles
      // in <head>; body.innerHTML alone silently drops these declarations.
      const headStyles = Array.from(parsed.head.querySelectorAll("style"))
        .map((s) => s.outerHTML)
        .join("");
      return (
        '<section data-mufy-source-frame="true">' +
        headStyles +
        parsed.body.innerHTML +
        "</section>"
      );
    }
    const style = getComputedStyle(n);
    // Used width/height are viewport-specific even when the source says auto.
    // Explicit dimensions are preserved from authored CSS/inline declarations.
    const css =
      [...new Set(props)]
        .filter(
          // Used opposite insets are resolved pixels even when authored as
          // auto. Freezing right/bottom constrains an absolute label at a new
          // mobile width and can collapse it to one character per line.
          (p) => !["width", "height", "inset", "top", "right", "bottom", "left"].includes(p) && !authored.get(n)?.has(p),
        )
        .map((p) => p + ":" + style.getPropertyValue(p))
        .join(";") +
      layoutProps
        .filter((p) => n.style.getPropertyValue(p))
        .map(
          (p) =>
            ";" +
            p +
            ":" +
            n.style.getPropertyValue(p) +
            (n.style.getPropertyPriority(p) ? "!important" : ""),
        )
        .join("") +
      (tag === "img"
        ? ";width:" + style.width + ";height:" + style.height
        : "");
    const attrs = [
      "id",
      "src",
      "alt",
      "href",
      "title",
      "colspan",
      "rowspan",
      "open",
    ]
      .filter((k) => n.hasAttribute(k))
      .map((k) => " " + k + '="' + esc(n.getAttribute(k)) + '"')
      .join("");
    const safeTag = ["html", "body"].includes(tag) ? "div" : tag;
    const classes =
      typeof n.className === "string" && n.className
        ? ' class="' + esc(n.className) + '"'
        : "";
    function pseudo(which) {
      const s = getComputedStyle(n, which),
        c = s.content;
      if (!c || ["none", "normal", '""'].includes(c)) return "";
      return (
        '<span style="' +
        esc(props.map((p) => p + ":" + s.getPropertyValue(p)).join(";")) +
        '">' +
        esc(c.replace(/^['"]|['"]$/g, "")) +
        "</span>"
      );
    }
    return (
      "<" +
      safeTag +
      classes +
      attrs +
      ' style="' +
      esc(css) +
      '">' +
      pseudo("::before") +
      Array.from(n.childNodes).map(serial).join("") +
      pseudo("::after") +
      (["br", "hr", "img"].includes(safeTag) ? "" : "</" + safeTag + ">")
    );
  }
  const result = {
    version: 1,
    roleId,
    capturedAt,
    greetingSha256: binding.greetingSha256,
    sourceBinding: binding,
    captureScope: "public-rendered-opening-only",
    html:
      "<style data-mufy-source-layout>" +
      authorLayoutCss +
      "</style>" +
      serial(root),
    frameCount,
    sourceFrameCoverage: {
      observed: sourceFrames.length,
      serialized: frameCount,
      collapsedDrawerFrames: 0,
      emptyPreviewFrames: 0,
      scope: "observed public DOM only; not a full-fidelity acceptance",
    },
    layoutCapture: {
      version: 2,
      authoredLayout: true,
      warnings: [...new Set(layoutWarnings)],
    },
  };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(result)], { type: "application/json" }),
  );
  a.download = "mufy-opening-" + roleId + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return { roleId, frameCount, htmlLength: result.html.length };
}
