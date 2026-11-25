/** Inert public-document inventory to prioritize browser QA; not runtime evidence. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { JSDOM } from "jsdom";

const start = performance.now();
const rows = [];
for (const group of ["71-80", "81-90", "91-100"]) {
  const root = resolve(`outputs/mufy-rank${group}-20261111`);
  const checkpoint = JSON.parse(
    await readFile(join(root, "checkpoint.json"), "utf8"),
  );
  for (const card of checkpoint.cards) {
    if (card.status?.startsWith("held")) continue;
    let raw: string;
    try {
      raw = await readFile(
        join(root, `rank${card.rank}`, "public-capture.json"),
        "utf8",
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    const capture = JSON.parse(raw) as { documents?: string[] };
    const documents = (capture.documents ?? []).map((html, index) => {
      const dom = new JSDOM(html); // scripts disabled, external resources disabled
      const document = dom.window.document;
      const css = [...document.querySelectorAll("style")]
        .map((node) => node.textContent ?? "")
        .join("\n");
      const programs = [...document.scripts]
        .map((node) => node.textContent ?? "")
        .filter(
          (code) =>
            !/__MUFY_ARTIFACT_BRIDGE__|__MUFY_CLOSE_INITIAL_CONTEXT__|Network requests are blocked in sandbox/.test(
              code,
            ),
        )
        .join("\n");
      const fixedSelectors = [
        ...css
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .matchAll(/([^{}]+)\{[^{}]*position\s*:\s*fixed\b[^{}]*\}/gi),
      ].map((match) => match[1].trim());
      const summary = {
        index,
        htmlLength: html.length,
        details: [...document.querySelectorAll("details")].map((node) => ({
          id: node.id,
          initiallyOpen: node.hasAttribute("open"),
          label:
            node.querySelector("summary")?.textContent?.trim().slice(0, 70) ??
            "",
        })),
        fixedSelectors,
        media: [...document.querySelectorAll("audio,video")].map((node) => ({
          tag: node.tagName,
          id: node.id,
          controls: node.hasAttribute("controls"),
          sourceCount: node.querySelectorAll("source").length,
          hasDirectSource: node.hasAttribute("src"),
        })),
        inputs: [...document.querySelectorAll("input,textarea,select")].map(
          (node) => ({
            tag: node.tagName,
            id: node.id,
            type: node.getAttribute("type"),
          }),
        ),
        remoteFrames: [...document.querySelectorAll("iframe[src]")].map(
          (node) => {
            try {
              const url = new URL(node.getAttribute("src")!);
              return { host: url.host, path: url.pathname };
            } catch {
              return { host: "", path: node.getAttribute("src") };
            }
          },
        ),
        interactionSignals: {
          inlineClickHandlers: document.querySelectorAll("[onclick]").length,
          programClickHandlers: (
            programs.match(/addEventListener\s*\(\s*['"]click['"]/g) ?? []
          ).length,
          parentDependency:
            /(?:window\.)?parent\s*\.|(?:window\.)?parent\s*;/.test(programs),
          clipboard: /clipboard|execCommand\s*\(\s*['"]copy['"]/.test(programs),
          hostComposer: /fillComposer|setComposer/.test(programs),
        },
      };
      dom.window.close();
      return summary;
    });
    rows.push({
      rank: card.rank,
      name: card.name,
      documents,
      requiresActualBrowserCheck: true,
    });
  }
}
const dir = resolve("outputs/mufy-rank71-100-coordination-20261111");
await mkdir(dir, { recursive: true });
await writeFile(
  join(dir, "public-widget-inventory.json"),
  JSON.stringify(
    {
      observedAt: new Date().toISOString(),
      elapsedMs: performance.now() - start,
      provenance:
        "saved public authored DOM; no scripts executed; not live pass evidence",
      rows,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    rows.map((row) => ({
      rank: row.rank,
      documents: row.documents.length,
      fixedDocuments: row.documents.filter((doc) => doc.fixedSelectors.length)
        .length,
      mediaDocuments: row.documents.filter((doc) => doc.media.length).length,
      remoteFrames: row.documents.flatMap((doc) => doc.remoteFrames).length,
    })),
  ),
);
