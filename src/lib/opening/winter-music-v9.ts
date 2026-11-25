/** Exact public Winter Player V9 family. Inert shell, one opaque original author document. */
export const WINTER_MUSIC_SHELL =
  '<details class="censy-winter-music-sidebar">\n<summary></summary>\n<div class="censy-winter-content-v9"><div data-nj-native-documents=""></div></div>\n</details>';
export const WINTER_MUSIC_CSS =
  "\n/* design by censy (Winter Player V9 - Aurora) */details.censy-winter-music-sidebar{position:fixed;right:5px;top:45%;z-index:999;transform:translateY(-50%)}details.censy-winter-music-sidebar>summary{list-style:none;width:60px;height:60px;background:url('https://z.wiki/u/xEPfKkSi9') no-repeat center/contain;cursor:pointer;transition:.3s;opacity:1;filter:drop-shadow(0 2px 5px rgba(166,212,250,0.5))}details.censy-winter-music-sidebar>summary:hover{transform:scale(1.1) rotate(5deg)}details.censy-winter-music-sidebar>summary::marker,details.censy-winter-music-sidebar>summary::-webkit-details-marker{display:none}details.censy-winter-music-sidebar[open]{width:280px;height:420px;background:rgba(240,248,255,0.95);backdrop-filter:blur(10px);border-radius:16px 0 0 16px;border:1px solid rgba(255,255,255,0.8);box-shadow:-5px 0 25px rgba(166,212,250,0.3);display:flex;align-items:center;justify-content:center;right:0}details.censy-winter-music-sidebar[open]>summary{position:absolute;left:-55px;top:50%;transform:translateY(-50%);background:url('https://z.wiki/u/xEPfKkSi9') no-repeat center/contain;filter:grayscale(1) opacity(.6);width:50px;height:50px}.censy-winter-content-v9{width:100%;height:100%;max-width:300px;max-height:450px;overflow:hidden;border-radius:16px 0 0 16px;position:relative}\n";
export const WINTER_AUTHOR_PROGRAM =
  "\nconst songs=[{title:\"爱爱爱\",url:\"https://music.163.com/song/media/outer/url?id=5240523.mp3\"},{title:\"烈焰玫瑰\",url:\"https://music.163.com/song/media/outer/url?id=1971117689.mp3\"},{title:\"听雨\",url:\"https://music.163.com/song/media/outer/url?id=1867108106.mp3\"},{title:\"拉过勾的\",url:\"https://music.163.com/song/media/outer/url?id=2037142711.mp3\"},{title:\"一个人也OK\",url:\"https://music.163.com/song/media/outer/url?id=3338500692.mp3\"},{title:\"灰色系\",url:\"https://music.163.com/song/media/outer/url?id=2723432391.mp3\"}];let currentIdx=0;const audio=document.getElementById('bgm'),titleDisplay=document.getElementById('titleDisplay'),playBtn=document.getElementById('playBtn'),progBar=document.getElementById('progBar'),playlistBox=document.getElementById('playlistBox');songs.forEach((s,i)=>{let d=document.createElement('div');d.className='song-item';d.innerText=(i+1)+'. '+s.title;d.onclick=()=>loadTrack(i);playlistBox.appendChild(d)});function loadTrack(i){currentIdx=i;audio.src=songs[i].url;titleDisplay.innerText=songs[i].title;Array.from(playlistBox.children).forEach((c,x)=>c.className=x===i?'song-item active':'song-item');audio.play().then(updatePlayBtn).catch(()=>{})}function updatePlayBtn(){const icon=document.getElementById('playIcon');if(audio.paused){icon.innerHTML='<path d=\"M8 5v14l11-7z\"/>'}else{icon.innerHTML='<path d=\"M6 19h4V5H6v14zm8-14v14h4V5h-4z\"/>'}}function togglePlay(){if(audio.src){audio.paused?audio.play():audio.pause();updatePlayBtn()}else loadTrack(0)}function playPrev(){let i=currentIdx-1;if(i<0)i=songs.length-1;loadTrack(i)}function playNext(){let i=currentIdx+1;if(i>=songs.length)i=0;loadTrack(i)}audio.ontimeupdate=()=>{if(audio.duration)progBar.style.width=(audio.currentTime/audio.duration)*100+'%'};audio.onended=playNext;function copyText(t){if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(t).then(showToast);else{let a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();document.execCommand('copy');document.body.removeChild(a);showToast()}}function showToast(){let t=document.getElementById('toast');t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2000)}\n";
export const WINTER_ORIGINAL_STATIC_HEAD =
  '\n  <meta charset="UTF-8">\n<style>\nhtml {\n  width: 100%;\n  height: fit-content;\n  overflow: hidden;\n  box-sizing: border-box;\n}\nbody {\n  width: 100%;\n  min-height: 100%;\n  height: auto;\n  margin: 0;\n  padding: 0;\n  box-sizing: border-box;\n}\nsummary {\n  color: white;\n}\n</style>\n';
export const WINTER_ORIGINAL_STATIC_BODY =
  '\n  \n  <!DOCTYPE html>\n<html lang="zh">\n<head>\n<meta charset="UTF-8">\n<style>\n  *{box-sizing:border-box;margin:0;padding:0;font-family:\'Noto Serif SC\',sans-serif}body{background:linear-gradient(160deg,#e3f2fd 0%,#f0f8ff 100%);height:420px;width:100%;padding:12px;color:#5c7c9e;overflow:hidden;display:flex;flex-direction:column;gap:8px}.player-card{background:rgba(255,255,255,.6);backdrop-filter:blur(8px);border-radius:12px;padding:12px;box-shadow:0 4px 15px rgba(166,212,250,.2);border:1px solid rgba(255,255,255,.8);flex-shrink:0}.now-playing{display:flex;align-items:center;gap:10px;margin-bottom:10px}.album-art{width:45px;height:45px;background-image:url(\'https://z.wiki/u/cpke9jZ4S\');background-size:cover;background-position:center;border-radius:8px;box-shadow:0 2px 5px rgba(0,0,0,0.1)}.track-info{flex:1;overflow:hidden;display:flex;align-items:center}.track-title{font-weight:700;font-size:14px;color:#1e3a8a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 0 5px rgba(255,255,255,0.8)}.progress-wrap{height:4px;background:#e3f2fd;border-radius:2px;margin:8px 0;cursor:pointer;position:relative;overflow:hidden}.progress-bar{height:100%;background:linear-gradient(90deg,#89c4f4,#5c7c9e);width:0%;border-radius:2px;transition:width .1s linear}.controls{display:flex;justify-content:center;gap:20px;align-items:center;margin-top:5px}.btn{border:none;background:rgba(255,255,255,0.8);cursor:pointer;color:#5c7c9e;transition:.2s;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(166,212,250,.3)}.btn:hover{color:#1e3a8a;background:#fff;transform:translateY(-1px);box-shadow:0 4px 10px rgba(166,212,250,.5)}.btn:active{transform:translateY(0)}.btn-sub{width:32px;height:32px}.btn-main{width:40px;height:40px;background:#e3f2fd;color:#1e3a8a}.btn svg{fill:currentColor}.playlist{height:80px;overflow-y:auto;margin-top:8px;padding-right:4px}.playlist::-webkit-scrollbar{width:3px}.playlist::-webkit-scrollbar-thumb{background:#a6d4fa;border-radius:3px}.song-item{font-size:11px;padding:6px 8px;border-radius:6px;cursor:pointer;display:flex;justify-content:space-between;transition:.2s;color:#5c7c9e;margin-bottom:2px}.song-item:hover{background:rgba(255,255,255,.7)}.song-item.active{background:rgba(227,242,253,.8);color:#1e3a8a;font-weight:bold;box-shadow:0 1px 3px rgba(166,212,250,0.2)}.cmd-area{flex:1;background:rgba(255,255,255,.5);border-radius:12px;padding:10px;border:1px solid rgba(255,255,255,.6);display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(3,1fr);gap:8px;overflow:hidden}.cmd-btn{background:rgba(255,255,255,.8);border:1px solid #a6d4fa;border-radius:8px;color:#5c7c9e;font-size:11px;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;text-align:center}.cmd-btn:hover{background:#e3f2fd;color:#1e3a8a;border-color:#5c7c9e;transform:translateY(-1px);box-shadow:0 3px 6px rgba(166,212,250,0.25)}.cmd-btn:active{transform:translateY(0)}.toast{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(30,58,138,0.85);color:#fff;padding:6px 14px;border-radius:20px;font-size:11px;opacity:0;pointer-events:none;transition:.3s;z-index:10;backdrop-filter:blur(4px);box-shadow:0 4px 10px rgba(0,0,0,0.1)}.toast.show{opacity:1;bottom:30px}\n</style>\n</head>\n<body><div class="player-card"><div class="now-playing"><div class="album-art"></div><div class="track-info"><div class="track-title" id="titleDisplay">选择歌曲</div></div></div><div class="progress-wrap" id="progWrap"><div class="progress-bar" id="progBar"></div></div><div class="controls"><button class="btn btn-sub" onclick="playPrev()"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg></button><button class="btn btn-main" onclick="togglePlay()" id="playBtn"><svg viewBox="0 0 24 24" width="20" height="20" id="playIcon"><path d="M8 5v14l11-7z"/></svg></button><button class="btn btn-sub" onclick="playNext()"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg></button></div><div class="playlist" id="playlistBox"></div></div><div class="cmd-area"><button class="cmd-btn" onclick="copyText(\'($禁止男主频繁做爱，欲望降低50％)\')">陆淮谦🌟欲降低</button><button class="cmd-btn" onclick="copyText(\'($严禁将【正文剧情】中发生的事件、对话，特别是涉及{<!-- -->{user}}的隐私、内心活动、未公开行动，作为【信息模块】中角色的聊天内容。群聊中的角色应对此完全不知情，他们的聊天内容应基于群聊本身的上下文，或他们自己在主线中公开可知的信息。)\')">信息防窥</button><button class="cmd-btn" onclick="copyText(\'(${{char}}主动推剧情/$推动主线剧情发展，来到下一个设置好的关键剧情节点)\')">推剧情</button><button class="cmd-btn" onclick="copyText(\'($请让角色保持情绪温和，避免极端偏执等负面情绪和恶意猜测怀疑，禁止频繁哭泣，禁止疯狂粗暴，人设遵守发展阶段，回顾人设面具中的情节，然后回复)\')">ooc/记忆</button><button class="cmd-btn" onclick="copyText(\'(＄xxx带着所有的记忆回到xxx年前，现在是xxx年)\')">穿越梗</button><button class="cmd-btn" onclick="copyText(\'($文本采用双视角叙事，同时描述了我和男主两边的情况)\')">双视角剧情</button></div><div class="toast" id="toast">指令已复制</div><audio id="bgm"></audio>';
export const WINTER_CANVAS_ADAPTATION =
  "<style data-nj-known-winter-canvas>html{height:420px!important;min-height:0!important;overflow:hidden!important}body{height:420px!important;min-height:0!important;overflow:hidden!important;background:linear-gradient(160deg,#e3f2fd 0%,#f0f8ff 100%)!important}</style>";
export const WINTER_OPAQUE_DOCUMENT =
  '<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n<style>\nhtml {\n  width: 100%;\n  height: fit-content;\n  overflow: hidden;\n  box-sizing: border-box;\n}\nbody {\n  width: 100%;\n  min-height: 100%;\n  height: auto;\n  margin: 0;\n  padding: 0;\n  box-sizing: border-box;\n}\nsummary {\n  color: white;\n}\n</style>\n<style data-nj-known-winter-canvas>html{height:420px!important;min-height:0!important;overflow:hidden!important}body{height:420px!important;min-height:0!important;overflow:hidden!important;background:linear-gradient(160deg,#e3f2fd 0%,#f0f8ff 100%)!important}</style></head>\n<body>\n  \n  <!DOCTYPE html>\n<html lang="zh">\n<head>\n<meta charset="UTF-8">\n<style>\n  *{box-sizing:border-box;margin:0;padding:0;font-family:\'Noto Serif SC\',sans-serif}body{background:linear-gradient(160deg,#e3f2fd 0%,#f0f8ff 100%);height:420px;width:100%;padding:12px;color:#5c7c9e;overflow:hidden;display:flex;flex-direction:column;gap:8px}.player-card{background:rgba(255,255,255,.6);backdrop-filter:blur(8px);border-radius:12px;padding:12px;box-shadow:0 4px 15px rgba(166,212,250,.2);border:1px solid rgba(255,255,255,.8);flex-shrink:0}.now-playing{display:flex;align-items:center;gap:10px;margin-bottom:10px}.album-art{width:45px;height:45px;background-image:url(\'https://z.wiki/u/cpke9jZ4S\');background-size:cover;background-position:center;border-radius:8px;box-shadow:0 2px 5px rgba(0,0,0,0.1)}.track-info{flex:1;overflow:hidden;display:flex;align-items:center}.track-title{font-weight:700;font-size:14px;color:#1e3a8a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 0 5px rgba(255,255,255,0.8)}.progress-wrap{height:4px;background:#e3f2fd;border-radius:2px;margin:8px 0;cursor:pointer;position:relative;overflow:hidden}.progress-bar{height:100%;background:linear-gradient(90deg,#89c4f4,#5c7c9e);width:0%;border-radius:2px;transition:width .1s linear}.controls{display:flex;justify-content:center;gap:20px;align-items:center;margin-top:5px}.btn{border:none;background:rgba(255,255,255,0.8);cursor:pointer;color:#5c7c9e;transition:.2s;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(166,212,250,.3)}.btn:hover{color:#1e3a8a;background:#fff;transform:translateY(-1px);box-shadow:0 4px 10px rgba(166,212,250,.5)}.btn:active{transform:translateY(0)}.btn-sub{width:32px;height:32px}.btn-main{width:40px;height:40px;background:#e3f2fd;color:#1e3a8a}.btn svg{fill:currentColor}.playlist{height:80px;overflow-y:auto;margin-top:8px;padding-right:4px}.playlist::-webkit-scrollbar{width:3px}.playlist::-webkit-scrollbar-thumb{background:#a6d4fa;border-radius:3px}.song-item{font-size:11px;padding:6px 8px;border-radius:6px;cursor:pointer;display:flex;justify-content:space-between;transition:.2s;color:#5c7c9e;margin-bottom:2px}.song-item:hover{background:rgba(255,255,255,.7)}.song-item.active{background:rgba(227,242,253,.8);color:#1e3a8a;font-weight:bold;box-shadow:0 1px 3px rgba(166,212,250,0.2)}.cmd-area{flex:1;background:rgba(255,255,255,.5);border-radius:12px;padding:10px;border:1px solid rgba(255,255,255,.6);display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(3,1fr);gap:8px;overflow:hidden}.cmd-btn{background:rgba(255,255,255,.8);border:1px solid #a6d4fa;border-radius:8px;color:#5c7c9e;font-size:11px;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;text-align:center}.cmd-btn:hover{background:#e3f2fd;color:#1e3a8a;border-color:#5c7c9e;transform:translateY(-1px);box-shadow:0 3px 6px rgba(166,212,250,0.25)}.cmd-btn:active{transform:translateY(0)}.toast{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(30,58,138,0.85);color:#fff;padding:6px 14px;border-radius:20px;font-size:11px;opacity:0;pointer-events:none;transition:.3s;z-index:10;backdrop-filter:blur(4px);box-shadow:0 4px 10px rgba(0,0,0,0.1)}.toast.show{opacity:1;bottom:30px}\n</style>\n</head>\n<body><div class="player-card"><div class="now-playing"><div class="album-art"></div><div class="track-info"><div class="track-title" id="titleDisplay">选择歌曲</div></div></div><div class="progress-wrap" id="progWrap"><div class="progress-bar" id="progBar"></div></div><div class="controls"><button class="btn btn-sub" onclick="playPrev()"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg></button><button class="btn btn-main" onclick="togglePlay()" id="playBtn"><svg viewBox="0 0 24 24" width="20" height="20" id="playIcon"><path d="M8 5v14l11-7z"/></svg></button><button class="btn btn-sub" onclick="playNext()"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg></button></div><div class="playlist" id="playlistBox"></div></div><div class="cmd-area"><button class="cmd-btn" onclick="copyText(\'($禁止男主频繁做爱，欲望降低50％)\')">陆淮谦🌟欲降低</button><button class="cmd-btn" onclick="copyText(\'($严禁将【正文剧情】中发生的事件、对话，特别是涉及{<!-- -->{user}}的隐私、内心活动、未公开行动，作为【信息模块】中角色的聊天内容。群聊中的角色应对此完全不知情，他们的聊天内容应基于群聊本身的上下文，或他们自己在主线中公开可知的信息。)\')">信息防窥</button><button class="cmd-btn" onclick="copyText(\'(${{char}}主动推剧情/$推动主线剧情发展，来到下一个设置好的关键剧情节点)\')">推剧情</button><button class="cmd-btn" onclick="copyText(\'($请让角色保持情绪温和，避免极端偏执等负面情绪和恶意猜测怀疑，禁止频繁哭泣，禁止疯狂粗暴，人设遵守发展阶段，回顾人设面具中的情节，然后回复)\')">ooc/记忆</button><button class="cmd-btn" onclick="copyText(\'(＄xxx带着所有的记忆回到xxx年前，现在是xxx年)\')">穿越梗</button><button class="cmd-btn" onclick="copyText(\'($文本采用双视角叙事，同时描述了我和男主两边的情况)\')">双视角剧情</button></div><div class="toast" id="toast">指令已复制</div><audio id="bgm"></audio><script>\nconst songs=[{title:"爱爱爱",url:"https://music.163.com/song/media/outer/url?id=5240523.mp3"},{title:"烈焰玫瑰",url:"https://music.163.com/song/media/outer/url?id=1971117689.mp3"},{title:"听雨",url:"https://music.163.com/song/media/outer/url?id=1867108106.mp3"},{title:"拉过勾的",url:"https://music.163.com/song/media/outer/url?id=2037142711.mp3"},{title:"一个人也OK",url:"https://music.163.com/song/media/outer/url?id=3338500692.mp3"},{title:"灰色系",url:"https://music.163.com/song/media/outer/url?id=2723432391.mp3"}];let currentIdx=0;const audio=document.getElementById(\'bgm\'),titleDisplay=document.getElementById(\'titleDisplay\'),playBtn=document.getElementById(\'playBtn\'),progBar=document.getElementById(\'progBar\'),playlistBox=document.getElementById(\'playlistBox\');songs.forEach((s,i)=>{let d=document.createElement(\'div\');d.className=\'song-item\';d.innerText=(i+1)+\'. \'+s.title;d.onclick=()=>loadTrack(i);playlistBox.appendChild(d)});function loadTrack(i){currentIdx=i;audio.src=songs[i].url;titleDisplay.innerText=songs[i].title;Array.from(playlistBox.children).forEach((c,x)=>c.className=x===i?\'song-item active\':\'song-item\');audio.play().then(updatePlayBtn).catch(()=>{})}function updatePlayBtn(){const icon=document.getElementById(\'playIcon\');if(audio.paused){icon.innerHTML=\'<path d="M8 5v14l11-7z"/>\'}else{icon.innerHTML=\'<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>\'}}function togglePlay(){if(audio.src){audio.paused?audio.play():audio.pause();updatePlayBtn()}else loadTrack(0)}function playPrev(){let i=currentIdx-1;if(i<0)i=songs.length-1;loadTrack(i)}function playNext(){let i=currentIdx+1;if(i>=songs.length)i=0;loadTrack(i)}audio.ontimeupdate=()=>{if(audio.duration)progBar.style.width=(audio.currentTime/audio.duration)*100+\'%\'};audio.onended=playNext;function copyText(t){if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(t).then(showToast);else{let a=document.createElement(\'textarea\');a.value=t;document.body.appendChild(a);a.select();document.execCommand(\'copy\');document.body.removeChild(a);showToast()}}function showToast(){let t=document.getElementById(\'toast\');t.classList.add(\'show\');setTimeout(()=>t.classList.remove(\'show\'),2000)}\n</script>\n</body>\n</html>';
export const WINTER_COPY_COMMANDS = Object.freeze([
  "($禁止男主频繁做爱，欲望降低50％)",
  "($严禁将【正文剧情】中发生的事件、对话，特别是涉及{<!-- -->{user}}的隐私、内心活动、未公开行动，作为【信息模块】中角色的聊天内容。群聊中的角色应对此完全不知情，他们的聊天内容应基于群聊本身的上下文，或他们自己在主线中公开可知的信息。)",
  "(${{char}}主动推剧情/$推动主线剧情发展，来到下一个设置好的关键剧情节点)",
  "($请让角色保持情绪温和，避免极端偏执等负面情绪和恶意猜测怀疑，禁止频繁哭泣，禁止疯狂粗暴，人设遵守发展阶段，回顾人设面具中的情节，然后回复)",
  "(＄xxx带着所有的记忆回到xxx年前，现在是xxx年)",
  "($文本采用双视角叙事，同时描述了我和男主两边的情况)",
] as const);
export const WINTER_COPY_HANDLERS = Object.freeze([
  "copyText('($禁止男主频繁做爱，欲望降低50％)')",
  "copyText('($严禁将【正文剧情】中发生的事件、对话，特别是涉及{<!-- -->{user}}的隐私、内心活动、未公开行动，作为【信息模块】中角色的聊天内容。群聊中的角色应对此完全不知情，他们的聊天内容应基于群聊本身的上下文，或他们自己在主线中公开可知的信息。)')",
  "copyText('(${{char}}主动推剧情/$推动主线剧情发展，来到下一个设置好的关键剧情节点)')",
  "copyText('($请让角色保持情绪温和，避免极端偏执等负面情绪和恶意猜测怀疑，禁止频繁哭泣，禁止疯狂粗暴，人设遵守发展阶段，回顾人设面具中的情节，然后回复)')",
  "copyText('(＄xxx带着所有的记忆回到xxx年前，现在是xxx年)')",
  "copyText('($文本采用双视角叙事，同时描述了我和男主两边的情况)')",
] as const);
export const WINTER_AUDIO_TRACKS = Object.freeze(
  [
    {
      title: "爱爱爱",
      url: "https://music.163.com/song/media/outer/url?id=5240523.mp3",
    },
    {
      title: "烈焰玫瑰",
      url: "https://music.163.com/song/media/outer/url?id=1971117689.mp3",
    },
    {
      title: "听雨",
      url: "https://music.163.com/song/media/outer/url?id=1867108106.mp3",
    },
    {
      title: "拉过勾的",
      url: "https://music.163.com/song/media/outer/url?id=2037142711.mp3",
    },
    {
      title: "一个人也OK",
      url: "https://music.163.com/song/media/outer/url?id=3338500692.mp3",
    },
    {
      title: "灰色系",
      url: "https://music.163.com/song/media/outer/url?id=2723432391.mp3",
    },
  ].map((track) => Object.freeze(track)),
);

function record(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return (
    (proto === Object.prototype || proto === null) &&
    Reflect.ownKeys(value).every(
      (key) =>
        typeof key === "string" &&
        !Object.getOwnPropertyDescriptor(value, key)?.get &&
        !Object.getOwnPropertyDescriptor(value, key)?.set,
    )
  );
}
const only = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key));
export function isKnownWinterToolboxDocument(value: unknown): value is string {
  return value === WINTER_OPAQUE_DOCUMENT;
}
export function validKnownWinterMusic(value: unknown): boolean {
  if (
    !record(value) ||
    Object.keys(value).length !== 6 ||
    !only(value, [
      "version",
      "variant",
      "shellHtml",
      "css",
      "documents",
      "framePresentation",
    ])
  )
    return false;
  return (
    value.version === 1 &&
    value.variant === "winter-music-v9" &&
    value.shellHtml === WINTER_MUSIC_SHELL &&
    value.css === WINTER_MUSIC_CSS &&
    Array.isArray(value.documents) &&
    value.documents.length === 1 &&
    Reflect.ownKeys(value.documents).length === 2 &&
    !Object.getOwnPropertyDescriptor(value.documents, "0")?.get &&
    !Object.getOwnPropertyDescriptor(value.documents, "0")?.set &&
    isKnownWinterToolboxDocument(
      Object.getOwnPropertyDescriptor(value.documents, "0")?.value,
    ) &&
    record(value.framePresentation) &&
    Object.keys(value.framePresentation).length === 2 &&
    only(value.framePresentation, ["minHeight", "borderRadius"]) &&
    value.framePresentation.minHeight === 420 &&
    value.framePresentation.borderRadius === 12
  );
}
/** Source45vh centred anchor, not a full-screen iframe. Sourcez999 maps below modals. */
export function winterMusicBox(open: boolean) {
  return {
    position: "fixed" as const,
    top: "45vh",
    right: open ? 0 : 5,
    width: open ? 280 : 60,
    height: open ? 420 : 60,
    transform: "translateY(-50%)",
    zIndex: 45,
    pointerEvents: "none" as const,
  };
}
export const WINTER_MUSIC_COORDINATES = `:host{all:initial;display:block;width:100%;height:100%;pointer-events:none}
[data-character-css="opening"]{width:100%;height:100%}
details.censy-winter-music-sidebar{position:absolute!important;right:0!important;top:0!important;width:100%!important;height:100%!important;transform:none!important;margin:0!important;box-sizing:border-box!important}
details.censy-winter-music-sidebar>summary,.censy-winter-content-v9{pointer-events:auto}
details.censy-winter-music-sidebar:not([open]) .censy-winter-content-v9{display:none}
[data-nj-native-documents]>div{padding:0!important;width:100%;box-sizing:border-box}
[data-nj-native-documents] iframe{display:block;width:100%;height:420px;min-height:420px;border:0}
summary:focus-visible{outline:2px solid currentColor;outline-offset:2px}`;
