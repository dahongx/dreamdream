import {validLin83Spec} from "./lin-toolkit-83-contract";
import type {LinToolkitControl as LinToolkit83Control} from "./lin-toolkit-83";
import {validHeartNavSpec,type HeartNavSpec} from "./heart-orb-nav";
import {validKnownWinterMusic} from "./winter-music-v9";
import {validLinToolkitControl,LIN_PUBLIC_DATA,type LinToolkitControl} from "./lin-toolkit";
import {validKnownCensyMusicDetails} from "./censy-music-details";
import {validHeartOrbSpec,type HeartOrbSpec} from "./heart-orb-os";
import {validKnownGhostNativeSpec,type KnownGhostNativeSpec} from "./censy-ghost-music";
import {publicIslandEmojiUrls,validPublicIslandPaintOptions} from "./public-island-emoji";
import {validFoxToolkit,type FoxToolkitData} from "./fox-toolkit";
import {validHaloToolkit,type HaloToolkitData} from "./halo-toolkit";
import { validNativeSourceBox, type NativeSourceBox } from "./native-source-box";
/** Explicit migration envelope: inert source shell plus independently sandboxed documents. */
export interface NativeImageSidebar {
  version: 1;
  variant?: "censy-music-details" | "winter-music-v9" | "glass-music" | "pixel-music" | "black-focus" | "ghost-focus-left" | "ins-music" | "zen-music" | "cloud-music" | "command-drawer" | "page-controls" | "halo-toolkit" | "static-music" | "image-island" | "fox-toolkit" | "censy-ghost-music-v4" | "heart-orb-os-v42" | "heart-orb-nav-v441";
  shellHtml: string;
  css: string;
  documents: string[];
  framePresentation?: { minHeight: number; borderRadius: number };
  sourceBox?: NativeSourceBox;
  triggerForeground?: string;
  cloudMusic?: NativeCloudMusicConfig;
  ghostMusic?: KnownGhostNativeSpec["ghostMusic"];
  heartOrb?: HeartOrbSpec["heartOrb"];
  heartNav?: HeartNavSpec["heartNav"];
  commandDrawer?: {id:string;commands:{title:string;content:string}[]};
  pageControls?: {linToolkit?:LinToolkitControl|LinToolkit83Control;id:string;quickCss:string;scrollButtons?:boolean;navigation?:'capsule'|'heart'|'narrow';quickSymbols?:'source-v5-four'};
  haloToolkit?: HaloToolkitData;
  foxToolkit?: FoxToolkitData;
  imageIsland?: {id:'duanxin-image-island';audioSrc:string;avatars:string[];emojis:string[]};
}
export function validImageIsland(value:unknown):value is NonNullable<NativeImageSidebar['imageIsland']>{
 if(!value||typeof value!=='object')return false;const s=value as Partial<NonNullable<NativeImageSidebar['imageIsland']>>;
 const valid=(urls:unknown,count:number)=>Array.isArray(urls)&&urls.length===count&&new Set(urls).size===count&&urls.every(url=>{try{const u=new URL(url);return typeof url==='string'&&url.length<2048&&u.protocol==='https:'&&!u.username&&!u.password&&u.hostname==='i.imgs.ovh';}catch{return false;}});
 return s.id==='duanxin-image-island'&&s.audioSrc==='https://music.163.com/song/media/outer/url?id=2125237427.mp3'&&valid(s.avatars,9)&&valid(s.emojis,16);
}
export function validNativeCommands(value:unknown):value is NonNullable<NativeImageSidebar['commandDrawer']>{
 if(!value||typeof value!=='object')return false;const c=value as Partial<NonNullable<NativeImageSidebar['commandDrawer']>>;
 return typeof c.id==='string'&&/^[-\w]{1,120}$/.test(c.id)&&Array.isArray(c.commands)&&c.commands.length>0&&c.commands.length<=50&&c.commands.every(x=>typeof x.title==='string'&&!!x.title.trim()&&x.title.length<=200&&typeof x.content==='string'&&!!x.content.trim()&&x.content.length<=40000)&&JSON.stringify(c).length<=250000;
}
export interface NativeCloudMusicConfig {id:string;tracks:{title:string;src:string;artist?:string}[];lineHeight:number;initialDisabled:boolean;layout?:'island';multiModule?:{kind:'v4';commands:{title:string;content:string}[];modeLabels:[string,string,string];emojis?:string[];insertFeedback?:'source-gold-200ms'|'source-blue-200ms';artistFontSize?:10|11}}
export function validNativeCloudMusic(value:unknown):value is NativeCloudMusicConfig{
 if(!value||typeof value!=='object')return false;const c=value as Partial<NativeCloudMusicConfig>;
 if(typeof c.id!=='string'||!/^[-\w]{1,120}$/.test(c.id)||typeof c.initialDisabled!=='boolean'||typeof c.lineHeight!=='number'||!Number.isFinite(c.lineHeight)||c.lineHeight<1||c.lineHeight>3||!Array.isArray(c.tracks)||!c.tracks.length||c.tracks.length>30)return false;
 if(c.layout!==undefined&&c.layout!=='island')return false;
 if(c.multiModule!==undefined&&(c.layout!=='island'||!c.multiModule||c.multiModule.kind!=='v4'||!validNativeCommands({id:c.id,commands:c.multiModule.commands})||!Array.isArray(c.multiModule.modeLabels)||c.multiModule.modeLabels.length!==3||!c.multiModule.modeLabels.every(s=>typeof s==='string'&&s.length>0&&s.length<=30)))return false;
 if(c.multiModule&&(publicIslandEmojiUrls(c.multiModule.emojis)===null||!validPublicIslandPaintOptions(c.multiModule)))return false;
 return c.tracks.every(t=>{try{return typeof t.title==='string'&&!!t.title.trim()&&t.title.length<200&&(t.artist===undefined||(typeof t.artist==='string'&&t.artist.length<=200))&&typeof t.src==='string'&&t.src.length<2048&&new URL(t.src).protocol==='https:';}catch{return false;}})&&new Set(c.tracks.map(t=>t.src)).size===c.tracks.length;
}

export function safeNativeTriggerForeground(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match=/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/.exec(value);
  if(!match||match.slice(1).some(channel=>Number(channel)>255))return null;
  return `rgb(${Number(match[1])}, ${Number(match[2])}, ${Number(match[3])})`;
}

const ENVELOPE =
  /<template data-nj-native-image-sidebar-v1>([\s\S]*?)<\/template>/g;

/** A username containing quotes must not corrupt an inert JSON envelope. */
export function mapOutsideNativeImageSidebars(
  content: string,
  map: (part: string) => string,
): string {
  let end = 0,
    result = "";
  for (const match of content.matchAll(/<template data-nj-(?:native-image-sidebar|composer-prefix)-v1>[\s\S]*?<\/template>/g)) {
    result += map(content.slice(end, match.index)) + match[0];
    end = (match.index ?? 0) + match[0].length;
  }
  return result + map(content.slice(end));
}

export function nativeImageSidebarEnvelope(spec: NativeImageSidebar): string {
  return `<template data-nj-native-image-sidebar-v1>${JSON.stringify(spec).replace(/</g, "\\u003c")}</template>`;
}

export function extractNativeImageSidebars(content: string): {
  rest: string;
  sidebars: NativeImageSidebar[];
} {
  const sidebars: NativeImageSidebar[] = [];
  const rest = content.replace(
    new RegExp(ENVELOPE.source, "g"),
    (raw, json: string) => {
      if (json.length > 2_000_000) return raw;
      try {
        const value: unknown = JSON.parse(json);
        if (!value || typeof value !== "object") return raw;
        const s = value as Partial<NativeImageSidebar>;
        if(s.variant!==undefined&&s.variant!=="censy-music-details"&&s.variant!=="winter-music-v9"&&s.variant!=="glass-music"&&s.variant!=="pixel-music"&&s.variant!=="black-focus"&&s.variant!=="ghost-focus-left"&&s.variant!=="ins-music"&&s.variant!=="zen-music"&&s.variant!=="cloud-music"&&s.variant!=="command-drawer"&&s.variant!=="page-controls"&&s.variant!=="halo-toolkit"&&s.variant!=="static-music"&&s.variant!=="image-island"&&s.variant!=="fox-toolkit"&&s.variant!=="censy-ghost-music-v4"&&s.variant!=="heart-orb-os-v42"&&s.variant!=="heart-orb-nav-v441")return raw;
        if(s.variant==='heart-orb-os-v42'?!validHeartOrbSpec(s):s.heartOrb!==undefined)return raw;
        if(s.variant==='heart-orb-nav-v441'?!validHeartNavSpec(s):s.heartNav!==undefined)return raw;
        if(s.variant==='censy-music-details'&&!validKnownCensyMusicDetails(s))return raw;
        if(s.variant==='winter-music-v9'&&!validKnownWinterMusic(s))return raw;
        if(s.variant==='censy-ghost-music-v4'?!validKnownGhostNativeSpec(s):s.ghostMusic!==undefined)return raw;
        if(s.variant==='fox-toolkit'?!validFoxToolkit(s.foxToolkit):s.foxToolkit!==undefined)return raw;
        if(s.variant==='image-island'?(!validImageIsland(s.imageIsland)||!s.shellHtml?.includes('censy-image-island')):s.imageIsland!==undefined)return raw;
        if(s.variant==='static-music'&&s.documents?.length!==1)return raw;
        if(s.variant==='halo-toolkit'?!validHaloToolkit(s.haloToolkit):s.haloToolkit!==undefined)return raw;
        if(s.variant==='page-controls'?(!s.pageControls||typeof s.pageControls.id!=='string'||!/^[-\w]{1,120}$/.test(s.pageControls.id)||typeof s.pageControls.quickCss!=='string'||s.pageControls.quickCss.length>20000||(s.pageControls.scrollButtons!==undefined&&typeof s.pageControls.scrollButtons!=='boolean')||(s.pageControls.navigation!==undefined&&(!['capsule','heart','narrow'].includes(s.pageControls.navigation)||s.pageControls.scrollButtons!==false))):s.pageControls!==undefined)return raw;
        if(s.pageControls?.linToolkit!==undefined&&!Boolean(validLin83Spec(s))&&(!validLinToolkitControl(s.pageControls.linToolkit)||s.pageControls.id!==LIN_PUBLIC_DATA.id||s.shellHtml!==LIN_PUBLIC_DATA.shellHtml||s.css!==LIN_PUBLIC_DATA.css||s.pageControls.quickCss!==''||s.pageControls.scrollButtons!==false||s.pageControls.navigation!==undefined||s.pageControls.quickSymbols!==undefined||s.documents?.length))return raw;
        if(s.pageControls?.quickSymbols!==undefined&&(s.pageControls.quickSymbols!=='source-v5-four'||s.pageControls.navigation!==undefined||s.pageControls.scrollButtons!==false))return raw;
        if(s.pageControls?.navigation==='heart'&&(s.pageControls.quickCss!==''||!s.shellHtml?.includes('censy-heart-elevator-v4-wrap')))return raw;
        if(s.pageControls?.navigation==='narrow'&&(s.pageControls.quickCss!==''||!s.shellHtml?.includes('censy-narrow-nav-v14')))return raw;
        if(s.variant==='command-drawer'?!validNativeCommands(s.commandDrawer):s.commandDrawer!==undefined)return raw;
        if(s.variant==='cloud-music'?!validNativeCloudMusic(s.cloudMusic):s.cloudMusic!==undefined)return raw;
        if(s.triggerForeground!==undefined&&!safeNativeTriggerForeground(s.triggerForeground))return raw;
        if(s.sourceBox!==undefined&&(s.variant!==undefined||!validNativeSourceBox(s.sourceBox)))return raw;
        if (
          s.framePresentation &&
          (!Number.isFinite(s.framePresentation.minHeight) ||
            s.framePresentation.minHeight < 1 ||
            s.framePresentation.minHeight > 500 ||
            !Number.isFinite(s.framePresentation.borderRadius) ||
            s.framePresentation.borderRadius < 0 ||
            s.framePresentation.borderRadius > 48)
        )
          return raw;
        if (
          s.version !== 1 ||
          typeof s.shellHtml !== "string" ||
          typeof s.css !== "string" ||
          !Array.isArray(s.documents)
        )
          return raw;
        if (
          s.shellHtml.length > 30_000 ||
          s.css.length > 300_000 ||
          s.documents.length < (s.variant==='heart-orb-nav-v441'||s.variant==='heart-orb-os-v42'||s.variant==='censy-ghost-music-v4'||s.variant==='fox-toolkit'||s.variant==='image-island'||s.variant==="ghost-focus-left"||s.variant==='cloud-music'||s.variant==='command-drawer'||s.variant==='page-controls'||s.variant==='halo-toolkit'?0:1) ||
          ((s.variant==='heart-orb-nav-v441'||s.variant==='heart-orb-os-v42'||s.variant==='censy-ghost-music-v4'||s.variant==='fox-toolkit'||s.variant==='image-island'||s.variant==="ghost-focus-left"||s.variant==='cloud-music'||s.variant==='command-drawer'||s.variant==='page-controls'||s.variant==='halo-toolkit')&&s.documents.length!==0) ||
          s.documents.length > 10
        )
          return raw;
        if (
          !s.shellHtml.includes(s.variant==='page-controls'&&s.pageControls?.linToolkit?'lin-jb-root':s.variant==='winter-music-v9'?'censy-winter-music-sidebar':s.variant==='censy-music-details'?'censy-music-sidebar-box':(s.variant==='heart-orb-nav-v441'||s.variant==='heart-orb-os-v42')?'cen_heart_master':s.variant==='censy-ghost-music-v4'?'C_GhostTrigger_Box':s.variant==='fox-toolkit'?'native-fox-toolkit':s.variant==='image-island'?'censy-image-island':s.variant==='static-music'?'static-music-sidebar':s.variant==='halo-toolkit'?'native-halo-toolkit':s.variant==='page-controls'?'native-page-controls':s.variant==='command-drawer'?'native-command-sidebar':s.variant==='cloud-music'?'cloud-music-sidebar':s.variant==="zen-music"?"zen-music-sidebar":s.variant==="ins-music"?"ins-music-sidebar":s.variant==="ghost-focus-left"?"ghost-sidebar-container":s.variant==="glass-music"?"glass-music-sidebar":s.variant==="pixel-music"?"sidebar-music-box":s.variant==="black-focus"?"midnight-black-container":"mufy-side-r") ||
          (s.variant!=='heart-orb-nav-v441'&&s.variant!=='heart-orb-os-v42'&&s.variant!=='censy-ghost-music-v4'&&s.variant!=='fox-toolkit'&&s.variant!=='image-island'&&s.variant!=='halo-toolkit'&&s.variant!=='cloud-music'&&s.variant!=='command-drawer'&&s.variant!=='page-controls'&&!s.shellHtml.includes("data-nj-native-documents"))
        )
          return raw;
        if (
          !s.documents.every(
            (doc) =>
              typeof doc === "string" &&
              doc.length > 0 &&
              doc.length < 250_000 &&
              !/__MUFY_ARTIFACT_BRIDGE__|__MUFY_CLOSE_INITIAL_CONTEXT__|Network requests are blocked in sandbox|<iframe\b/i.test(
                doc,
              ),
          )
        )
          return raw;
        if (new Set(s.documents).size !== s.documents.length) return raw;
        sidebars.push(s as NativeImageSidebar);
        return "";
      } catch {
        return raw;
      }
    },
  );
  return { rest, sidebars };
}
