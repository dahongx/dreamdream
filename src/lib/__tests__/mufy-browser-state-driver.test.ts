import { expect, test } from "bun:test";
import { inspectMufySurfaceStep } from "../../../scripts/mufy-browser-state-driver.js";

// Browser boundary mock only; never substitutes for actual DOM evidence.
function fixture(rowCount: number, dpr = 1, misrouteClick=false, keyFailure: "none" | "focused" | "unfocused" | "delivered" = "none") {
  let unexpectedDialog = false;
  const controls = Array.from({ length: rowCount }, (_, i) => ({ textContent: `row${i}`, parentElement: { open: false }, ownerDocument:{activeElement:null as unknown} }));
  const clicks: string[] = [];
  const oneControl = (i: number) => ({
    isVisible: async () => true,
    evaluate: async (fn: (e: typeof controls[number]) => unknown) => fn(controls[i]),
    press: async (key:string) => {
      expect(key).toBe("Enter");
      if(keyFailure!=="unfocused")controls[i].ownerDocument.activeElement=controls[i];
      if(keyFailure==="none" || keyFailure==="delivered") {clicks.push(controls[i].textContent); controls[i].parentElement.open = !controls[i].parentElement.open;}
      if(misrouteClick) unexpectedDialog=true;
      if(keyFailure!=="none")throw Error("LOCATOR_KEY_FAILED");
    },
  });
  const rows = {
    count: async () => rowCount,
    nth: (i: number) => ({ locator: (selector: string, options: object) => {
      expect(selector).toBe("details > summary"); expect(options).toEqual({});
      return { count: async () => 1, nth: () => oneControl(i) };
    } }),
    evaluateAll: async () => controls.map((c, messageIndex) => ({ messageIndex, controls: [{ open:c.parentElement.open }] })),
  };
  const commands: Array<{method:string;params:unknown}> = [];
  const png = Buffer.alloc(33); Buffer.from("89504e470d0a1a0a", "hex").copy(png); png.writeUInt32BE(390*dpr, 16); png.writeUInt32BE(844*dpr, 20);
  const tab = {
    pressKey:async (_index:null,key:string)=>{expect(key).toBe("Return");const control=controls.find(c=>c.ownerDocument.activeElement===c);if(!control)throw Error("NO_VERIFIED_FOCUS");clicks.push(control.textContent);control.parentElement.open=!control.parentElement.open;},
    url: async () => "http://115.29.213.73:8091/chat/card",
    capabilities: { get: async () => ({ send: async (method: string,params:unknown) => { commands.push({method,params}); return method === "Page.captureScreenshot" ? { data:png.toString("base64") } : {}; } }) },
    playwright: {
      getByRole: () => ({ isVisible: async () => true, waitFor: async () => {} }),
      locator: (selector: string) => selector === "h1" ? {waitFor:async()=>{}} : selector === ".nj_ai_message_row" ? rows : { evaluateAll:async () => [] },
      evaluate: async (fn:() => unknown) => fn.toString().includes('[role="dialog"]') ? Number(unexpectedDialog) : fn.toString().includes("() => devicePixelRatio") ? dpr : ({ width:390,height:844,devicePixelRatio:dpr,dpr,characterName:"fixture" }),
    },
  };
  return { tab, clicks, commands };
}
const expected = { characterId:"card",characterName:"fixture",width:390,state:"expanded",messageIndex:1 };

test('deferred opening metrics require a settled capture provider',async()=>{
 const f=fixture(1);
 await expect(inspectMufySurfaceStep(f.tab,{...expected,messageIndex:undefined,openingOnly:true},{deferOpeningFrameMetrics:true})).rejects.toThrow('SETTLED_OPENING_CAPTURE_REQUIRED');
 await expect(inspectMufySurfaceStep(f.tab,expected,{deferOpeningFrameMetrics:true,captureViewportProof:async()=>({})})).rejects.toThrow('SETTLED_OPENING_CAPTURE_REQUIRED');
 expect(f.clicks).toHaveLength(0);
});

test("opening-only checks do not toggle already accepted later replies", async()=>{
  const f=fixture(3);
  const result=await inspectMufySurfaceStep(f.tab,{...expected,messageIndex:undefined,openingOnly:true});
  expect(f.clicks).toEqual(["row0"]);
  expect(result.coverage).toEqual({kind:"opening-and-intro"});
  expect(result.messages[1].controls[0].open).toBe(false);
  expect(result.messages[2].controls[0].open).toBe(false);
});

test("opening-only cannot be mislabeled as a later reply",async()=>{
  const f=fixture(3);
  await expect(inspectMufySurfaceStep(f.tab,{...expected,openingOnly:true})).rejects.toThrow("OPENING_AND_REPLY_SCOPE_CONFLICT");
  expect(f.clicks).toHaveLength(0);
});
test("native-only later replies are checked without requiring an iframe", async () => {
  const f = fixture(2);
  const expanded = await inspectMufySurfaceStep(f.tab, expected);
  expect(f.clicks).toEqual(["row1"]); expect(expanded.frames).toHaveLength(0);
  expect(expanded.messages[1].controls[0].open).toBe(true); expect(expanded.finalAccepted).toBe(false);
  const collapsed = await inspectMufySurfaceStep(f.tab, { ...expected,state:"collapsed" });
  expect(collapsed.messages[1].controls[0].open).toBe(false);
});
test("focused checks never toggle another reply or opening", async () => {
  const f = fixture(3);
  const result = await inspectMufySurfaceStep(f.tab, { ...expected,messageIndex:2 });
  expect(f.clicks).toEqual(["row2"]); expect(result.coverage).toEqual({kind:"one-later-message",messageIndex:2});
});
test("opening, missing later reply and empty page cannot become later-reply evidence", async () => {
  const f = fixture(1);
  await expect(inspectMufySurfaceStep(f.tab, {...expected,messageIndex:0})).rejects.toThrow("LATER_MESSAGE_INDEX_REQUIRED");
  await expect(inspectMufySurfaceStep(f.tab, expected)).rejects.toThrow("LATER_MESSAGE_NOT_PRESENT");
  await expect(inspectMufySurfaceStep(fixture(0).tab, {...expected,messageIndex:undefined})).rejects.toThrow("NO_RENDERED_CONTENT");
});
test("viewport steps reset stale overrides and preserve the real 150% host scale", async () => {
  const f = fixture(2,1.5);
  await inspectMufySurfaceStep(f.tab,expected);
  expect(f.commands[0].method).toBe("Emulation.clearDeviceMetricsOverride");
  expect(f.commands[1]).toEqual({method:"Emulation.setDeviceMetricsOverride",params:{width:390,height:844,deviceScaleFactor:1.5,mobile:false}});
});
test("a separately observed host scale can bypass a stale post-clear DPR", async () => {
  const f=fixture(2,1.5);
  await inspectMufySurfaceStep(f.tab,expected,{deviceScaleFactor:1.5});
  expect(f.commands[1].params).toEqual({width:390,height:844,deviceScaleFactor:1.5,mobile:false});
  await expect(inspectMufySurfaceStep(f.tab,expected,{deviceScaleFactor:0})).rejects.toThrow("INVALID_NATIVE_DEVICE_SCALE");
});
test("a misrouted click opening a dialog stops immediately even if a fold also changed", async()=>{
  const f=fixture(3,1,true);
  await expect(inspectMufySurfaceStep(f.tab,{...expected,messageIndex:undefined})).rejects.toThrow("UNEXPECTED_DIALOG_STOP_INTERACTION");
  expect(f.clicks).toHaveLength(1);
});
test("hidden interactive runs stop before any click",async()=>{
  const f=fixture(2);
  const browser={capabilities:{get:async()=>({get:async()=>false})}};
  await expect(inspectMufySurfaceStep(f.tab,expected,{browser})).rejects.toThrow("VISIBLE_BROWSER_REQUIRED_BEFORE_INTERACTION");
  expect(f.clicks).toHaveLength(0);
});
test("invalid viewport heights stop before browser interaction",async()=>{
  const f=fixture(2);
  await expect(inspectMufySurfaceStep(f.tab,expected,{height:0})).rejects.toThrow("INVALID_VIEWPORT_HEIGHT");
  expect(f.commands).toHaveLength(0);
});
test("browser viewport already at requested size is not reapplied",async()=>{
  const f=fixture(2); let sets=0;
  const browser={capabilities:{list:async()=>[{id:"viewport"}],get:async()=>({set:async()=>{sets++;}})}};
  await inspectMufySurfaceStep(f.tab,expected,{browser,viewportMode:"browser"});
  expect(sets).toBe(0);
  expect(f.commands.some(c=>c.method.startsWith("Emulation."))).toBe(false);
});
test("failed locator key falls back only on the exact focused summary",async()=>{
  const f=fixture(2,1,false,"focused");
  const r=await inspectMufySurfaceStep(f.tab,expected);
  expect(f.clicks).toEqual(["row1"]);expect(r.messages[1].controls[0].open).toBe(true);
});
test("a failed locator key without verified focus never sends a global key",async()=>{
  const f=fixture(2,1,false,"unfocused");
  await expect(inspectMufySurfaceStep(f.tab,expected)).rejects.toThrow("LOCATOR_KEY_FAILED");
  expect(f.clicks).toHaveLength(0);
});
test("a delivered key followed by a tool error is never double-toggled",async()=>{
  const f=fixture(2,1,false,"delivered");
  const r=await inspectMufySurfaceStep(f.tab,expected);
  expect(f.clicks).toEqual(["row1"]);expect(r.messages[1].controls[0].open).toBe(true);
});
