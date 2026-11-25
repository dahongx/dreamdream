import {expect,test} from 'bun:test';
import {fullscreenStoryEnvelope,parseFullscreenStory,fullscreenStoryDocument,type FullscreenStory} from '../opening/fullscreen-story';
import {routeOpeningContentSplit,interpolateOpening} from '../opening/content';
import {buildIframeSrcdoc} from '../regex/iframe-bridge';
const spec:FullscreenStory={version:1,kind:'censy-v19',triggerCss:'.censy-anchor-v19{height:150px}',document:'<html><body><script>window.parent.censyStartV19 = function(){var stage=document.createElement("div");stage.id = \'censy-v19-stage\';}</script></body></html>'};
test('public full viewport story stays inert through routing without moving other source blocks',()=>{
 const envelope=fullscreenStoryEnvelope(spec);expect(envelope).not.toContain('<script>');expect(parseFullscreenStory(envelope)).toEqual(spec);
 const opening='```html\n<html><body>before</body></html>\n```\n```html\n'+envelope+'\n```\n```html\n<html><body>after</body></html>\n```';
 const result=routeOpeningContentSplit(opening,'fixture');expect(result.floating).toHaveLength(0);expect(result.inline?.kind).toBe('iframe-multi');
 if(result.inline?.kind==='iframe-multi'){expect(result.inline.srcdocs.filter(d=>parseFullscreenStory(d))).toHaveLength(1);expect(result.inline.srcdocs[0]).toContain('before');expect(result.inline.srcdocs.at(-1)).toContain('after');}
 expect(parseFullscreenStory(interpolateOpening(envelope,{char:'c',user:'quoted" user'}))).toEqual(spec);
});
test('only the explicit observed cinematic may activate',()=>{
 for(const invalid of [{...spec,version:2},{...spec,kind:'arbitrary'},{...spec,document:'<iframe src="https://example.com"></iframe>'+spec.document},{...spec,document:spec.document+'{{user}}'},{...spec,document:'<p>ordinary card</p>'},{...spec,triggerCss:'body{color:red}'}])expect(parseFullscreenStory(fullscreenStoryEnvelope(invalid as FullscreenStory))).toBeNull();
});
test('local stage retains source timers and sends only its close marker',()=>{
 const doc=fullscreenStoryDocument(spec);expect(doc).toContain(spec.document.slice(0,spec.document.indexOf('</body>')));expect(doc).toContain("MutationObserver");expect(doc).toContain("nj_mufy_fullscreen_story_closed");expect(doc).toContain("e.key==='Escape'");expect(doc).not.toContain('host.sendMessage');
 const isolated=buildIframeSrcdoc({srcdoc:doc,captureGroups:[],inlineParentShim:true,cssScope:'fullscreen-story'});expect(isolated).toContain("connect-src 'none'");expect(isolated).toContain("frame-src 'none'");expect(isolated).toContain('var realParent = window.parent');expect(isolated).not.toContain('allow-same-origin');expect(isolated).not.toContain('function findSidebar()');
});

const profile:FullscreenStory={version:1,kind:'censy-profile-v9',triggerCss:'.cenConfig_anchor_v9{height:380px}',triggerMarkup:'<div class="Tt_name_glow_v9"><div class="Sx_char_1_v9">江</div></div>',triggerLabel:'江之余 · 人物档案',inheritedFont:'STSong, SimSun, "Noto Serif SC", serif',inheritedColor:'rgb(122, 31, 31)',inheritedLineHeight:1.8,document:'<html><body><script>function Sx_init_v9(){let mask=document.createElement("div");mask.id = \'Tuan_cover_v9\';document.body.appendChild(mask);window.parent.Cmtt_off_v9 = function(){mask.remove();};}</script></body></html>'};
test('the separately observed profile has an inert, finite viewport contract',()=>{
 const envelope=fullscreenStoryEnvelope(profile);
 expect(parseFullscreenStory(envelope)).toEqual(profile);
 expect(envelope).not.toContain('<script>');
 const doc=fullscreenStoryDocument(profile);
 expect(doc).toContain("document.getElementById('Tuan_cover_v9')");
 expect(doc).toContain("window.Sx_init_v9()");
 expect(doc).not.toContain('window.parent.censyStartV19()');
 expect(doc).toContain("nj_mufy_fullscreen_story_closed");
 expect(doc).toContain('overflow:hidden!important');
 expect(doc).toContain('font-family:STSong, SimSun, "Noto Serif SC", serif');
 expect(doc).toContain('color:rgb(122, 31, 31);line-height:1.8');
 expect(doc).toContain('box-sizing:border-box');
 expect(doc).toContain('#Tuan_cover_v9 .Mg_left_v9{scrollbar-width:thin}');
 expect(doc).toContain('#Tuan_cover_v9 .Mg_left_v9::-webkit-scrollbar{width:8px}');
 const built=buildIframeSrcdoc({srcdoc:doc,captureGroups:[],inlineParentShim:true,cssScope:'fullscreen-story'});
 expect(built).toContain("connect-src 'none'");
 expect(built).not.toContain('allow-same-origin');
 expect(built).not.toContain('function findSidebar()');
});

test('profile trigger provenance and original callbacks cannot be replaced by arbitrary programs',()=>{
 if(profile.kind!=='censy-profile-v9')throw Error('PROFILE_FIXTURE');
 for(const invalid of [{...profile,kind:'anything'},{...profile,triggerMarkup:'<div onclick="bad()" class="Tt_name_glow_v9"></div>'},{...profile,triggerMarkup:'<iframe></iframe>'},{...profile,triggerLabel:''},{...profile,triggerCss:'body{color:red}'},{...profile,inheritedColor:'rgb(999, 0, 0)'},{...profile,inheritedColor:'red;display:none'},{...profile,inheritedFont:'serif;}body{color:red'},{...profile,inheritedLineHeight:0},{...profile,document:profile.document.replace('function Sx_init_v9()','function other()')},{...profile,document:profile.document.replace('window.parent.Cmtt_off_v9 = function()','function close()')},{...profile,document:profile.document+'{{user}}'}])expect(parseFullscreenStory(fullscreenStoryEnvelope(invalid as FullscreenStory))).toBeNull();
});
test('finite timeline accepts only four inert source entries and never emits an executable frame',()=>{
 const timeline:FullscreenStory={version:1,kind:'censy-timeline-v10',document:'',triggerCss:'.Tuan_node_v10{}',triggerMarkup:'<div id="Z_CONFIG-xm-timeline-v10-fix"></div>',entries:[0,1,2,3].map(i=>({label:'entry'+i,modalMarkup:'<div id="Z_CONFIG_close_xm_v10">Close</div>'}))};
 expect(parseFullscreenStory(fullscreenStoryEnvelope(timeline))).toEqual(timeline);
 expect(()=>fullscreenStoryDocument(timeline)).toThrow('FINITE_NATIVE_TIMELINE');
 for(const bad of [{...timeline,document:'<script>bad()</script>'},{...timeline,entries:timeline.entries.slice(1)},{...timeline,triggerMarkup:timeline.triggerMarkup+'<script>bad()</script>'},{...timeline,entries:timeline.entries.map(e=>({...e,modalMarkup:e.modalMarkup+'<iframe></iframe>'}))}])expect(parseFullscreenStory(fullscreenStoryEnvelope(bad))).toBeNull();
});
