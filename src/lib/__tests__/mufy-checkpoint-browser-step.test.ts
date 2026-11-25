import { afterAll, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkpointMufyBrowserStep } from "../../../scripts/mufy-checkpoint-browser-step.js";

const roots:string[]=[];
const expected={characterId:"card",characterName:"fixture",surface:"chat",width:390,state:"expanded",messageIndex:1};
const stem="fixture-chat-390-expanded";
async function fixture(){
  const root=await mkdtemp(join(tmpdir(),"mufy-checkpoint-test-")); roots.push(root);
  // Cache-boundary fixture only; never a production visual attestation.
  const bytes=Buffer.from("unit-test-image-bytes");
  await writeFile(join(root,stem+".png"),bytes);
  await writeFile(join(root,stem+".json"),JSON.stringify({expected,elapsedMs:123,screenshot:{sha256:createHash("sha256").update(bytes).digest("hex")}}));
  return {root,runId:"test",key:"fixture",expected,tab:{},browser:{}};
}
afterAll(async()=>{for(const root of roots){
  await unlink(join(root,stem+".json"));await unlink(join(root,stem+".png"));await rmdir(root);
}});
test("a hash-bound saved step resumes without browser access or a false final pass",async()=>{
  const f=await fixture();
  const r=await checkpointMufyBrowserStep(f);
  expect(r.reused).toBe(true);expect(r.elapsedMs).toBe(123);expect(r.finalAccepted).toBe(false);
});
test("same filename cannot replay another message's evidence",async()=>{
  const f=await fixture();
  await expect(checkpointMufyBrowserStep({...f,expected:{...expected,messageIndex:2}})).rejects.toThrow("CHECKPOINT_BINDING_OR_HASH_MISMATCH");
});
test("modified screenshot bytes invalidate a checkpoint before browser actions",async()=>{
  const f=await fixture();await writeFile(join(f.root,stem+".png"),"changed");
  await expect(checkpointMufyBrowserStep(f)).rejects.toThrow("CHECKPOINT_BINDING_OR_HASH_MISMATCH");
});
