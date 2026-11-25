/** Execute only in the authorized cua_repl with an existing TEST tab.
 * No credential, storage, private application state or network API access.
 * The caller saves pngBytes and the metadata separately; do not print bytes.
 * Native screenshots retain the original JPEG and losslessly transcode to PNG.
 * Neither raw CDP nor native capture is inherently fresh: geometry is checked
 * and the actual rendered image must still be reviewed before acceptance.
 */
export async function captureMufyViewportProof(tab, expected, options = {}) {
  const url = new URL(await tab.url());
  const surface = expected.surface ?? "chat";
  if (url.origin !== "http://115.29.213.73:8091" ||
      !["chat", "preview"].includes(surface) ||
      url.pathname !== `/${surface === "preview" ? "characters" : "chat"}/${expected.characterId}` ||
      ![390, 1280].includes(expected.width)) throw Error("EXACT_TEST_CHAT_AND_VIEWPORT_REQUIRED");
  const viewport = await tab.playwright.evaluate(() => ({
    width: innerWidth, height: innerHeight, devicePixelRatio,
    scrollX, scrollY,
    clientWidth: document.documentElement.clientWidth,
    characterName: document.querySelector("h1")?.textContent,
  }));
  if (viewport.width !== expected.width || viewport.characterName !== expected.characterName)
    throw Error("ACTUAL_CARD_OR_VIEWPORT_MISMATCH");
  const cdp = await tab.capabilities.get("cdp");
  let browserVisible = null;
  if (options.browser) {
    const hasVisibility=!options.browser.capabilities.list || (await options.browser.capabilities.list()).some(c=>c.id==="visibility");
    if(hasVisibility){
      browserVisible = await (await options.browser.capabilities.get("visibility")).get();
      if (!browserVisible) throw Error("VISIBLE_BROWSER_REQUIRED_FOR_PAINT_PROOF");
    }
    // The native browser API selects/captures its tab itself. A raw debugger
    // command here can fail after the Chrome viewport controller detaches.
    if(!options.nativePngEncoder)await cdp.send("Page.bringToFront");
  }
  // Explicit, bounded compositor settling for an observed IAB paint lag.
  // This does not attest freshness; the actual image still needs review.
  if (options.paintWaitMs !== undefined) {
    if (!Number.isFinite(options.paintWaitMs) || options.paintWaitMs < 0 || options.paintWaitMs > 1000)
      throw Error("INVALID_PAINT_WAIT");
    if (options.paintWaitMs) await tab.playwright.waitForTimeout(options.paintWaitMs);
  }
  let originalBytes, capture;
  let pngBytes;
  if(options.nativePngEncoder){
    // Explicit viewport clip prevents Chrome's default screenshot path from
    // scaling scrollable preview pages to clientWidth (excluding scrollbar).
    let viewportFallback=false;
    try {
      if(options.nativeViewportCapture){
        // Chrome can return the pre-focus compositor frame even after DOM
        // geometry settles. Prime the documented native surface and retain the
        // following frame; image review is still mandatory, never auto-pass.
        if(typeof tab.getAXState==='function')await tab.getAXState({emit:false});
        await tab.getScreenshot({emit:false});
        originalBytes=Buffer.from(await tab.getScreenshot({emit:false}));viewportFallback=true;
      }
      else originalBytes=Buffer.from(await tab.screenshot({clip:{x:viewport.scrollX??0,y:viewport.scrollY??0,width:viewport.width,height:viewport.height}}));
    } catch(error) {
      if(!String(error?.message).includes("Page.captureScreenshot") || typeof tab.getScreenshot!=="function")throw error;
      // The documented standard viewport capture is a separate backend path.
      // Preserve its original bytes, including any provider client-width scale.
      originalBytes=Buffer.from(await tab.getScreenshot({emit:false}));
      viewportFallback=true;
    }
    if(originalBytes[0]!==255 || originalBytes[1]!==216)throw Error("NATIVE_JPEG_REQUIRED");
    pngBytes=Buffer.from(await options.nativePngEncoder(originalBytes));
    capture={backend:"native-browser-api",normalization:"jpeg-to-png-no-resize",pixelRatio:1,method:viewportFallback?"standard-viewport":"explicit-viewport-clip"};
    const measuredClientScale=Number.isSafeInteger(viewport.clientWidth) && viewport.clientWidth>0 && viewport.clientWidth<=viewport.width && viewport.width-viewport.clientWidth<=32 && pngBytes.readUInt32BE(16)===viewport.clientWidth && Math.abs(pngBytes.readUInt32BE(20)-viewport.height*viewport.clientWidth/viewport.width)<=1;
    if(viewport.clientWidth!==viewport.width && measuredClientScale){
      const clientWidth=viewport.clientWidth;
      if(!Number.isSafeInteger(clientWidth) || clientWidth<=0 || clientWidth>viewport.width || viewport.width-clientWidth>32)throw Error("NATIVE_VIEWPORT_FOOTPRINT_REQUIRED");
      capture={...capture,rasterMode:"client-width-scaled-viewport",pixelRatio:clientWidth/viewport.width};
    }
  }else{
  const result = await cdp.send("Page.captureScreenshot", {
    format: "png", fromSurface: true, captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: viewport.width, height: viewport.height, scale: 1 },
  });
  pngBytes = Buffer.from(result.data, "base64");
  }
  if (pngBytes.length < 33 || pngBytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a")
    throw Error("ACTUAL_PNG_REQUIRED");
  const rasterRatio=capture?.pixelRatio ?? viewport.devicePixelRatio;
  if (Math.abs(pngBytes.readUInt32BE(16) - viewport.width * rasterRatio) > 1 ||
      Math.abs(pngBytes.readUInt32BE(20) - viewport.height * rasterRatio) > 1)
    throw Error("SCREENSHOT_ACTUAL_VIEWPORT_MISMATCH:"+JSON.stringify({viewport,pngWidth:pngBytes.readUInt32BE(16),pngHeight:pngBytes.readUInt32BE(20),rasterRatio}));
  return { scope: "viewport-screenshot-only-not-final-acceptance", url: url.href,
    observedAt: new Date().toISOString(), viewport, browserVisible,
    pixelReview: "required; valid image geometry is not evidence of fresh painted content", capture,originalBytes,pngBytes };
}
