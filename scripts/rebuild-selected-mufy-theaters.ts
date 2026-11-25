#!/usr/bin/env bun

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
// jsdom is already present through the test/tooling dependency graph; this
// one-off migration intentionally avoids adding a production dependency.
// @ts-expect-error jsdom has no declaration package in this repository.
import { JSDOM } from "jsdom";
import postgres from "postgres";

const OWNER_EMAIL = "test@test.com";
const NAMES = [
  "陆永琛",
  "沈知衡",
  "闵熙彻",
  "公仪晢",
  "喻承砚",
  "赵漳平",
] as const;
type CardName = (typeof NAMES)[number];

const IDS: Record<CardName, string> = {
  陆永琛: "252e1466-9dcd-48cb-a580-dc97c9df85fb",
  沈知衡: "8143f91a-15d1-40a6-8a41-5b7f31f9dedf",
  闵熙彻: "5f1599a2-f379-4071-bf81-6b4c0450c1a9",
  公仪晢: "8c0c0995-b9b1-4fe2-a78c-cfe3bfeae8a4",
  喻承砚: "8667c339-beff-4478-bb9b-a707cc96fb16",
  赵漳平: "b6244940-5822-4f22-a256-c956828c8dd2",
};

const MEDIA: Partial<Record<CardName, { avatar: string; cover: string }>> = {
  陆永琛: {
    avatar:
      "https://cdn.rubii.ai/public/character/chara_68135c7c27d387c21b86b7fc.webp",
    cover:
      "https://cdn.rubii.ai/public/moment/68135c7c27d387c21b86b7fd_large.webp",
  },
  沈知衡: {
    avatar: "https://i.postimg.cc/qq16bzkC/szh_tx.png",
    cover: "https://i.postimg.cc/qMjWr19x/szhback.jpg",
  },
  闵熙彻: {
    avatar:
      "https://cdn.mufy.ai/images/21f26d18-ba02-443c-8f56-5ddc84496a00/public",
    cover: "https://free.picui.cn/free/2026/01/11/6963279c94ddd.jpg",
  },
  赵漳平: {
    avatar:
      "https://cdn.rubii.ai/public/180c7aa1-78b4-4435-96e3-bb74a471cef8/image/20260809073423_5ba198.jpg",
    cover:
      "https://cdn.rubii.ai/public/180c7aa1-78b4-4435-96e3-bb74a471cef8/image/20260809073423_5ba198.jpg",
  },
};

type TheaterConfig = {
  name: CardName;
  eyebrow: string;
  subtitle: string;
  quote: string;
  facts: Array<[string, string]>;
  sections: Array<{ title: string; kicker: string; body: string }>;
  images?: string[];
  palette: [string, string, string, string];
  variant: "editorial" | "archive" | "social" | "scroll" | "casebook";
};

const THEATERS: Record<Exclude<CardName, "赵漳平">, TheaterConfig> = {
  陆永琛: {
    name: "陆永琛",
    eyebrow: "HONG KONG · PRIVATE FILE",
    subtitle: "永昌国际集团执行董事",
    quote: "“人情同生意一样，先看筹码，再谈真心。”",
    facts: [
      ["年龄", "40"],
      ["身高", "190 CM"],
      ["生日", "11月8日"],
      ["常伴", "阿崩 · 缺耳灰猫"],
    ],
    sections: [
      {
        kicker: "ORIGIN",
        title: "深水埗起家",
        body: "从板间房、茶餐厅后厨和灰色生意里一路爬上来。九七年前后反向押注 BB 机，以第一桶金转入地产，最终建立横跨港澳深的永昌版图。",
      },
      {
        kicker: "TEMPER",
        title: "温雅只是表面",
        body: "港式普通话，待人斯文有礼，右脸笑起来有一枚酒窝；真正的底色却冷静、精于衡量，从不轻易交付信任。接电话常以一个“讲”字开场。",
      },
      {
        kicker: "CIRCLE",
        title: "身边的人",
        body: "阿萍与刘明负责近身事务；周岳山、祁远宁是多年利益与旧事交织的朋友。那只台风夜捡回来的灰猫阿崩，是少数不需要计算回报的存在。",
      },
      {
        kicker: "RELATION",
        title: "关系入口",
        body: "故事从一场平安夜慈善拍卖开始。玩家不是他的附属品，而是一个可能迫使他重新判断‘交易’与‘真心’边界的人。",
      },
    ],
    images: [
      "https://cdn.rubii.ai/public/moment/68135c7c27d387c21b86b7fd_large.webp",
      "https://img14.360buyimg.com/ddimg/jfs/t1/301485/1/24345/17579/6895978cF120235f2/c09ae6a22f611a61.jpg",
      "https://img12.360buyimg.com/ddimg/jfs/t1/291770/30/20341/11331/689865d8F2c9f1643/2eb12deaa009c427.jpg",
    ],
    palette: ["#171411", "#b88b55", "#f0dfc7", "184,139,85"],
    variant: "editorial",
  },
  沈知衡: {
    name: "沈知衡",
    eyebrow: "涵澹资本 · 家族密档",
    subtitle: "沈氏掌权人｜被精确规划的一生",
    quote: "“你没有错。错的是那些把选择留给我的人。”",
    facts: [
      ["年龄", "39"],
      ["身高", "190 CM"],
      ["身份", "沈氏掌权人"],
      ["核心", "克制 · 责任 · 秘密"],
    ],
    sections: [
      {
        kicker: "LIFE TRACK",
        title: "完美轨道的裂缝",
        body: "学业、婚姻、事业都曾按家族期待精确前进。与谢韫之相爱、结婚并育有沈睿，本应是他人生中最温暖的一段，却在妹妹沈疏妍的设计下彻底崩塌。",
      },
      {
        kicker: "SECRET",
        title: "不能公开的血缘",
        body: "沈晴在公开身份上是他的外甥女，真实身份却是他的亲生女儿。这个秘密只有沈知衡与沈疏妍知晓，也是整张卡最重要的矛盾发动机。",
      },
      {
        kicker: "HOUSEHOLD",
        title: "冰封的家庭",
        body: "谢韫之与他维持名存实亡的婚姻；沈睿得到他全部的父爱；沈疏妍是愧疚与憎恨的源头。每个人都在同一座房子里维护表面的秩序。",
      },
      {
        kicker: "BOUNDARY",
        title: "角色底线",
        body: "他沉稳、克制且尊重沈晴的选择，不会囚禁、物化或以疯狂占有替代感情。关系推进来自漫长的改观、责任冲突与被压抑的情感，而不是突然失控。",
      },
    ],
    images: [
      "https://i.postimg.cc/qMjWr19x/szhback.jpg",
      "https://i.postimg.cc/qq16bzkC/szh_tx.png",
      "https://img.zcool.cn/community/01d9945be12284a80121ab5d873134.jpg@1280w_1l_2o_100sh.jpg",
    ],
    palette: ["#0d1721", "#8fb5cf", "#e7f3fa", "143,181,207"],
    variant: "archive",
  },
  闵熙彻: {
    name: "闵熙彻",
    eyebrow: "2033 · BEIJING SOCIAL INDEX",
    subtitle: "京大戏剧学院模特系｜网红",
    quote: "“公开关系太麻烦。你在我身边，不就够了？”",
    facts: [
      ["年龄", "20"],
      ["生日", "11月18日"],
      ["现状", "地下恋爱半年"],
      ["变量", "徐栀回国"],
    ],
    sections: [
      {
        kicker: "BACKGROUND",
        title: "永远有人兜底",
        body: "房地产商父亲长期缺席，富家出身的母亲无条件溺爱。童年每一次闯祸都由金钱收场，使他逐渐把规则、承诺和后果都看得很轻。",
      },
      {
        kicker: "CURRENT",
        title: "没有公开的恋爱",
        body: "他接受了予昼的表白，也享受这段关系，却只把它定义为轻松的陪伴与亲密，从未认真想过未来。关系是否能越过‘玩玩而已’，取决于长期互动。",
      },
      {
        kicker: "RETURN",
        title: "青梅归来",
        body: "十五岁出国的徐栀重新出现。机场拥抱视频迅速走红，过去未被定义的暧昧与现在未被公开的恋爱正面相撞。",
      },
      {
        kicker: "INNER CIRCLE",
        title: "赫遇 · 方颂意 · 徐栀",
        body: "赫遇是最懂他玩乐本性的死党；方颂意嘴毒但护短；徐栀熟悉他的所有软肋。三条关系共同推动舆论、嫉妒与选择。",
      },
    ],
    images: [
      "https://free.picui.cn/free/2026/01/11/6963279c94ddd.jpg",
      "https://free.picui.cn/free/2026/01/11/6963279d763f4.jpg",
      "https://free.picui.cn/free/2026/04/12/69db8028c9a5a.jpg",
    ],
    palette: ["#071814", "#72e1b4", "#e9fff6", "114,225,180"],
    variant: "social",
  },
  公仪晢: {
    name: "公仪晢",
    eyebrow: "承安四年 · 帝王卷",
    subtitle: "大殷承安帝｜从冷宫到九五之尊",
    quote: "“朕来接你回家。”",
    facts: [
      ["年龄", "26"],
      ["年号", "承安"],
      ["佩刃", "霜魄"],
      ["此役", "金帐城"],
    ],
    sections: [
      {
        kicker: "寒露殿",
        title: "冷宫遗子",
        body: "母亲沈婉棠死前只留下一个嘱托：护住魏青。贫寒、克扣与宫廷倾轧教会他忍耐，也教会他把每一次温柔都藏进不容置疑的安排里。",
      },
      {
        kicker: "承安元年",
        title: "一夜登极",
        body: "景桓帝病重、诸皇子相争，他借禁军内乱完成宫变。帝位来得血腥，常镇北的兵权、空虚的国库与北境压力却没有随登基消失。",
      },
      {
        kicker: "四年空白",
        title: "被截断的信",
        body: "他曾许诺三个月内迎回魏青，却用了四年才收拢兵权。四年间所有信件都被赫连旸截获，伪造的绝情信让两个人对同一段往事拥有完全不同的真相。",
      },
      {
        kicker: "今夜",
        title: "金帐城重逢",
        body: "三万精兵奔袭王庭，赫连旸被押到马前。公仪晢终于抵达，却必须面对最难的一件事：他能攻下一座城，却不能命令魏青原谅。",
      },
    ],
    palette: ["#1c1009", "#c6a15c", "#fff0c8", "198,161,92"],
    variant: "scroll",
  },
  喻承砚: {
    name: "喻承砚",
    eyebrow: "承远集团 · 非公开关系卷宗",
    subtitle: "承远集团总裁｜完美男友的另一面",
    quote: "“我爱你。”——这句话是真的，但从来不是全部。",
    facts: [
      ["年龄", "31"],
      ["身高", "189 CM"],
      ["婚龄", "7年"],
      ["秘密关系", "3年"],
    ],
    sections: [
      {
        kicker: "PUBLIC LIFE",
        title: "稳固的婚姻",
        body: "妻子叶清婷家世、能力与公众形象都与他相配，儿子喻星然维系着完整家庭。他享受这段婚姻带来的感情与利益，也绝不会轻易离婚。",
      },
      {
        kicker: "PRIVATE LIFE",
        title: "被隐藏的三年",
        body: "对玩家而言，他几乎是完美男友：随叫随到、记得纪念日、托举事业，也愿意说爱。唯一没有主动说明的是，他早已有妻儿。",
      },
      {
        kicker: "POWER MAP",
        title: "喻家与唐家",
        body: "财富、政界关系与家族纵容构成他的安全网。祖父喻正邦、父亲喻鸿升、母亲唐婉清都默认并保护他的选择。",
      },
      {
        kicker: "GAME CORE",
        title: "爱不等于选择",
        body: "这张卡的核心不是让他迅速为玩家抛弃一切，而是逼问一个更尖锐的问题：一个人可以同时给予真实的宠爱、持续的欺骗和永不兑现的未来吗？",
      },
    ],
    palette: ["#080f1c", "#7bbbe6", "#e7f5ff", "123,187,230"],
    variant: "casebook",
  },
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildProfileTheater(config: TheaterConfig): string {
  const [base, accent, paper, rgb] = config.palette;
  const hasImages = Boolean(config.images?.length);
  const hero = hasImages
    ? `<div class="brief-visual"><img class="brief-main" src="${config.images?.[0]}" alt="${config.name}"><div class="brief-thumbs">${config.images
        ?.slice(1)
        .map(
          (url, index) =>
            `<button type="button" data-image="${url}" aria-label="切换图片 ${index + 2}"><img src="${url}" alt=""></button>`,
        )
        .join("")}</div></div>`
    : `<div class="brief-seal" aria-hidden="true"><span>${config.name.slice(-1)}</span><i></i></div>`;
  return `<artifact>
<style>
:root{color-scheme:dark;--brief-base:${base};--brief-accent:${accent};--brief-paper:${paper};--brief-rgb:${rgb}}*{box-sizing:border-box}html,body{margin:0;background:transparent;color:rgba(249,247,242,.9);font-family:"Noto Serif SC","Source Han Serif SC","Songti SC",serif}.brief{position:relative;isolation:isolate;width:100%;min-height:650px;overflow:hidden;border:1px solid rgba(var(--brief-rgb),.28);background:radial-gradient(circle at 82% 0%,rgba(var(--brief-rgb),.2),transparent 38%),linear-gradient(152deg,var(--brief-base),#07090d 72%);box-shadow:0 28px 90px rgba(0,0,0,.4)}.brief:before{content:"";position:absolute;inset:0;z-index:-1;opacity:.11;background:repeating-linear-gradient(0deg,transparent 0 3px,rgba(255,255,255,.08) 4px)}.brief-head{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(230px,.7fr);gap:clamp(20px,4vw,48px);align-items:end;padding:clamp(24px,5vw,56px);border-bottom:1px solid rgba(var(--brief-rgb),.2)}.brief-kicker{margin-bottom:12px;color:var(--brief-accent);font:600 10px/1.5 ui-monospace,SFMono-Regular,monospace;letter-spacing:.22em}.brief h1{margin:0;color:var(--brief-paper);font-size:clamp(34px,7vw,72px);font-weight:500;line-height:1;letter-spacing:.12em}.brief-sub{margin-top:13px;color:rgba(255,255,255,.58);font-size:13px;letter-spacing:.12em}.brief-quote{max-width:620px;margin:25px 0 0;padding-left:14px;border-left:1px solid var(--brief-accent);color:rgba(255,255,255,.78);font-size:14px;line-height:1.85}.brief-visual{position:relative;min-height:250px;overflow:hidden;background:#111}.brief-main{display:block;width:100%;height:310px;object-fit:cover;object-position:center 22%;filter:saturate(.72) contrast(1.06) brightness(.78);transition:opacity .25s ease}.brief-thumbs{position:absolute;right:10px;bottom:10px;display:flex;gap:7px}.brief-thumbs button{width:43px;height:55px;padding:0;overflow:hidden;border:1px solid rgba(255,255,255,.42);background:#111;cursor:pointer;opacity:.68;transition:.2s}.brief-thumbs button:hover{opacity:1;transform:translateY(-2px)}.brief-thumbs img{width:100%;height:100%;object-fit:cover}.brief-seal{justify-self:end;position:relative;width:210px;height:210px;display:grid;place-items:center;border:1px solid rgba(var(--brief-rgb),.34);transform:rotate(4deg)}.brief-seal:before,.brief-seal:after{content:"";position:absolute;inset:15px;border:1px solid rgba(var(--brief-rgb),.2)}.brief-seal:after{inset:28px;border-radius:50%}.brief-seal span{color:var(--brief-accent);font-size:82px;font-weight:300}.brief-seal i{position:absolute;right:-18px;bottom:20px;width:70px;height:1px;background:var(--brief-accent)}.brief-facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:rgba(var(--brief-rgb),.18);border-bottom:1px solid rgba(var(--brief-rgb),.18)}.brief-fact{padding:17px clamp(12px,3vw,28px);background:rgba(4,6,9,.8)}.brief-fact b{display:block;margin-bottom:6px;color:var(--brief-accent);font:600 9px/1 ui-monospace,monospace;letter-spacing:.18em}.brief-fact span{font-size:12px;line-height:1.5}.brief-tabs{display:flex;gap:4px;padding:22px clamp(18px,4vw,44px) 0;overflow-x:auto}.brief-tabs button{flex:0 0 auto;padding:8px 14px;border:0;border-bottom:1px solid transparent;background:transparent;color:rgba(255,255,255,.42);font:600 11px/1.3 inherit;letter-spacing:.09em;cursor:pointer}.brief-tabs button.active{border-color:var(--brief-accent);color:var(--brief-paper)}.brief-panels{padding:22px clamp(22px,5vw,56px) clamp(30px,6vw,64px)}.brief-panel{display:none;grid-template-columns:115px 1fr;gap:clamp(18px,4vw,48px);animation:brief-in .35s ease}.brief-panel.active{display:grid}.brief-panel-kicker{color:var(--brief-accent);font:600 9px/1.6 ui-monospace,monospace;letter-spacing:.18em}.brief-panel h2{margin:0 0 12px;color:var(--brief-paper);font-size:clamp(20px,4vw,31px);font-weight:500;letter-spacing:.07em}.brief-panel p{max-width:720px;margin:0;color:rgba(255,255,255,.7);font-size:14px;line-height:2}.brief[data-variant="scroll"]{--brief-base:#1c1009}.brief[data-variant="scroll"] .brief-head,.brief[data-variant="scroll"] .brief-facts{border-color:rgba(var(--brief-rgb),.32)}.brief[data-variant="social"] .brief-visual{clip-path:polygon(7% 0,100% 0,100% 92%,0 100%,0 8%)}.brief[data-variant="casebook"] .brief-panel-kicker,.brief[data-variant="archive"] .brief-panel-kicker{writing-mode:vertical-rl}.brief-foot{position:absolute;right:18px;bottom:11px;color:rgba(255,255,255,.22);font:500 8px/1 ui-monospace,monospace;letter-spacing:.18em}@keyframes brief-in{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}@media(max-width:700px){.brief-head{grid-template-columns:1fr;align-items:start}.brief-visual{order:-1}.brief-seal{justify-self:start;width:150px;height:150px}.brief-facts{grid-template-columns:repeat(2,minmax(0,1fr))}.brief-panel{grid-template-columns:1fr}.brief-panel-kicker{writing-mode:initial!important}.brief h1{font-size:42px}}
</style>
<article class="brief" data-variant="${config.variant}"><header class="brief-head"><div><div class="brief-kicker">${escapeHtml(config.eyebrow)}</div><h1>${escapeHtml(config.name)}</h1><div class="brief-sub">${escapeHtml(config.subtitle)}</div><p class="brief-quote">${escapeHtml(config.quote)}</p></div>${hero}</header><section class="brief-facts">${config.facts.map(([label, value]) => `<div class="brief-fact"><b>${escapeHtml(label)}</b><span>${escapeHtml(value)}</span></div>`).join("")}</section><nav class="brief-tabs">${config.sections.map((section, index) => `<button type="button" class="${index === 0 ? "active" : ""}" data-panel="${index}">${escapeHtml(section.title)}</button>`).join("")}</nav><div class="brief-panels">${config.sections.map((section, index) => `<section class="brief-panel ${index === 0 ? "active" : ""}" data-panel="${index}"><div class="brief-panel-kicker">${escapeHtml(section.kicker)}</div><div><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.body)}</p></div></section>`).join("")}</div><div class="brief-foot">CHARACTER BRIEF · SOURCE ADAPTED</div></article>
<script>(()=>{const root=document.currentScript?.previousElementSibling;if(!root)return;const buttons=[...root.querySelectorAll('.brief-tabs button')],panels=[...root.querySelectorAll('.brief-panel')];buttons.forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.panel;buttons.forEach(item=>item.classList.toggle('active',item===button));panels.forEach(panel=>panel.classList.toggle('active',panel.dataset.panel===key))}));const main=root.querySelector('.brief-main');root.querySelectorAll('[data-image]').forEach(button=>button.addEventListener('click',()=>{if(main){main.style.opacity='0';setTimeout(()=>{main.src=button.dataset.image;main.style.opacity='1'},160)}}))})();</script>
</artifact>`;
}

async function curl(url: string) {
  const executable = process.platform === "win32" ? "curl.exe" : "curl";
  const child = Bun.spawn([executable, "-L", "--max-time", "40", url], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const html = await new Response(child.stdout).text();
  if ((await child.exited) !== 0 || html.length < 1000) {
    throw new Error(`Unable to fetch ${url}`);
  }
  return html;
}

async function buildZhaoOriginalTheater() {
  const url =
    "https://rubii.ai/chat/%E8%B5%B5%E6%BC%B3%E5%B9%B3__6a782eaf299669db076d72b2";
  const document = new JSDOM(await curl(url)).window.document;
  const selectors = [
    ".Miki-cen-rain-wrap",
    ".Miki-minshi-wrap",
    ".Miki-profile-wrap",
    ".Miki-acc-wrap",
    ".Miki-author-card",
  ];
  const roots = selectors.map((selector) => document.querySelector(selector));
  if (roots.some((root) => !root)) {
    throw new Error("赵漳平公开页的小剧场结构不完整");
  }
  const styles = [...document.querySelectorAll("style")]
    .map((style) => style.textContent ?? "")
    .filter((css) => css.includes("Miki-"));
  if (styles.length < 5) {
    throw new Error("赵漳平公开页的小剧场样式不完整");
  }
  const scope = `.zhao-original-brief{width:100%;overflow:hidden;background:#f1eadc;color:#201c18;padding:clamp(12px,3vw,28px)}.zhao-original-brief>*{max-width:100%}.zhao-original-source{margin:12px 0 0;text-align:right;color:#766b5c;font:500 9px/1.4 ui-monospace,monospace;letter-spacing:.12em}`;
  return `<artifact><style>${scope}\n${styles.join("\n")}</style><div class="zhao-original-brief">${roots.map((root) => root?.outerHTML).join("\n")}<div class="zhao-original-source">RUBII ORIGINAL BRIEF · MIGRATED TO DEARM</div></div></artifact>`;
}

function extractSection(prompt: string, tag: string) {
  const close = `</${tag}>`;
  const closeIndex = prompt.indexOf(close);
  const open = `<${tag}>`;
  const openIndex = prompt.lastIndexOf(open, closeIndex);
  if (openIndex < 0 || closeIndex < openIndex) {
    throw new Error(`Missing <${tag}>`);
  }
  return prompt.slice(openIndex + open.length, closeIndex).trim();
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function argumentValue(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  if (process.argv.includes("--commit")) {
    throw new Error(
      "RETIRED: this script builds source-derived profile theaters rather than restoring original Mufy codeRenderContent. Commit mode is intentionally disabled.",
    );
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const commit = process.argv.includes("--commit");
  const inputPath = resolve(
    argumentValue("--input") ?? "selected_character_prompts(1).json",
  );
  const reportPath = resolve(
    argumentValue("--report") ??
      "logs/card-imports/mufy-selected-20260824/theater-rebuild.json",
  );
  const source = JSON.parse(await readFile(inputPath, "utf8"));
  const prompts = new Map<string, string>(
    source.characters
      .filter((record: { found: boolean }) => record.found)
      .map((record: { character_name: string; prompt: string }) => [
        record.character_name,
        record.prompt,
      ]),
  );
  const theaters = new Map<CardName, string>();
  for (const name of NAMES) {
    theaters.set(
      name,
      name === "赵漳平"
        ? await buildZhaoOriginalTheater()
        : buildProfileTheater(THEATERS[name]),
    );
  }
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    const rows = await sql<
      Array<{
        id: string;
        name: CardName;
        opening: string;
        pack_id: string;
      }>
    >`
      select c.id,c.name,c.opening,p.id pack_id
      from characters c
      join character_pack_subscriptions s on s.character_id=c.id
      join beautification_packs p on p.id=s.pack_id
      where c.owner_id=(select id from users where lower(email)=lower(${OWNER_EMAIL}))
        and c.id in ${sql(Object.values(IDS))}
      order by c.name
    `;
    if (rows.length !== NAMES.length) {
      throw new Error(`Expected ${NAMES.length} cards, got ${rows.length}`);
    }
    const changes = await Promise.all(
      rows.map(async (row) => {
        const sourcePrompt = prompts.get(row.name);
        if (!sourcePrompt) throw new Error(`Missing source for ${row.name}`);
        const sourceOpening = extractSection(sourcePrompt, "Greeting");
        if (
          (await sha256(row.opening.trim())) !== (await sha256(sourceOpening))
        ) {
          throw new Error(
            `${row.name}: database opening differs from source Greeting`,
          );
        }
        const theater = theaters.get(row.name);
        if (!theater) throw new Error(`${row.name}: theater was not generated`);
        if (
          theater.includes(sourceOpening.slice(0, 180)) ||
          theater.includes("IMAGE PLACEHOLDER")
        ) {
          throw new Error(
            `${row.name}: theater contains opening or placeholder`,
          );
        }
        return {
          ...row,
          theater,
          theaterHash: await sha256(theater),
          openingHash: await sha256(row.opening.trim()),
        };
      }),
    );
    if (commit) {
      await sql.begin(async (tx) => {
        for (const change of changes) {
          await tx`
            delete from opening_components
            where pack_id=${change.pack_id}
              and name in ('原卡演绎室','原卡小剧场','角色小剧场')
          `;
          await tx`
            insert into opening_components(pack_id,name,content,enabled,order_index)
            values(${change.pack_id},'原卡小剧场',${change.theater},true,0)
          `;
          const media = MEDIA[change.name];
          if (media) {
            await tx`
              update characters set avatar_url=${media.avatar},cover_image_url=${media.cover},updated_at=now()
              where id=${change.id}
            `;
          }
        }
      });
    }
    const report = {
      version: 4,
      mode: commit ? "commit" : "dry-run",
      generatedAt: new Date().toISOString(),
      scope: "TEST SERVER ONLY",
      mapping: {
        opening: "characters.opening <- Mufy Greeting",
        theater:
          "opening_components/原卡小剧场 <- Mufy Brief or source-derived profile",
      },
      cards: changes.map((change) => ({
        name: change.name,
        id: change.id,
        openingLength: change.opening.length,
        openingHash: change.openingHash,
        theaterLength: change.theater.length,
        theaterHash: change.theaterHash,
        theaterSource:
          change.name === "赵漳平"
            ? "Rubii public original Miki Brief HTML/CSS"
            : change.name === "陆永琛"
              ? "Rubii public Brief + source Prompt media/facts"
              : "selected prompt CharaPrompt facts/media",
        mediaUpdated: Boolean(MEDIA[change.name]),
      })),
    };
    if (commit) {
      await mkdir(dirname(reportPath), { recursive: true });
      await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    }
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
