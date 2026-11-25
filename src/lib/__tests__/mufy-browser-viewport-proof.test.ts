import { expect, test } from "bun:test";
import { captureMufyViewportProof } from "../../../scripts/mufy-browser-viewport-proof.js";

const expected = { characterId: "target", characterName: "fixture", width: 390 };
function fixture(options: { width?: number; imageWidth?: number; imageHeight?: number; jpeg?: boolean; name?: string; url?: string; scrollY?:number } = {}) {
  const png = Buffer.alloc(33);
  Buffer.from("89504e470d0a1a0a", "hex").copy(png);
  png.writeUInt32BE(options.imageWidth ?? 390, 16);
  png.writeUInt32BE(options.imageHeight ?? 844, 20);
  if (options.jpeg) png[0] = 255;
  const calls: Array<{ method: string; params: unknown }> = [];
  const waits: number[]=[];
  const tab = {
    url: async () => options.url ?? "http://115.29.213.73:8091/chat/target",
    playwright: { evaluate: async () => ({ width: options.width ?? 390, height: 844, devicePixelRatio: 1, characterName: options.name ?? "fixture",scrollX:0,scrollY:options.scrollY??0 }), waitForTimeout:async(ms:number)=>{waits.push(ms);} },
    capabilities: { get: async () => ({ send: async (method: string, params: unknown) => { calls.push({ method, params }); return { data: png.toString("base64") }; } }) },
  };
  return { tab, calls, waits };
}
test("captures explicit clipped PNG, never host thumbnail or hidden state", async () => {
  const f = fixture(); const result = await captureMufyViewportProof(f.tab, expected);
  expect(result.scope).toBe("viewport-screenshot-only-not-final-acceptance");
  expect(f.calls).toEqual([{ method: "Page.captureScreenshot", params: { format: "png", fromSurface: true, captureBeyondViewport: true, clip: { x: 0, y: 0, width: 390, height: 844, scale: 1 } } }]);
});
test("scrolled native capture uses document coordinates rather than the page top",async()=>{
  const f=fixture({scrollY:2669.25}); const clips:unknown[]=[];
  const png=Buffer.alloc(33);Buffer.from("89504e470d0a1a0a","hex").copy(png);png.writeUInt32BE(390,16);png.writeUInt32BE(844,20);
  const tab={...f.tab,screenshot:async(options:unknown)=>{clips.push(options);return Buffer.from([255,216,255,217]);}};
  await captureMufyViewportProof(tab,expected,{nativePngEncoder:async()=>png});
  expect(clips).toEqual([{clip:{x:0,y:2669.25,width:390,height:844}}]);
});
test("requested mobile but actual desktop cannot be saved as mobile", async () => {
  const f = fixture({ width: 1280 });
  await expect(captureMufyViewportProof(f.tab, expected)).rejects.toThrow("ACTUAL_CARD_OR_VIEWPORT_MISMATCH");
  expect(f.calls).toHaveLength(0);
});
test("wrong card or non-test origin cannot be captured", async () => {
  await expect(captureMufyViewportProof(fixture({ name: "other" }).tab, expected)).rejects.toThrow();
  await expect(captureMufyViewportProof(fixture({ url: "https://dearm.ai/chat/target" }).tab, expected)).rejects.toThrow();
});
test("JPEG thumbnail and incorrect image geometry cannot pass", async () => {
  for (const options of [{ jpeg: true }, { imageWidth: 1280 }, { imageHeight: 720 }])
    await expect(captureMufyViewportProof(fixture(options).tab, expected)).rejects.toThrow();
});
test("hidden browser cannot produce a visible-paint proof even with correct PNG geometry", async () => {
  const f = fixture();
  const browser = { capabilities: { get: async () => ({ get: async () => false }) } };
  await expect(captureMufyViewportProof(f.tab, expected, {browser})).rejects.toThrow("VISIBLE_BROWSER_REQUIRED");
  expect(f.calls).toHaveLength(0);
});
test("visible capture targets the correct tab and still requires actual pixel review", async () => {
  const f = fixture();
  const browser = { capabilities: { get: async () => ({ get: async () => true }) } };
  const result = await captureMufyViewportProof(f.tab, expected, {browser});
  expect(result.browserVisible).toBe(true);
  expect(result.pixelReview).toContain("required");
  expect(f.calls[0].method).toBe("Page.bringToFront");
});
test("observed compositor lag can use a bounded wait without granting visual acceptance",async()=>{
  const f=fixture();const r=await captureMufyViewportProof(f.tab,expected,{paintWaitMs:250});
  expect(f.waits).toEqual([250]);expect(r.pixelReview).toContain("required");
  for(const paintWaitMs of [-1,1001,Infinity]) await expect(captureMufyViewportProof(f.tab,expected,{paintWaitMs})).rejects.toThrow("INVALID_PAINT_WAIT");
});
test("Chrome without a visibility capability still requires image review",async()=>{
  const f=fixture();
  const browser={capabilities:{list:async()=>[{id:"viewport"}],get:async()=>{throw Error("must not request unsupported visibility");}}};
  const r=await captureMufyViewportProof(f.tab,expected,{browser});
  expect(r.browserVisible).toBe(null);expect(r.pixelReview).toContain("required");
  expect(f.calls[0].method).toBe("Page.bringToFront");
});
test("native capture clips the exact viewport without resizing or raw debugger input",async()=>{
  const f=fixture(); const optionsSeen:unknown[]=[];
  const native=Buffer.from([255,216,255,217]);
  const png=Buffer.alloc(33);Buffer.from("89504e470d0a1a0a","hex").copy(png);png.writeUInt32BE(390,16);png.writeUInt32BE(844,20);
  const tab={...f.tab,screenshot:async(options:unknown)=>{optionsSeen.push(options);return native;}};
  const browser={capabilities:{list:async()=>[{id:"viewport"}]}};
  const r=await captureMufyViewportProof(tab,expected,{browser,nativePngEncoder:async(bytes:Buffer)=>{expect(bytes).toEqual(native);return png;}});
  expect(optionsSeen).toEqual([{clip:{x:0,y:0,width:390,height:844}}]);
  expect(f.calls).toHaveLength(0);expect(r.capture?.pixelRatio).toBe(1);expect(r.pixelReview).toContain("required");
});
test("documented viewport fallback retains measured provider scale, not fabricated CSS pixels",async()=>{
  const f=fixture();let calls=0;
  const png=Buffer.alloc(33);Buffer.from("89504e470d0a1a0a","hex").copy(png);png.writeUInt32BE(375,16);png.writeUInt32BE(812,20);
  const tab={...f.tab,playwright:{...f.tab.playwright,evaluate:async()=>({width:390,height:844,clientWidth:375,devicePixelRatio:1.5,scrollY:2000,scrollX:0,characterName:"fixture"})},screenshot:async()=>{throw Error("Timed out waiting for CDP command Page.captureScreenshot");},getScreenshot:async()=>{calls++;return Buffer.from([255,216,255,217]);}};
  const r=await captureMufyViewportProof(tab,expected,{nativePngEncoder:async()=>png});
  expect(calls).toBe(1);expect(r.viewport.devicePixelRatio).toBe(1.5);expect(r.capture?.pixelRatio).toBe(375/390);expect(r.capture && "rasterMode" in r.capture ? r.capture.rasterMode : undefined).toBe("client-width-scaled-viewport");expect(r.pixelReview).toContain("required");
});

test("full viewport fallback does not inherit scrollbar scale",async()=>{
  const f=fixture();
  const png=Buffer.alloc(33);Buffer.from("89504e470d0a1a0a","hex").copy(png);png.writeUInt32BE(390,16);png.writeUInt32BE(844,20);
  const tab={...f.tab,playwright:{...f.tab.playwright,evaluate:async()=>({width:390,height:844,clientWidth:375,devicePixelRatio:1.5,scrollY:2000,scrollX:0,characterName:"fixture"})},screenshot:async()=>{throw Error("Timed out waiting for CDP command Page.captureScreenshot");},getScreenshot:async()=>Buffer.from([255,216,255,217])};
  const r=await captureMufyViewportProof(tab,expected,{nativePngEncoder:async()=>png});
  expect(r.capture?.pixelRatio).toBe(1);expect(r.capture && "rasterMode" in r.capture ? r.capture.rasterMode : undefined).toBeUndefined();
});

test('explicit standard viewport capture never calls the stale clip backend',async()=>{
 const f=fixture();let screenshots=0;
 const png=Buffer.alloc(33);Buffer.from('89504e470d0a1a0a','hex').copy(png);png.writeUInt32BE(390,16);png.writeUInt32BE(844,20);
 const tab={...f.tab,screenshot:async()=>{throw Error('clip backend must not run');},getScreenshot:async()=>{screenshots++;return Buffer.from([255,216,255,217]);}};
 const r=await captureMufyViewportProof(tab,expected,{nativeViewportCapture:true,nativePngEncoder:async()=>png});
 expect(screenshots).toBe(2);expect(r.capture?.method).toBe('standard-viewport');expect(r.pixelReview).toContain('required');
});
