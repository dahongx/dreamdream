/** Run in the authorized cua_repl with an existing tab handle, never by opening
 * a second browser or retrieving credentials. All clicks are native summaries;
 * no send, save, follow, delete, or arbitrary author buttons are clicked. */
async function runMufyBrowserCheck(tab, options) {
  const start = Date.now();
  const expected = new URL(options.url);
  if (
    expected.origin !== "http://115.29.213.73:8091" ||
    !/^\/(chat|characters)\/[a-f\d-]{36}$/.test(expected.pathname)
  )
    throw Error("EXACT_TEST_CARD_URL_REQUIRED");
  const cdp = await tab.capabilities.get("cdp");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: options.width,
    height: 844,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const rows = [],
    actions = [];
  try {
    if ((await tab.url()) !== expected.href) await tab.goto(expected.href);
    await tab.playwright
      .locator("iframe[title^='regex-']")
      .first()
      .waitFor({ state: "attached", timeoutMs: 15000 });
    // Read fresh titles per state: navigation may replace earlier iframe nodes.
    async function frames() {
      return tab.playwright
        .locator("iframe[title^='regex-']")
        .evaluateAll((es) => {
          const occurrences = new Map();
          return es.map((e) => {
            const occurrence = occurrences.get(e.title) || 0;
            occurrences.set(e.title, occurrence + 1);
            return {
              title: e.title,
              selector:
                "iframe[title=" +
                JSON.stringify(e.title) +
                "] >> nth=" +
                occurrence,
              hostHeight: e.getBoundingClientRect().height,
            };
          });
        });
    }
    const all = await frames();
    if (!all.length) throw Error("MISSING_FRAMES");
    const main = all.filter((f) => !f.title.includes("floating"));
    if (!main.length) throw Error("NO_CONTENT_FRAMES");
    async function observe(state) {
      const frameRows = [];
      for (const frame of await frames()) {
        const selector = frame.selector;
        const body = tab.playwright.frameLocator(selector).locator("body");
        await body.waitFor({ state: "attached", timeoutMs: 15000 });
        // Wait for already-present resources, without requesting new URLs or
        // changing lazy loading. A pending image is not a broken image.
        const deadline = Date.now() + 8000;
        while (
          Date.now() < deadline &&
          (await body.evaluate((body) =>
            [...body.querySelectorAll("img[src]")].some(
              (e) => !e.complete && e.loading !== "lazy",
            ),
          ))
        ) {
          // Read-only DOM adapters expose properties, not event registration.
          // A short debugger timer lets the existing page load advance.
          await cdp.send("Runtime.evaluate", {
            expression: "new Promise(resolve => setTimeout(resolve, 250))",
            awaitPromise: true,
          });
        }
        const metrics = await body.evaluate((body) => {
          const doc = body.ownerDocument,
            win = doc.defaultView;
          const visible = (e) => {
            const r = e.getBoundingClientRect(),
              s = win.getComputedStyle(e);
            return (
              r.width > 0 &&
              r.height > 0 &&
              s.display !== "none" &&
              s.visibility !== "hidden"
            );
          };
          const summaries = [...body.querySelectorAll("details > summary")];
          return {
            textChars: body.innerText.trim().length,
            bodyHeight: body.getBoundingClientRect().height,
            width: win.innerWidth,
            overflowPx: Math.max(
              0,
              doc.documentElement.scrollWidth - win.innerWidth,
            ),
            unresolvedUser: /mufyer|\{\{user\}\}/i.test(body.innerText),
            images: [...body.querySelectorAll("img[src]")]
              .filter(visible)
              .map((e) => ({
                src: e.getAttribute("src"),
                complete: e.complete,
                loaded: e.complete && e.naturalWidth > 0,
              })),
            // Nested hidden controls still belong to an expanded parent check;
            // never treat a hidden summary's stored open flag as an operable one.
            controls: summaries.map((e, index) => ({
              index,
              label: e.textContent.trim().slice(0, 100),
              visible: visible(e),
              open: e.parentElement.open,
            })),
          };
        });
        const host = await tab.playwright.locator(selector).evaluate((e) => ({
          height: e.getBoundingClientRect().height,
          width: e.getBoundingClientRect().width,
        }));
        frameRows.push({ title: frame.title, selector, host, ...metrics });
      }
      const row = {
        state,
        observedAt: new Date().toISOString(),
        frames: frameRows,
      };
      rows.push(row);
      return row;
    }
    async function fold(open) {
      // Static summary selectors: filtering details:not([open]) changes nth
      // positions after each click and silently skips later controls.
      for (const frame of await frames()) {
        if (frame.title.includes("floating")) continue;
        const f = tab.playwright.frameLocator(frame.selector);
        const count = await f.locator("details > summary").count();
        const indices = Array.from({ length: count }, (_, i) => i);
        if (!open) indices.reverse();
        for (const index of indices) {
          const l = f.locator("details > summary").nth(index);
          if (!(await l.isVisible())) continue;
          const before = await l.evaluate((e) => ({
            open: e.parentElement.open,
            label: e.textContent.trim().slice(0, 100),
          }));
          if (before.open === open) continue;
          await l.click({ timeoutMs: 3000 });
          // A native click may be acknowledged before its toggle handler has
          // settled. Observe boundedly; never click again to "retry" a toggle.
          let after = await l.evaluate((e) => e.parentElement.open);
          const settleStartedAt = Date.now();
          while (after !== open && Date.now() - settleStartedAt < 1500) {
            after = await l.evaluate((e) => e.parentElement.open);
          }
          actions.push({
            frame: frame.title,
            selector: frame.selector,
            index,
            label: before.label,
            requestedOpen: open,
            actualOpen: after,
            settleElapsedMs: Date.now() - settleStartedAt,
          });
          if (after !== open)
            throw Error("FOLD_CLICK_DID_NOT_CHANGE_STATE:" + before.label);
        }
      }
    }
    const requestedStates = options.state
      ? [options.state]
      : ["initial", "expanded", "collapsed", "reopened"];
    if (
      requestedStates.some(
        (s) => !["initial", "expanded", "collapsed", "reopened"].includes(s),
      )
    )
      throw Error("UNKNOWN_STATE");
    for (const state of requestedStates) {
      if (state !== "initial") await fold(state !== "collapsed");
      const row = await observe(state);
      if (
        row.frames
          .filter((f) => !f.title.includes("floating"))
          .every((f) => f.textChars === 0 && !f.images.some((i) => i.loaded))
      )
        throw Error("EMPTY_RENDER");
      if (state !== "initial") {
        const wrong = row.frames
          .filter((f) => !f.title.includes("floating"))
          .flatMap((f) =>
            f.controls.filter(
              (c) => c.visible && c.open !== (state !== "collapsed"),
            ),
          );
        if (wrong.length)
          throw Error(
            "INCOMPLETE_FOLD_STATE:" + wrong.map((c) => c.label).join(","),
          );
      }
    }
    if (!options.state || options.state === "reopened") await fold(false);
    const result = {
      version: 1,
      scope: "browser-structural-and-native-fold-only",
      finalFidelityAccepted: false,
      url: await tab.url(),
      width: options.width,
      inspectionId: options.inspectionId,
      startedAt: new Date(start).toISOString(),
      finishedAt: new Date().toISOString(),
      executionMs: Date.now() - start,
      rows,
      actions,
      findings: rows.flatMap((r) =>
        r.frames.flatMap((f) => [
          ...(f.overflowPx > 2
            ? [
                {
                  code: "HORIZONTAL_OVERFLOW",
                  state: r.state,
                  frame: f.title,
                  pixels: f.overflowPx,
                },
              ]
            : []),
          ...(f.unresolvedUser
            ? [{ code: "UNRESOLVED_USER", state: r.state, frame: f.title }]
            : []),
          ...f.images
            .filter((i) => !i.loaded)
            .map((i) => ({
              code: i.complete ? "IMAGE_NOT_LOADED" : "IMAGE_PENDING",
              state: r.state,
              frame: f.title,
              src: i.src,
            })),
        ]),
      ),
    };
    if (options.save) {
      // Each step is checkpointed before returning. A later tool timeout must
      // not erase earlier browser evidence held only in REPL memory.
      const filename =
        "mufy-browser-step-" +
        expected.pathname.split("/").slice(1).join("-") +
        "-" +
        options.width +
        "-" +
        (options.state || "all") +
        "-" +
        Date.now() +
        ".json";
      const download = tab.playwright.waitForEvent("download", {
        timeoutMs: 15000,
      });
      await cdp.send("Runtime.evaluate", {
        expression:
          "(()=>{const blob=new Blob([" +
          JSON.stringify(JSON.stringify(result)) +
          "],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=" +
          JSON.stringify(filename) +
          ";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)})()",
      });
      result.artifactPath = await (await download).path();
    }
    return result;
  } catch (error) {
    return {
      version: 1,
      scope: "browser-structural-and-native-fold-only",
      finalFidelityAccepted: false,
      url: await tab.url(),
      width: options.width,
      startedAt: new Date(start).toISOString(),
      finishedAt: new Date().toISOString(),
      executionMs: Date.now() - start,
      rows,
      actions,
      findings: [
        {
          code: "BROWSER_CHECK_FAILED",
          reason: String(error.message || error),
        },
      ],
    };
  } finally {
    await cdp.send("Emulation.clearDeviceMetricsOverride", {});
  }
}
