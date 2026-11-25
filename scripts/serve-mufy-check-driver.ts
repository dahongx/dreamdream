/** Fixed local source viewer, no request proxy, browser control, or credentials. */
const code = await Bun.file("scripts/mufy-browser-check-driver.js").text();
const escaped = code
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 4318,
  fetch(request) {
    if (new URL(request.url).pathname !== "/driver")
      return new Response("Not found", { status: 404 });
    return new Response(
      `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>迁移自动检查脚本</title></head><body><h1>迁移自动检查脚本</h1><p>仅展示仓库固定脚本，不执行检查，不读取凭据。</p><textarea id="driver" readonly rows="35" cols="110">${escaped}</textarea></body></html>`,
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  },
});
console.log(`Driver viewer: http://127.0.0.1:${server.port}/driver`);
