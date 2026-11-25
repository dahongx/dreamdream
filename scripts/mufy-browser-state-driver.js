import { captureMufyViewportProof } from "./mufy-browser-viewport-proof.js";
import { visibleRead } from './mufy-visible-read.js';

/** One bounded, checkpointable step, called only by authorized cua_repl.
 * No sends, network APIs, database, storage, hidden app state or author buttons.
 * The caller saves metadata + pngBytes immediately before the next step.
 */
export async function inspectMufySurfaceStep(tab, expected, options = {}) {
  const startedAt = new Date().toISOString(), monotonicStart = performance.now();
  let checkpointPauseMs=0;
  const phase=async info=>{const start=performance.now();await options.onPhase?.(info);if(options.onPhase)checkpointPauseMs+=performance.now()-start;};
  const height = options.height ?? 844;
  if (!Number.isSafeInteger(height) || height < 200 || height > 2000) throw Error("INVALID_VIEWPORT_HEIGHT");
  if (!["initial", "expanded", "collapsed", "reopened"].includes(expected.state)) throw Error("UNKNOWN_STATE");
  const hasVisibility = options.browser && (!options.browser.capabilities.list ||
    (await options.browser.capabilities.list()).some(c=>c.id==="visibility"));
  if (hasVisibility && expected.state !== "initial" &&
      !await (await options.browser.capabilities.get("visibility")).get())
    throw Error("VISIBLE_BROWSER_REQUIRED_BEFORE_INTERACTION");
  const assertNoUnexpectedDialog = async () => {
    const dialogs = await tab.playwright.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].filter(e => {
      const r=e.getBoundingClientRect(), s=getComputedStyle(e);
      return r.width>0 && r.height>0 && s.display!=="none" && s.visibility!=="hidden" && s.opacity!=="0" && r.bottom>0 && r.right>0 && r.top<innerHeight && r.left<innerWidth;
    }).length);
    if (dialogs) throw Error("UNEXPECTED_DIALOG_STOP_INTERACTION");
  };
  const url = new URL(await tab.url());
  const surface = expected.surface ?? "chat";
  const focused = expected.messageIndex !== undefined;
  const openingOnly = expected.openingOnly === true;
  if(options.deferOpeningFrameMetrics&&(!openingOnly||typeof options.captureViewportProof!=='function'))throw Error('SETTLED_OPENING_CAPTURE_REQUIRED');
  if (openingOnly && focused) throw Error("OPENING_AND_REPLY_SCOPE_CONFLICT");
  if (focused && (surface !== "chat" || !Number.isSafeInteger(expected.messageIndex) || expected.messageIndex < 1)) throw Error("LATER_MESSAGE_INDEX_REQUIRED");
  if (url.origin !== "http://115.29.213.73:8091" ||
    !["chat", "preview"].includes(surface) ||
    url.pathname !== `/${surface === "preview" ? "characters" : "chat"}/${expected.characterId}`) throw Error("EXACT_TEST_CARD_REQUIRED");
  // Check overlays before waiting for an accessible heading: a legitimate
  // daily check-in dialog makes the underlying page inert, not unavailable.
  await assertNoUnexpectedDialog();
  const exactHeading = tab.playwright.getByRole("heading", { name: expected.characterName, exact: true });
  if (!await exactHeading.isVisible()) await exactHeading.waitFor({ state: "visible", timeoutMs: 10000 });
  await assertNoUnexpectedDialog();
  const cdp = await tab.capabilities.get("cdp");
  // Use the host's real scale, not a forced 1x scale. On a 150% Windows
  // display, forcing 1x can desynchronize the IAB compositor and click map.
  // Clear a previous step's override before sampling; otherwise it becomes
  // the next step's supposed "native" scale.
  if(options.viewportMode==="browser"){
    if(!options.browser) throw Error("BROWSER_VIEWPORT_PROVIDER_REQUIRED");
    const current = await tab.playwright.evaluate(() => ({width:innerWidth,height:innerHeight}));
    // Reapplying the same override can reset the extension compositor and
    // desynchronize iframe input coordinates. Preserve an already-set size.
    if(current.width!==expected.width || current.height!==height)
      await (await options.browser.capabilities.get("viewport")).set({width:expected.width,height});
  }else{
    await cdp.send("Emulation.clearDeviceMetricsOverride", {});
    // A separately measured host DPR can bypass a stale post-clear reading.
    const nativeDpr = options.deviceScaleFactor ?? await tab.playwright.evaluate(() => devicePixelRatio);
    if (!Number.isFinite(nativeDpr) || nativeDpr <= 0) throw Error("INVALID_NATIVE_DEVICE_SCALE");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: expected.width, height, deviceScaleFactor: nativeDpr, mobile: false });
  }
  const refs = await tab.playwright.locator('iframe[title^="regex-"]').evaluateAll(es => {
    const seen = new Map();
    return es.map(e => {
      const instance = seen.get(e.title) || 0; seen.set(e.title, instance + 1);
      return { title: e.title, instance, messageIndex: [...e.ownerDocument.querySelectorAll(".nj_ai_message_row")].indexOf(e.closest(".nj_ai_message_row")) };
    });
  });
  const nativeRowCount = await tab.playwright.locator(".nj_ai_message_row").count();
  if (focused && expected.messageIndex >= nativeRowCount) throw Error("LATER_MESSAGE_NOT_PRESENT");
  if (!refs.length && !nativeRowCount) throw Error("NO_RENDERED_CONTENT");
  const actions = [], frames = [];
  const activateSummary = async (control, wantedOpen) => {
    try { await control.press("Enter", { timeoutMs: 3000 }); }
    catch(error) {
      // Some extension backends focus/scroll successfully but fail to deliver
      // the locator key. Never blindly repeat a toggle: read actual state and
      // confirm focus belongs to this exact summary before ordinary keyboard.
      const current=await control.evaluate(e=>({open:e.parentElement.open,focused:e.ownerDocument.activeElement===e}));
      if(current.open===wantedOpen)return;
      if(!current.focused || typeof tab.pressKey!=="function")throw error;
      await tab.pressKey(null,"Return");
    }
  };
  for (const ref of refs) {
    if (focused && ref.messageIndex !== expected.messageIndex) continue;
    if (openingOnly && (ref.messageIndex > 0 || ref.title.includes("floating"))) continue;
    await phase({phase:'frame-start',title:ref.title});
    const selector = "iframe[title=" + JSON.stringify(ref.title) + "] >> nth=" + ref.instance;
    const frame = tab.playwright.frameLocator(selector);
    if (expected.state !== "initial" && !ref.title.includes("floating")) {
      const open = expected.state !== "collapsed";
      const observedControls = await frame.locator("details > summary").evaluateAll(es => es.map((e,index)=>({index,open:e.parentElement.open,exclusiveGroup:e.parentElement.getAttribute('name'),label:e.textContent.trim().slice(0,100),visible:e.getBoundingClientRect().height>0&&e.getBoundingClientRect().width>0})));
      const indices = observedControls.map(e=>e.index); if (!open) indices.reverse();
      for (const i of indices) {
        const l = frame.locator("details > summary").nth(i);
        const before = observedControls[i];
        if (!before.visible && !await l.isVisible()) continue;
        // Earlier clicks can close a named sibling; never reuse its stale open state.
        const currentOpen = before.exclusiveGroup ? await l.evaluate(e=>e.parentElement.open) : before.open;
        if (currentOpen === open) continue;
        // Native details supports Enter. Keyboard activation avoids the
        // extension's observed iframe coordinate misrouting after scrolling.
        await activateSummary(l,open);
        let actual = await l.evaluate(e => e.parentElement.open);
        const settleStart = Date.now();
        while (actual !== open && Date.now() - settleStart < 1500) actual = await l.evaluate(e => e.parentElement.open);
        const action = { ...ref, index: i, label: before.label, exclusiveGroup: before.exclusiveGroup, requestedOpen: open, actualOpen: actual, settleElapsedMs: Date.now() - settleStart };
        actions.push(action);
        if (actual !== open) throw Error("FOLD_DID_NOT_SETTLE:" + JSON.stringify(action));
      }
      await assertNoUnexpectedDialog();
    }
    await phase({phase:'frame-read',title:ref.title});
    // Opening checkpoint performs a fresh settled read of every frame after
    // all interactions. Avoid reading the identical documents twice.
    if(openingOnly && options.deferOpeningFrameMetrics)continue;
    const metrics = await visibleRead(tab, () => frame.locator("body").evaluate(b => {
      const d = b.ownerDocument, w = d.defaultView;
      const visible = e => { const r = e.getBoundingClientRect(), s = w.getComputedStyle(e); return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden"; };
      return {
        text: b.innerText, bodyBackground: w.getComputedStyle(b).backgroundColor,
        htmlBackground: w.getComputedStyle(d.documentElement).backgroundColor,
        bodyHeight: b.getBoundingClientRect().height, bodyScrollHeight: b.scrollHeight,
        rootScrollHeight: d.documentElement.scrollHeight, innerWidth: w.innerWidth,
        overflowPx: Math.max(0, d.documentElement.scrollWidth - w.innerWidth),
        sourceCanvas: !!b.querySelector(".mufy-source-canvas"),
        systemBoxes: [...b.querySelectorAll(".mufy_message_system")].map(e => { const s = w.getComputedStyle(e); return { text: e.textContent, background: s.backgroundColor, border: s.border }; }),
        unresolvedUser: /mufyer|\{\{user\}\}/i.test(b.innerText),
        controls: [...b.querySelectorAll("details > summary")].map((e, index) => ({ index, label: e.textContent.trim().slice(0, 100), visible: visible(e), open: e.parentElement.open })),
        images: [...b.querySelectorAll("img[src]")].filter(visible).map(e => ({ src: e.getAttribute("src"), loaded: e.complete && e.naturalWidth > 0, pending: !e.complete })),
      };
    }, undefined, { timeoutMs: 10000 }));
    const host = await tab.playwright.locator(selector).evaluate(e => ({ width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height,
      messageIndex: [...e.ownerDocument.querySelectorAll(".nj_ai_message_row")].indexOf(e.closest(".nj_ai_message_row")) }));
    frames.push({ ...ref, host, ...metrics });
  }
  // Zero-rule cards often render real replies in ordinary DOM, not iframes.
  // Inspect and exercise those controls as well; an opening iframe is not
  // evidence that later native message rows were checked.
  if (expected.state !== "initial") for (let messageIndex = 0; messageIndex < nativeRowCount; messageIndex++) {
    if (focused && messageIndex !== expected.messageIndex) continue;
    if (openingOnly && messageIndex !== 0) continue;
    const row = tab.playwright.locator(".nj_ai_message_row").nth(messageIndex);
    const n = await row.locator("details > summary", {}).count();
    const open = expected.state !== "collapsed";
    const indices = Array.from({ length: n }, (_, i) => i); if (!open) indices.reverse();
    for (const i of indices) {
      const control = row.locator("details > summary", {}).nth(i);
      if (!await control.isVisible()) continue;
      const before = await control.evaluate(e => ({ open: e.parentElement.open, label: e.textContent.trim().slice(0, 100) }));
      if (before.open === open) continue;
      await assertNoUnexpectedDialog();
      await activateSummary(control,open);
      await assertNoUnexpectedDialog();
      let actual = await control.evaluate(e => e.parentElement.open);
      const settleStart = Date.now();
      while (actual !== open && Date.now() - settleStart < 1500) actual = await control.evaluate(e => e.parentElement.open);
      const action = { nativeMessageIndex: messageIndex, index: i, label: before.label, requestedOpen: open, actualOpen: actual, settleElapsedMs: Date.now() - settleStart };
      actions.push(action);
      if (actual !== open) throw Error("NATIVE_MESSAGE_FOLD_DID_NOT_SETTLE:" + JSON.stringify(action));
    }
  }
  const messages = await tab.playwright.locator(".nj_ai_message_row").evaluateAll(rows => rows.map((row, messageIndex) => {
    const w = row.ownerDocument.defaultView;
    const visible = e => { const r = e.getBoundingClientRect(), s = w.getComputedStyle(e); return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden"; };
    const r = row.getBoundingClientRect();
    return { messageIndex, messageKey: "dom-assistant-" + messageIndex, text: row.innerText,
      bounds: { top: r.top, bottom: r.bottom, left: r.left, right: r.right },
      narrativeText: [...row.querySelectorAll("p")].filter(e => !e.closest("details") && visible(e)).map(e => e.innerText).join("\n"),
      width: r.width, height: r.height, overflowPx: Math.max(0, row.scrollWidth - row.clientWidth),
      iframeCount: row.querySelectorAll("iframe").length,
      controls: [...row.querySelectorAll("details > summary")].map((e, index) => ({ index, label: e.textContent.trim().slice(0, 100), visible: visible(e), open: e.parentElement.open,
        background: w.getComputedStyle(e.parentElement).backgroundColor, border: w.getComputedStyle(e.parentElement).border })),
      systemBoxes: [...row.querySelectorAll(".mufy_message_system")].map(e => ({ background: w.getComputedStyle(e).backgroundColor, border: w.getComputedStyle(e).border })),
      unresolvedUser: /mufyer|\{\{user\}\}/i.test(row.innerText), rawSystemTags: row.querySelectorAll("system,sys").length,
    };
  }));
  const host = await tab.playwright.evaluate(() => ({ width: innerWidth, height: innerHeight, clientWidth:document.documentElement.clientWidth, dpr: devicePixelRatio, overflowPx: Math.max(0, document.documentElement.scrollWidth - innerWidth), assistantRows: document.querySelectorAll(".nj_ai_message_row").length, userRows: document.querySelectorAll(".nj_user_message_bubble").length }));
  await phase({phase:'viewport-proof'});
  const proof = await (options.captureViewportProof ?? captureMufyViewportProof)(tab, expected, options);
  return { version: 2, scope: "live-structure-observation-not-final-fidelity", finalAccepted: false,
    screenshotReview: { status: "unreviewed", browserVisible: proof.browserVisible, reason: "PNG dimensions and DOM bounds cannot prove compositor freshness or pixel readability; inspect the actual displayed capture" },
    coverage: focused ? { kind: "one-later-message", messageIndex: expected.messageIndex } : openingOnly ? {kind:"opening-and-intro"} : { kind: "whole-surface" },
    expected, viewport:proof.viewport, url: url.href, startedAt, observedAt: new Date().toISOString(), elapsedMs: performance.now() - monotonicStart - checkpointPauseMs, checkpointPauseMs,
    timingScope: "this step only, including clicks and image capture", host, frames, messages, actions,
    capture:proof.capture,originalBytes:proof.originalBytes,pngBytes: proof.pngBytes };
}
