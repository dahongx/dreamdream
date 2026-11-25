import {describe,test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {normalizePublicFrameReplay} from '../mufy-public-frame-replay';
import {localizeKnownPublicGhostMusicV4} from '../mufy-public-ghost-music-localizer';

const code=readFileSync(new URL('./fixtures/public-ghost-music-v4-controller.txt',import.meta.url),'utf8');
const statuses='<details><summary>Status one</summary><p>Alpha</p></details><details><summary>Status two</summary><p>Beta</p></details><details><summary>Status three</summary><p>Gamma</p></details>';
const template='<template id="censy-ghost-music-v4"><style>#C_GhostPlayer_Panel{position:fixed;color:#ab0000}</style><div id="C_GhostTrigger_Box" onclick="window.parent.Z_ToggleGhostPanel()"></div><div id="C_GhostPlayer_Panel"><button id="C_Ghost_PlayBtn" onclick="window.parent.Z_ToggleGhostAudio()"></button><div onclick="window.parent.Z_SwitchGhostTrack(0)">Track zero</div><div onclick="window.parent.Z_SwitchGhostTrack(1)">Track one</div><div onclick="window.parent.Z_SwitchGhostTrack(2)">Track two</div><div id="C_Ghost_Wave"></div><audio id="C_Ghost_AudioEngine" loop></audio></div></template>';
const source=`<!doctype html><html><body>${statuses}${template}<script>${code}</script></body></html>`;
describe('exact public ghost music v4 localizer',()=>{
 test('localizes every parent read/write including initial referrer access and template calls, inertly',()=>{
  const result=localizeKnownPublicGhostMusicV4(source);
  expect(result.localized).toBe(true);expect(result.localizedInlineCount).toBe(5);
  expect(result.html).not.toContain('window.parent');
  for(const symbol of ['C_G_Tracks','C_G_Index','C_G_IsPlaying','Z_ToggleGhostPanel','Z_ToggleGhostAudio','Z_SwitchGhostTrack'])expect(result.html).toContain(`window.${symbol}`);
  expect(result.html).toContain('window.document.querySelector');
  expect(result.mediaRuntimeVerified).toBe(false);
 });
 test('retains original URLs, style, ordinary status nodes and serialized audio state',()=>{
  const result=localizeKnownPublicGhostMusicV4(source);
  expect(result.html).toContain(statuses);expect(result.html).toContain('#C_GhostPlayer_Panel{position:fixed;color:#ab0000}');
  const urls=code.match(/https?:\/\/[^"\s]+/g)!;expect(urls.length).toBe(3);
  for(const url of urls)expect(result.html).toContain(url);
  const before=new JSDOM(source),after=new JSDOM(result.html);
  expect(after.window.document.querySelectorAll('details').length).toBe(3);
  expect(after.window.document.querySelector('template')?.content.querySelector('audio')?.outerHTML).toBe(before.window.document.querySelector('template')?.content.querySelector('audio')?.outerHTML);
  before.window.close();after.window.close();
 });
 test('unknown controller or missing exact controls is byte-for-byte unchanged',()=>{
  for(const input of [source.replace('const oldBox','const changedBox'),source.replace('C_Ghost_Wave','unknown-wave'),'<script>window.parent.Z_ToggleGhostPanel=function(){};</script>']){
   const result=localizeKnownPublicGhostMusicV4(input);expect(result.localized).toBe(false);expect(result.html).toBe(input);
  }
 });
 test('never rewrites unrelated parent behavior even alongside the exact known controller',()=>{
  const unknown='<script>window.parent.unknownHostBehavior();</script>';
  const result=localizeKnownPublicGhostMusicV4(source+unknown);
  expect(result.localized).toBe(true);expect(result.html).toContain(unknown);
 });
 test('idempotent and accepts the inert replay normalizer serialization',()=>{
  const normalized=normalizePublicFrameReplay(source).html;
  const result=localizeKnownPublicGhostMusicV4(normalized);
  expect(result.localized).toBe(true);
  const twice=localizeKnownPublicGhostMusicV4(result.html);expect(twice.localized).toBe(false);expect(twice.html).toBe(result.html);
 });
});
