/** Snapshot TEST and apply only Tips-owned hunks, preserving all unrelated work. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
const root="outputs/reply-suggestions-20261027/release";
const ssh=["ssh","-o","BatchMode=yes","-o","ConnectTimeout=10","root@115.29.213.73"];
function run(args:string[]) {const p=Bun.spawnSync(args,{stderr:"inherit"});if(p.exitCode)throw Error("READ_FAILED");return p.stdout.toString();}
const remote=(cmd:string)=>run([...ssh,cmd]);
const hash=(s:string)=>createHash("sha256").update(s).digest("hex");
if(remote("cd /root/projects/yearn-chat && docker compose port app 3000").trim()!=="0.0.0.0:8091")throw Error("WRONG_TARGET");
const existing=["src/components/chat/ChatRoom.tsx",...['types','zh','zh-TW','en','ja-JP','th-TH'].map(x=>`src/i18n/${x}.ts`)];
const added=["src/components/chat/ReplySuggestions.tsx","src/lib/chat/reply-suggestions.ts","src/app/api/chat/suggestions/route.ts"];
const entries=[];
for(const path of existing){
 const before=remote(`cd /root/projects/yearn-chat && cat ${path}`); let after=before;
 const diff=run(["git","diff","--",path]);
 const hunks=diff.split(/^@@[^\n]*\n/m).slice(1);
 let applied=0;
 for(const hunk of hunks){
  if(!(path.endsWith("ChatRoom.tsx") ? /ReplySuggestions|suggestionContextKey|id="nj_chat_input_box"|min-h-13/.test(hunk) : hunk.includes("replySuggestions:")))continue;
  const lines=hunk.split("\n").filter(l=>/^[ +\-]/.test(l));
  const oldText=lines.filter(l=>l[0]!=="+").map(l=>l.slice(1)).join("\n")+"\n";
  const newText=lines.filter(l=>l[0]!=="-").map(l=>l.slice(1)).join("\n")+"\n";
  if(after.split(oldText).length!==2)throw Error(`PATCH_CONFLICT:${path}`);
  after=after.replace(oldText,newText);applied++;
 }
 if(!applied)throw Error(`NO_PATCH:${path}`);
 for(const [folder,content] of [["before",before],["patch",after]]){await mkdir(dirname(`${root}/${folder}/${path}`),{recursive:true});await writeFile(`${root}/${folder}/${path}`,content);}
 entries.push({path,before:hash(before),after:hash(after)});
}
for(const path of added){
 if(remote(`test -e /root/projects/yearn-chat/${path} && echo exists || echo absent`).trim()!=="absent")throw Error(`ALREADY_EXISTS:${path}`);
 const content=await readFile(path,"utf8");await mkdir(dirname(`${root}/patch/${path}`),{recursive:true});await writeFile(`${root}/patch/${path}`,content);entries.push({path,before:null,after:hash(content)});
}
await writeFile(`${root}/manifest.json`,JSON.stringify({target:"TEST-8091",entries},null,2));
console.log(`Prepared ${entries.length} scoped files; remote untouched`);
