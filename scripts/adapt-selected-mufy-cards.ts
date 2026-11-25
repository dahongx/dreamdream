#!/usr/bin/env bun

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
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

const MEDIA: Record<
  (typeof NAMES)[number],
  { avatar: string; cover: string; provenance: string }
> = {
  陆永琛: {
    avatar:
      "https://cdn.rubii.ai/cdn-cgi/image/width%3D3840%2Cquality%3D80%2Cformat%3Dauto/https%3A//cdn.rubii.ai/public/character/chara_68135c7c27d387c21b86b7fc.webp",
    cover:
      "https://cdn.rubii.ai/cdn-cgi/image/width%3D3840%2Cquality%3D80%2Cformat%3Dauto/https%3A//cdn.rubii.ai/public/character/chara_68135c7c27d387c21b86b7fc.webp",
    provenance: "Rubii 上同名、同简介、同作者迁移卡公开主图",
  },
  沈知衡: {
    avatar: "https://i.postimg.cc/qq16bzkC/szh_tx.png",
    cover: "https://i.postimg.cc/qMjWr19x/szhback.jpg",
    provenance: "本次源提示词明确标注的沈知衡头像与朋友圈封面",
  },
  闵熙彻: {
    avatar: placeholder("闵", "101014", "b8ffda"),
    cover: placeholder("闵熙彻", "101014", "77f2c4", true),
    provenance: "源提示词只有表情包素材，无角色主图；暂用显式占位图",
  },
  公仪晢: {
    avatar: placeholder("晢", "160f0b", "d7b56d"),
    cover: placeholder("公仪晢", "160f0b", "d7b56d", true),
    provenance: "源提示词无图片 URL；暂用显式占位图",
  },
  喻承砚: {
    avatar: placeholder("喻", "090d1a", "7ec8ff"),
    cover: placeholder("喻承砚", "090d1a", "a9dcff", true),
    provenance: "源提示词无图片 URL；暂用显式占位图",
  },
  赵漳平: {
    avatar:
      "https://cdn.rubii.ai/cdn-cgi/image/width%3D3840%2Cquality%3D80%2Cformat%3Dauto/https%3A//cdn.rubii.ai/public/180c7aa1-78b4-4435-96e3-bb74a471cef8/image/20260809073423_5ba198.jpg",
    cover:
      "https://cdn.rubii.ai/cdn-cgi/image/width%3D3840%2Cquality%3D80%2Cformat%3Dauto/https%3A//cdn.rubii.ai/public/180c7aa1-78b4-4435-96e3-bb74a471cef8/image/20260809073423_5ba198.jpg",
    provenance: "Rubii 上同名迁移卡公开主图",
  },
};

const THEMES: Record<(typeof NAMES)[number], [string, string, string]> = {
  陆永琛: ["#b78b55", "#f1dfc4", "45,32,25"],
  沈知衡: ["#b8d7ef", "#edf7ff", "19,32,48"],
  闵熙彻: ["#76e5bb", "#eafff7", "8,23,20"],
  公仪晢: ["#d6b56f", "#fff2cd", "31,20,12"],
  喻承砚: ["#78bdf2", "#e9f6ff", "8,14,30"],
  赵漳平: ["#cfb477", "#fff4d9", "33,27,20"],
};

function placeholder(
  label: string,
  background: string,
  foreground: string,
  wide = false,
): string {
  const width = wide ? 1200 : 512;
  const height = wide ? 630 : 512;
  const fontSize = wide ? 112 : 190;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><radialGradient id="g" cx="30%" cy="20%"><stop stop-color="#${foreground}" stop-opacity=".18"/><stop offset="1" stop-color="#${background}"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><path d="M0 ${height * 0.8} Q ${width * 0.45} ${height * 0.55} ${width} ${height * 0.76} V ${height} H0Z" fill="#${foreground}" opacity=".06"/><text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" fill="#${foreground}" font-family="serif" font-size="${fontSize}" letter-spacing="12">${label}</text><text x="50%" y="82%" text-anchor="middle" fill="#${foreground}" opacity=".55" font-family="sans-serif" font-size="22" letter-spacing="8">IMAGE PLACEHOLDER</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function extractStyleBlocks(prompt: string): string {
  return [...prompt.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean)
    .join("\n\n");
}

function extractSection(prompt: string, tag: string): string {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const closeIndex = prompt.indexOf(close);
  const openIndex = prompt.lastIndexOf(open, closeIndex);
  if (openIndex < 0 || closeIndex < openIndex) {
    throw new Error(`Missing or malformed <${tag}> section`);
  }
  return prompt.slice(openIndex + open.length, closeIndex).trim();
}

function buildOpeningComponent(
  name: (typeof NAMES)[number],
  prompt: string,
): string {
  const [accent, bright, rgb] = THEMES[name];
  const greeting = extractSection(prompt, "Greeting")
    .replace(/<\/?(?:侧边栏指令区|侧边栏播放器)>/g, "")
    .replace(/```(?:html)?/gi, "")
    .trim();
  const cover = MEDIA[name].cover;
  const sourceCss = extractStyleBlocks(prompt);
  return `<artifact>
<style>
:root{--accent:${accent};--bright:${bright};--theme-rgb:${rgb};color-scheme:dark}*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:transparent;color:rgba(249,247,243,.94);font-family:"Noto Serif SC","Source Han Serif SC","Songti SC",serif}body{background:radial-gradient(circle at 18% 0%,rgba(var(--theme-rgb),.48),transparent 42%),linear-gradient(165deg,#0b0c10 0%,rgba(var(--theme-rgb),.82) 52%,#090a0d 100%)}
.mufy-prompt-reel{position:relative;width:100%;min-height:720px;overflow:hidden;border:1px solid color-mix(in srgb,var(--accent) 38%,transparent);box-shadow:0 28px 80px rgba(0,0,0,.42)}.mufy-reel-cover{position:relative;height:clamp(240px,52vw,460px);overflow:hidden;background:#101116}.mufy-reel-cover img{width:100%;height:100%;object-fit:cover;object-position:center 24%;filter:saturate(.78) contrast(1.05) brightness(.72)}.mufy-reel-cover:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 28%,rgba(8,9,12,.25) 58%,rgba(var(--theme-rgb),.94) 100%)}
.mufy-reel-name{position:absolute;left:clamp(20px,6vw,56px);bottom:24px;z-index:2;color:var(--bright);font-size:13px;font-weight:500;letter-spacing:.32em;text-shadow:0 3px 20px rgba(0,0,0,.72)}
.mufy-reel-body{position:relative;padding:clamp(22px,5vw,50px);font-size:clamp(14px,2.7vw,17px);line-height:2;letter-spacing:.035em}.mufy-reel-body>p{margin:0 0 1.25em}.mufy-reel-body hr{height:1px;margin:18px 0;border:0;background:linear-gradient(90deg,transparent,var(--accent),transparent);opacity:.55}.mufy-reel-body message,.mufy-reel-body narration,.mufy-reel-body .c,.mufy-reel-body .szh,.mufy-reel-body .mxc{display:block;margin:1.15em 0;padding-left:1em;border-left:2px solid var(--accent);color:var(--bright);font-weight:600}
.sj-ethereal-bar,.status-bar-container,.cen-v2-wrap,.censy-hyper-chronos,.mufy-wg-topbar{position:relative;width:100%;margin:0 0 24px;padding:13px 16px;border:1px solid color-mix(in srgb,var(--accent) 32%,transparent);border-radius:3px;background:linear-gradient(135deg,rgba(var(--theme-rgb),.72),rgba(5,6,8,.64));box-shadow:0 12px 34px rgba(0,0,0,.2);backdrop-filter:blur(14px)}.sj-time-capsule,.date-display,.time-display,.cen-v2-time-box,.censy-hc-label{color:var(--accent);font:600 10px/1.5 ui-monospace,SFMono-Regular,monospace;letter-spacing:.18em}.sj-info-track,.status-panel,.cen-v2-core{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 16px}
.zt-box,.fold-item,.tech-details,.censy-sys-details,.mufy-reel-body details{margin:14px 0;border:1px solid color-mix(in srgb,var(--accent) 24%,transparent);border-radius:3px;background:rgba(3,4,6,.24);overflow:hidden}.zt-box summary,.fold-item summary,.tech-details summary,.censy-sys-details summary,.mufy-reel-body details>summary{padding:12px 15px;cursor:pointer;color:var(--accent);font-size:12px;font-weight:650;letter-spacing:.12em;list-style:none;background:rgba(var(--theme-rgb),.25)}.zt-content,.fold-content,.tech-content,.censy-sys-body,.mufy-reel-body details>div{padding:14px 16px;color:rgba(249,247,243,.82);font-size:13px;line-height:1.8}.mufy-reel-body img{max-width:100%;height:auto;border-radius:3px}@media(max-width:600px){.mufy-prompt-reel{min-height:620px}.sj-info-track,.status-panel,.cen-v2-core{align-items:flex-start;flex-direction:column}}
${sourceCss}
</style>
<article class="mufy-prompt-reel"><header class="mufy-reel-cover"><img src="${cover}" alt="${name}"><div class="mufy-reel-name">${name}</div></header><section class="mufy-reel-body">${greeting}</section></article>
</artifact>`;
}

type FloatingComponentSpec = {
  name: string;
  content: string;
  orderIndex: number;
};

function dynamicIsland(name: (typeof NAMES)[number], subtitle: string): string {
  const [accent, bright, rgb] = THEMES[name];
  return `<floating pos="top-center" interactive="true">
<style>
*{box-sizing:border-box}html,body{margin:0;background:transparent;color:${bright};font-family:"Noto Serif SC","Songti SC",serif}.island-container{width:176px;height:38px;margin:0 auto;overflow:hidden;border:1px solid rgba(${rgb},.48);border-radius:999px;background:linear-gradient(145deg,rgba(8,9,12,.92),rgba(${rgb},.76));box-shadow:0 10px 30px rgba(0,0,0,.32),inset 0 1px rgba(255,255,255,.08);backdrop-filter:blur(16px);transition:width .38s ease,height .38s ease,border-radius .38s ease;cursor:pointer}.island-container.expanded{width:310px;height:196px;border-radius:20px}.island-mini{height:38px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;font:600 10px/1 ui-monospace,monospace;letter-spacing:.12em}.island-dot{width:6px;height:6px;border-radius:50%;background:${accent};box-shadow:0 0 10px ${accent};animation:pulse 1.8s infinite}.island-panel{padding:2px 17px 16px;opacity:0;transform:translateY(8px);transition:.25s}.expanded .island-panel{opacity:1;transform:none}.island-title{font-size:17px;letter-spacing:.12em;margin:8px 0 3px}.island-sub{font-size:11px;color:rgba(255,255,255,.58);margin-bottom:18px}.track{display:grid;grid-template-columns:44px 1fr;gap:12px;align-items:center}.disc{width:44px;height:44px;border-radius:50%;border:1px solid rgba(${rgb},.5);background:radial-gradient(circle,#101116 0 15%,${accent} 16% 18%,#15161a 19% 52%,rgba(${rgb},.8) 53%);animation:spin 7s linear infinite;animation-play-state:paused}.playing .disc{animation-play-state:running}.track-name{font-size:12px}.track-note{font-size:10px;color:rgba(255,255,255,.5);margin-top:3px}.controls{display:flex;align-items:center;gap:14px;margin-top:15px}.play{width:32px;height:32px;border:1px solid rgba(${rgb},.55);border-radius:50%;background:rgba(${rgb},.28);color:${bright};cursor:pointer}.line{flex:1;height:2px;background:rgba(255,255,255,.15)}.line:after{content:"";display:block;width:37%;height:100%;background:${accent};box-shadow:0 0 8px ${accent}}@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{50%{opacity:.35;transform:scale(.72)}}
</style>
<div class="island-container" id="island"><div class="island-mini"><span>${name}</span><span class="island-dot"></span></div><div class="island-panel"><div class="island-title">${name}</div><div class="island-sub">${subtitle}</div><div class="track"><div class="disc"></div><div><div class="track-name">场景原声</div><div class="track-note">点击播放 / 暂停</div></div></div><div class="controls"><button class="play" type="button">▷</button><div class="line"></div></div></div></div>
<script>(function(){var root=document.getElementById('island'),btn=root.querySelector('.play');root.addEventListener('click',function(e){if(e.target===btn)return;root.classList.toggle('expanded')});btn.addEventListener('click',function(e){e.stopPropagation();root.classList.toggle('playing');btn.textContent=root.classList.contains('playing')?'Ⅱ':'▷'});})();</script>
</floating>`;
}

function commandSidebar(
  name: (typeof NAMES)[number],
  sections: Array<{ title: string; body: string }>,
): string {
  const [accent, bright, rgb] = THEMES[name];
  return `<style>
*{box-sizing:border-box}html,body{margin:0;background:transparent;color:${bright};font-family:"Noto Serif SC","Songti SC",serif}.censy-blue-glass-sidebar{position:relative;width:316px;margin-left:auto;border:1px solid rgba(${rgb},.5);border-radius:18px 0 0 18px;background:linear-gradient(145deg,rgba(8,10,14,.96),rgba(${rgb},.86));box-shadow:-18px 18px 48px rgba(0,0,0,.35);backdrop-filter:blur(18px);overflow:hidden}.censy-blue-glass-sidebar>summary{position:absolute;right:100%;top:52px;width:42px;height:96px;display:grid;place-items:center;padding:8px 0;border:1px solid rgba(${rgb},.5);border-right:0;border-radius:14px 0 0 14px;background:rgba(${rgb},.9);color:${bright};font:600 10px/1.3 ui-monospace,monospace;letter-spacing:.14em;writing-mode:vertical-rl;cursor:pointer;list-style:none}.censy-blue-glass-sidebar>summary::-webkit-details-marker{display:none}.side-head{padding:21px 20px 14px;border-bottom:1px solid rgba(255,255,255,.08)}.side-kicker{font:600 9px/1 ui-monospace,monospace;color:${accent};letter-spacing:.2em}.side-name{margin-top:7px;font-size:20px;letter-spacing:.14em}.side-tabs{display:flex;gap:6px;padding:12px 14px 0}.censy-tab-btn{flex:1;padding:7px 4px;border:1px solid transparent;border-radius:999px;background:transparent;color:rgba(255,255,255,.5);font-size:11px;cursor:pointer}.censy-tab-btn.active{border-color:rgba(${rgb},.5);background:rgba(${rgb},.24);color:${bright}}.censy-tab-content{display:none;max-height:270px;overflow:auto;padding:14px 17px 19px}.censy-tab-content.active{display:block}.side-card{padding:11px 12px;margin-bottom:9px;border-left:2px solid ${accent};background:rgba(255,255,255,.045);font-size:12px;line-height:1.75}.side-card b{display:block;margin-bottom:3px;color:${accent};font-size:10px;letter-spacing:.1em}.side-action{width:100%;margin-top:5px;padding:9px 10px;border:1px solid rgba(${rgb},.45);border-radius:10px;background:rgba(${rgb},.24);color:${bright};font-size:11px;cursor:pointer}
</style><template id="censy-side-template"><details class="censy-blue-glass-sidebar"><summary>MENU</summary><header class="side-head"><div class="side-kicker">DEARM · CHARACTER DESK</div><div class="side-name">${name}</div></header><nav class="side-tabs">${sections.map((section, index) => `<button type="button" class="censy-tab-btn${index === 0 ? " active" : ""}" data-tab="side-${index}">${section.title}</button>`).join("")}</nav>${sections.map((section, index) => `<section id="censy-tab-side-${index}" class="censy-tab-content${index === 0 ? " active" : ""}"><div class="side-card">${section.body}</div><button class="side-action" type="button" data-fill="${section.title}">写入“${section.title}”指令</button></section>`).join("")}</details></template><script>(function(){var t=document.getElementById('censy-side-template');document.body.appendChild(t.content.cloneNode(true));document.addEventListener('click',function(e){var b=e.target.closest('.censy-tab-btn');if(b){document.querySelectorAll('.censy-tab-btn').forEach(function(x){x.classList.remove('active')});document.querySelectorAll('.censy-tab-content').forEach(function(x){x.classList.remove('active')});b.classList.add('active');var panel=document.getElementById('censy-tab-'+b.dataset.tab);if(panel)panel.classList.add('active')}var a=e.target.closest('.side-action');if(a&&window.host&&host.fillComposer)host.fillComposer('$'+a.dataset.fill+'：')} )})();</script>`;
}

function floatingComponentsFor(
  name: (typeof NAMES)[number],
): FloatingComponentSpec[] {
  if (name === "沈知衡") {
    return [
      {
        name: "统一灵动岛播放器",
        content: dynamicIsland(name, "冬夜重逢 · 场景声轨"),
        orderIndex: 10,
      },
      {
        name: "统一指令侧栏",
        content: commandSidebar(name, [
          {
            title: "剧情",
            body: "切换场景、推进时间，或要求角色主动展开下一段冲突。",
          },
          { title: "消息", body: "调用手机聊天、朋友圈、私信与群聊界面。" },
          { title: "记忆", body: "查看或补充长期记忆、重要关系与未完成事件。" },
        ]),
        orderIndex: 11,
      },
    ];
  }
  if (name === "公仪晢") {
    return [
      {
        name: "风金播放器",
        content: dynamicIsland(name, "宫阙风声 · 御前留声"),
        orderIndex: 10,
      },
    ];
  }
  if (name === "喻承砚") {
    return [
      {
        name: "NPC与卷宗侧栏",
        content: commandSidebar(name, [
          { title: "人物", body: "当前 NPC、关系变化、在场身份与待触发事件。" },
          {
            title: "卷宗",
            body: "短期记忆、长期记忆与案件卷宗按剧情持续更新。",
          },
          { title: "剧场", body: "群聊、私聊、论坛和隐藏剧场按触发条件展开。" },
        ]),
        orderIndex: 10,
      },
      {
        name: "Omni-Cube",
        content: dynamicIsland(name, "卷宗同步 · 关系轨道"),
        orderIndex: 11,
      },
    ];
  }
  return [];
}

function removeMufyBootstrapScripts(
  outputSetting: string | null,
): string | null {
  if (!outputSetting) return outputSetting;
  const cleaned = outputSetting.replace(
    /```html\s*\r?\n<script>[\s\S]*?(?:censy_gold_player_cache|details\.cen-npc-sidebar-left-v1|details\.censy-omnicube-v4)[\s\S]*?<\/script>\s*\r?\n```/gi,
    "",
  );
  if (cleaned === outputSetting) return outputSetting.trim() || null;
  return `${cleaned.trim()}\n\n<!-- Mufy 页面缓存唤醒脚本已迁移为 Dearm 开场悬浮组件；模型不得重复输出注入脚本。 -->`;
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function platformCss(name: (typeof NAMES)[number]): string {
  const [accent, bright, rgb] = THEMES[name];
  return `
/* Dearm adaptation for ${name}; selectors follow this card's Mufy output contract. */
:root {
  --mcard-accent: ${accent};
  --mcard-bright: ${bright};
  --mcard-rgb: ${rgb};
}
.nj_chat_body { background-image: radial-gradient(circle at 18% 4%, rgba(${rgb},.28), transparent 42%) !important; }
.nj_ai_message_bubble { position: relative !important; padding: 14px 16px !important; background: linear-gradient(145deg, rgba(${rgb},.24), rgba(8,9,12,.42)) !important; border: 1px solid color-mix(in srgb, ${accent} 24%, transparent) !important; border-left: 2px solid color-mix(in srgb, ${accent} 66%, transparent) !important; border-radius: 6px 16px 16px 16px !important; box-shadow: 0 12px 30px rgba(0,0,0,.13), inset 0 1px rgba(255,255,255,.035) !important; color: rgba(248,248,248,.94) !important; line-height: 1.85 !important; }
.nj_user_message_bubble { background: linear-gradient(145deg, rgba(${rgb},.88), rgba(${rgb},.58)) !important; border: 1px solid color-mix(in srgb, ${accent} 36%, transparent) !important; color: ${bright} !important; box-shadow: 0 8px 24px rgba(0,0,0,.16) !important; }
.nj_ai_message_bubble p, .nj_user_message_bubble p { margin-block: .42rem !important; }
.szh, .mxc { color: ${bright}; text-shadow: 0 0 18px rgba(${rgb},.35); }
.sj-ethereal-bar, .status-bar-container, .cen-v2-wrap, .censy-hyper-chronos, .mufy-wg-topbar {
  width: min(100%, 760px); box-sizing: border-box; margin: 8px auto 18px; padding: 12px 16px;
  color: ${bright}; background: linear-gradient(135deg, rgba(${rgb},.76), rgba(10,10,14,.72));
  border: 1px solid color-mix(in srgb, ${accent} 42%, transparent); border-radius: 14px;
  box-shadow: 0 14px 36px rgba(0,0,0,.2), inset 0 1px rgba(255,255,255,.06);
  backdrop-filter: blur(14px); letter-spacing: .04em;
}
.sj-time-capsule, .date-display, .time-display, .cen-v2-time-box, .censy-hc-label, .mufy-wg-topbar .row-1 { color: ${accent}; font-size: 11px; letter-spacing: .16em; }
.cen-v2-core, .status-panel { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.cen-v2-location, .location-text, .censy-hc-value { color: ${bright}; font-weight: 650; }
.cen-v2-summary, .mufy-wg-topbar .row-4 { margin-top: 8px; opacity: .72; font-family: serif; font-style: italic; }
.zt-box, .tech-accordion-group, .censy-sys-wrap, .fold-item {
  width: min(100%, 760px); margin: 16px auto 6px; color: rgba(245,245,245,.9);
  background: rgba(${rgb},.34); border: 1px solid color-mix(in srgb, ${accent} 28%, transparent);
  border-radius: 14px; overflow: hidden; box-shadow: 0 12px 30px rgba(0,0,0,.16); backdrop-filter: blur(12px);
}
.zt-box details, .tech-details, .censy-sys-details, details.fold-item { margin: 0; border: 0; background: transparent; }
.zt-box summary, .tech-summary, .censy-sys-details > summary, .fold-item > summary {
  list-style: none; cursor: pointer; padding: 11px 15px; color: ${accent}; font-weight: 650;
  letter-spacing: .08em; border-bottom: 1px solid transparent; transition: background .2s ease, color .2s ease;
}
.zt-box summary::-webkit-details-marker, .tech-summary::-webkit-details-marker, .censy-sys-details > summary::-webkit-details-marker, .fold-item > summary::-webkit-details-marker { display:none; }
.zt-box details[open] > summary, .tech-details[open] > summary, .censy-sys-details[open] > summary, details.fold-item[open] > summary { background: rgba(${rgb},.24); border-bottom-color: color-mix(in srgb, ${accent} 18%, transparent); color: ${bright}; }
.zt-content, .tech-content, .censy-sys-body, .fold-content { padding: 12px 15px 15px; line-height: 1.7; }
.content-section, .c-sys-text, .tag-box { padding: 8px 0; border-bottom: 1px dashed rgba(255,255,255,.09); }
.content-section h4 { margin: 0 0 4px; color: ${accent}; font-size: 10px; letter-spacing: .18em; }
.content-section p { margin: 0; }
.memo-frame, .c-sys-forum { margin-top: 8px; padding: 10px 12px; background: rgba(0,0,0,.16); border-left: 2px solid ${accent}; border-radius: 4px 10px 10px 4px; }
.status-tag { display: inline-flex; padding: 2px 8px; margin: 2px; border: 1px solid color-mix(in srgb, ${accent} 38%, transparent); border-radius: 999px; color: ${accent}; font-size: 10px; }
.progress-wrap-favor, .progress-wrap-arousal, .c-sys-bar-track { height: 5px; overflow: hidden; background: rgba(0,0,0,.35); border-radius: 999px; }
.progress-bar-favor, .progress-bar-arousal, .c-sys-bar-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, ${accent}, ${bright}); box-shadow: 0 0 10px ${accent}; }
.wnzl-page-wrapper, .shell, .ph { width: min(100%, 390px); margin: 18px auto; }
.wnzl-ui-phone, .phone-case, .case { position: relative; overflow: hidden; border: 1px solid color-mix(in srgb, ${accent} 34%, transparent); border-radius: 27px; background: #0b0d12; box-shadow: 0 22px 55px rgba(0,0,0,.34), inset 0 0 0 5px rgba(255,255,255,.025); }
.xsj-container, .screen, .scr { min-height: 420px; overflow: hidden; color: #1b1d22; background: linear-gradient(180deg,#f6f4f0,#e9e5de); font-family: -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif; }
.xsj-header, .header, .top, .nav { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 14px; border-bottom: 1px solid rgba(0,0,0,.07); background: rgba(255,255,255,.78); backdrop-filter: blur(12px); font-size: 12px; }
.xsj-body, .chat-viewport, .chat { padding: 14px 12px 20px; }
.xsj-msg-row, .msg-row, .msg-row-light, .r { display: flex; align-items: flex-start; gap: 8px; margin: 11px 0; }
.xsj-msg-right, .msg-row.right, .r.rr { flex-direction: row-reverse; }
.xsj-avatar, .avatar, .av { flex: 0 0 34px; width: 34px; height: 34px; overflow: hidden; border-radius: 8px; background: rgba(${rgb},.35); }
.xsj-avatar img, .avatar img, .av img { width: 100%; height: 100%; object-fit: cover; }
.xsj-msg-col { min-width: 0; max-width: 76%; }
.xsj-name-tag, .chat-name { margin: 0 4px 3px; color: #8c8c8c; font-size: 10px; }
.xsj-bubble, .chat-bubble, .bubble, .b { max-width: 78%; padding: 9px 11px; border-radius: 5px 13px 13px; background: #fff; color: #25272d; box-shadow: 0 3px 10px rgba(0,0,0,.06); font-size: 13px; line-height: 1.55; }
.xsj-msg-right .xsj-bubble, .chat-message-right .chat-bubble, .right .bubble, .rr .b { border-radius: 13px 5px 13px 13px; background: color-mix(in srgb, ${accent} 72%, #e8f7df); color: #101216; }
.xsj-card, .transfer-card, .share-card, .card { overflow: hidden; border-radius: 13px; background: #fff; box-shadow: 0 5px 16px rgba(0,0,0,.08); }
.xsj-moments-cover, .wallpaper, .bg { min-height: 150px; background: linear-gradient(145deg,rgba(${rgb},.88),#12141a); }
.xsj-footer, .input-area, .inp { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-top: 1px solid rgba(0,0,0,.07); background: rgba(255,255,255,.9); }
.xsj-footer-input, .input-box, .ib { flex: 1; min-height: 32px; padding: 7px 10px; border-radius: 8px; background: #f2f2f2; color: #999; font-size: 12px; }
.censy-stellar-os { width: min(100%,760px); margin: 16px auto 6px; color: rgba(245,245,245,.92); }
.censy-st-fold { margin: 9px 0; overflow: hidden; border: 1px solid color-mix(in srgb,${accent} 28%,transparent); border-radius: 14px; background: rgba(${rgb},.3); }
.censy-st-sum { padding: 11px 15px; list-style: none; cursor: pointer; color: ${accent}; font: 650 11px/1.5 ui-monospace,monospace; letter-spacing: .1em; }
.censy-st-content { padding: 13px 15px 16px; line-height: 1.7; }
.censy-status-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }
.censy-data-item, .censy-aff-box, .censy-theater-box { padding: 9px 10px; border: 1px solid rgba(255,255,255,.07); border-radius: 9px; background: rgba(0,0,0,.15); }
.censy-data-label, .censy-aff-header, .censy-chat-title { color: ${accent}; font-size: 10px; letter-spacing: .08em; }
.censy-aff-bar { height: 5px; margin-top: 7px; overflow: hidden; border-radius: 999px; background: rgba(0,0,0,.35); }
.censy-aff-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg,${accent},${bright}); }
.mufy-wg-container { width: 100%; }
.forum-post, .reader-comment, .censy-msg, .chat-message { margin: 8px 0; padding: 9px 11px; border-left: 2px solid color-mix(in srgb,${accent} 70%,transparent); background: rgba(255,255,255,.035); }
${Array.from({ length: 101 }, (_, value) => `.pw${value}{width:${value}%}`).join("")}
@media (max-width: 640px) {
  .sj-ethereal-bar, .status-bar-container, .cen-v2-wrap, .censy-hyper-chronos, .mufy-wg-topbar,
  .zt-box, .tech-accordion-group, .censy-sys-wrap, .fold-item { border-radius: 11px; }
  .cen-v2-core, .status-panel { align-items: flex-start; flex-direction: column; gap: 4px; }
  .censy-status-grid { grid-template-columns: 1fr; }
}
`;
}

async function main() {
  if (process.argv.includes("--commit")) {
    throw new Error(
      "RETIRED: this script synthesizes visual components from Prompt data. It must not write TEST data; import original Mufy codeRenderContent/styleCode/regexRules instead.",
    );
  }
  const commit = process.argv.includes("--commit");
  const inputPath = resolve(
    argumentValue("--input") ?? "selected_character_prompts(1).json",
  );
  const reportPath = resolve(
    argumentValue("--report") ??
      "logs/card-imports/selected-mufy-adaptation.json",
  );
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const source = JSON.parse(await readFile(inputPath, "utf8"));
  const prompts = new Map<string, string>(
    source.characters
      .filter((record: { found: boolean }) => record.found)
      .map((record: { character_name: string; prompt: string }) => [
        record.character_name,
        record.prompt,
      ]),
  );
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    const owners = await sql<{ id: string; role: string }[]>`
      select id, role from users where lower(email)=lower(${OWNER_EMAIL})
    `;
    if (owners.length !== 1 || owners[0].role !== "admin") {
      throw new Error("Expected one admin owner");
    }
    const rows = await sql<
      {
        id: string;
        name: (typeof NAMES)[number];
        visibility: string;
        avatar_url: string | null;
        cover_image_url: string | null;
        output_setting: string | null;
        pack_id: string;
        global_css: string | null;
      }[]
    >`
      select c.id,c.name,c.visibility,c.avatar_url,c.cover_image_url,c.output_setting,
             p.id pack_id,p.global_css
      from characters c
      join character_pack_subscriptions s on s.character_id=c.id
      join beautification_packs p on p.id=s.pack_id
      where c.owner_id=${owners[0].id} and c.name in ${sql([...NAMES])}
      order by c.name
    `;
    if (rows.length !== NAMES.length) {
      throw new Error(
        `Expected ${NAMES.length} character/pack rows, got ${rows.length}`,
      );
    }
    const changes = rows.map((row) => {
      const prompt = prompts.get(row.name);
      if (!prompt) throw new Error(`Missing prompt for ${row.name}`);
      const recoveredCss = extractStyleBlocks(prompt);
      const css = `${recoveredCss}\n\n${platformCss(row.name)}`.trim();
      const openingComponent = buildOpeningComponent(row.name, prompt);
      const sourceOutputSetting = extractSection(prompt, "OutputSetting");
      const outputSetting = removeMufyBootstrapScripts(sourceOutputSetting);
      const floatingComponents = floatingComponentsFor(row.name);
      return {
        name: row.name,
        characterId: row.id,
        packId: row.pack_id,
        before: {
          visibility: row.visibility,
          avatarUrl: row.avatar_url,
          coverImageUrl: row.cover_image_url,
          globalCssLength: row.global_css?.length ?? 0,
          outputSettingLength: row.output_setting?.length ?? 0,
        },
        after: {
          visibility: "public",
          avatarUrl: MEDIA[row.name].avatar,
          coverImageUrl: MEDIA[row.name].cover,
          globalCssLength: css.length,
          recoveredSourceCssLength: recoveredCss.length,
          mediaProvenance: MEDIA[row.name].provenance,
          openingComponentLength: openingComponent.length,
          outputSettingLength: outputSetting?.length ?? 0,
          floatingComponents: floatingComponents.map((component) => ({
            name: component.name,
            length: component.content.length,
            orderIndex: component.orderIndex,
          })),
        },
        css,
        openingComponent,
        outputSetting,
        floatingComponents,
      };
    });
    const report = {
      version: 3,
      mode: commit ? "commit" : "dry-run",
      generatedAt: new Date().toISOString(),
      ownerEmail: OWNER_EMAIL,
      changes: changes.map(
        ({
          css: _css,
          openingComponent: _openingComponent,
          outputSetting: _outputSetting,
          floatingComponents: _floatingComponents,
          ...change
        }) => change,
      ),
    };
    if (commit) {
      await sql.begin(async (tx) => {
        for (const change of changes) {
          await tx`
            update characters set visibility='public', avatar_url=${change.after.avatarUrl},
              cover_image_url=${change.after.coverImageUrl},
              output_setting=${change.outputSetting}, updated_at=now()
            where id=${change.characterId}
          `;
          await tx`
            update beautification_packs set global_css=${change.css}, updated_at=now()
            where id=${change.packId}
          `;
          const existingComponents = await tx<{ id: string }[]>`
            select id from opening_components
            where pack_id=${change.packId} and name='原卡演绎室'
            order by created_at asc
          `;
          if (existingComponents.length > 0) {
            await tx`
              update opening_components
              set content=${change.openingComponent}, enabled=true,
                  order_index=0, updated_at=now()
              where id=${existingComponents[0].id}
            `;
          } else {
            await tx`
              insert into opening_components (pack_id,name,content,enabled,order_index)
              values (${change.packId},'原卡演绎室',${change.openingComponent},true,0)
            `;
          }
          const managedNames = [
            "统一灵动岛播放器",
            "统一指令侧栏",
            "风金播放器",
            "NPC与卷宗侧栏",
            "Omni-Cube",
          ];
          await tx`
            delete from opening_components
            where pack_id=${change.packId} and name in ${tx(managedNames)}
          `;
          for (const component of change.floatingComponents) {
            await tx`
              insert into opening_components (pack_id,name,content,enabled,order_index)
              values (${change.packId},${component.name},${component.content},true,${component.orderIndex})
            `;
          }
        }
      });
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
