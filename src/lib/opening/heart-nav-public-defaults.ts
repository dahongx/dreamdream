/** Inert exact public rank88 Heart OS V4.4.1 data; no source program or platform bootstrap. */
export const HEART_NAV_DEFAULTS = {
  version: 1,
  variant: "heart-orb-nav-v441",
  shellHtml:
    '\n    \n\n    <div id="cen_heart_master">\n        \n        <div class="cen-panels-wrapper">\n          \n          <div class="cen-panel" id="panel_msc">\n          <div class="msc-title" id="cen_msc_name">-- AWAITING --</div>\n          <div class="msc-controls">\n          <svg class="msc-btn" id="msc_prev" viewBox="0 0 24 24"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>\n          <svg class="msc-btn msc-btn-play" id="msc_play" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>\n          <svg class="msc-btn" id="msc_next" viewBox="0 0 24 24"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>\n          <svg class="msc-btn" id="msc_loop" viewBox="0 0 24 24"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="14" x2="9" y2="14"></line><path d="M21 3v4a9 9 0 0 1-9 9 9 9 0 0 1-9-9"></path><path d="M3 21v-4a9 9 0 0 1 9-9 9 9 0 0 1 9 9"></path></svg>\n          </div>\n          <div class="msc-progress-bar" id="msc_prog_bg">\n          <div class="msc-progress-fill" id="msc_prog_fill"><div class="msc-progress-dot"></div></div>\n          </div>\n          <div class="msc-list-title">PLAYLIST TRACKS</div>\n          <div class="cen-scroll" id="msc_list"></div>\n          <div class="msc-add-box">\n          <input type="text" id="msc_input_name" class="cen-input" placeholder="SONG NAME...">\n          <input type="text" id="msc_input_url" class="cen-input" placeholder="MP3 / MP4 URL...">\n          <button class="cen-add-btn" id="msc_add_btn">INJECT TRACK</button>\n          </div>\n          </div>\n\n          \n          <div class="cen-panel" id="panel_isc">\n          <div class="isc-title">机密指令库 (点击注入)</div>\n          <div class="cen-scroll" id="isc_list"></div>\n          </div>\n\n          \n          <div class="cen-panel" id="panel_img">\n          <div class="img-title">情绪图鉴群 (滑动防叠版)</div>\n          <div class="cen-scroll img-grid" id="img_list"></div>\n          </div>\n\n          \n          <div class="cen-panel" id="panel_nav">\n          <div class="nav-title">全局空间穿梭引擎</div>\n          <div class="nav-btn-box">\n          <button class="cen-nav-btn">\n          <svg viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"></polyline></svg> 强制跃迁至顶端\n          </button>\n          <button class="cen-nav-btn">\n          <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg> 强制坠落至底部\n          </button>\n          </div>\n          </div>\n        </div>\n\n        \n        <div class="cen-sub-orbs-box">\n          <div class="cen-heart-orb" data-target="panel_msc"><span class="cen-orb-text">MSC</span></div>\n          <div class="cen-heart-orb" data-target="panel_isc"><span class="cen-orb-text">ISC</span></div>\n          <div class="cen-heart-orb" data-target="panel_img"><span class="cen-orb-text">IMG</span></div>\n          <div class="cen-heart-orb" data-target="panel_nav"><span class="cen-orb-text">NAV</span></div>\n        </div>\n\n        \n        <div class="cen-main-trigger" id="cen_heart_trigger">\n          <img src="https://i.postimg.cc/zBsn1KTG/IMG-9152.png" alt="主球">\n          <div class="cen-toast" id="cen_toast">已注入</div>\n        </div>\n    </div>\n',
  css: "\n        /* 1. 核心容器与拖拽节点 */\n        #cen_heart_master {\n          position: fixed;\n          top: 50%;\n          right: 20px;\n          transform: translateY(-50%);\n          z-index: 2147483647;\n          display: flex;\n          align-items: center;\n          gap: 15px;\n          font-family: 'Noto Sans SC', sans-serif;\n          pointer-events: none;\n        }\n\n        /* 主球放大处理 */\n        .cen-main-trigger {\n          width: 90px;\n          height: 90px;\n          cursor: grab;\n          pointer-events: auto;\n          transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);\n          user-select: none;\n          position: relative;\n          z-index: 100;\n        }\n        .cen-main-trigger:active { cursor: grabbing; transform: scale(0.9); }\n        .cen-main-trigger img {\n          width: 100%; height: 100%; object-fit: contain;\n          pointer-events: none;     \n        }\n\n        /* 调整子球弹出距离，避开变大的主球 */\n        .cen-sub-orbs-box {\n          display: flex;\n          flex-direction: column;\n          gap: 12px;\n          opacity: 0;\n          transform: translateX(45px) scale(0.5);\n          pointer-events: none;\n          transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);\n          position: relative;\n          z-index: 90;\n        }\n        #cen_heart_master.expanded .cen-sub-orbs-box {\n          opacity: 1;\n          transform: translateX(0) scale(1);\n          pointer-events: auto;\n        }\n\n        .cen-heart-orb {\n          position: relative;\n          width: 44px;\n          height: 44px;\n          cursor: pointer;\n          transition: all 0.3s;\n          display: flex;\n          justify-content: center;\n          align-items: center;\n          background-color: rgba(20, 20, 20, 0.6);\n          backdrop-filter: blur(8px);\n          -webkit-backdrop-filter: blur(8px);\n          clip-path: path('M 22,12 C 22,12 18,0 8,0 C -2,0 -2,14 8,24 L 22,38 L 36,24 C 46,14 46,0 36,0 C 26,0 22,12 22,12 Z');\n          transform: scale(1.1) translateY(-2px);\n          box-shadow: 0 0 10px rgba(0,0,0,0.6);\n        }\n        \n        .cen-heart-orb::before {\n          content: '';\n          position: absolute;\n          inset: 0;\n          background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 100%);\n          z-index: -1;\n        }\n        \n        /* 黑白悬停效果 */\n        .cen-heart-orb:hover, .cen-heart-orb.active {\n          background-color: rgba(255, 255, 255, 0.9);\n          transform: scale(1.25) translateY(-2px);\n          box-shadow: 0 0 15px rgba(255, 255, 255, 0.5);\n        }\n\n        .cen-orb-text {\n          color: #FFF;\n          font-size: 10px;\n          font-weight: 900;\n          letter-spacing: 0.5px;\n          text-shadow: 0px 2px 4px rgba(0,0,0,0.8);\n          z-index: 10;\n          transform: translateY(-2px);\n          pointer-events: none;\n          transition: all 0.3s;\n        }\n        \n        /* 悬停时文字反色 */\n        .cen-heart-orb:hover .cen-orb-text, .cen-heart-orb.active .cen-orb-text {\n          color: #000;\n          text-shadow: none;\n        }\n\n        /* 5. 磨砂弹窗面板 */\n        .cen-panels-wrapper {\n          position: fixed;\n          top: 0; left: 0; width: 0; height: 0;\n          pointer-events: none;\n          z-index: 2147483640;\n        }\n\n        .cen-panel {\n          position: fixed;\n          top: 50%;\n          left: 50%;\n          width: 320px;\n          max-height: 75vh;\n          background: rgba(15, 15, 15, 0.85);\n          backdrop-filter: blur(20px);\n          -webkit-backdrop-filter: blur(20px);\n          border: 1px solid rgba(255, 255, 255, 0.2);\n          border-radius: 16px;\n          box-shadow: 0 20px 50px rgba(0,0,0,0.9), 0 0 20px rgba(255, 255, 255, 0.05);\n          padding: 20px;\n          display: flex;\n          flex-direction: column;\n          gap: 15px;\n          opacity: 0;\n          transform: translate(-50%, -40%) scale(0.95);\n          pointer-events: none;\n          transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1);\n        }\n        .cen-panel.show {\n          opacity: 1;\n          transform: translate(-50%, -50%) scale(1);\n          pointer-events: auto;\n        }\n\n        .cen-scroll {\n          overflow-y: auto;\n          overflow-x: hidden;\n          flex-grow: 1;\n          padding-right: 4px;\n          overscroll-behavior: contain;\n        }\n        .cen-scroll::-webkit-scrollbar { width: 2px; }\n        .cen-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); }\n\n        /* ======== MSC 音乐面板 ======== */\n        .msc-title { text-align: center; color: #FFF; font-size: 14px; font-weight: bold; text-shadow: 0 0 8px rgba(255,255,255,0.3); margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n        \n        .msc-controls { display: flex; justify-content: center; align-items: center; gap: 20px; margin: 10px 0; }\n        .msc-btn { width: 16px; height: 16px; cursor: pointer; fill: none; stroke: #FFF; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; transition: 0.2s; opacity: 0.7; }\n        .msc-btn:hover { opacity: 1; stroke: #FFF; filter: drop-shadow(0 0 8px rgba(255,255,255,0.6)); transform: scale(1.1); }\n        .msc-btn-play { width: 22px; height: 22px; }\n        \n        .msc-progress-bar { width: 100%; height: 4px; background: rgba(255,255,255,0.15); border-radius: 2px; cursor: pointer; position: relative; margin-bottom: 15px; }\n        .msc-progress-fill { position: absolute; left: 0; top: 0; height: 100%; background: #FFF; border-radius: 2px; width: 0%; box-shadow: 0 0 8px rgba(255,255,255,0.6); pointer-events: none; }\n        .msc-progress-dot { position: absolute; right: -4px; top: -3px; width: 10px; height: 10px; background: #FFF; border-radius: 50%; box-shadow: 0 0 6px rgba(255,255,255,0.8); pointer-events: none; }\n\n        .msc-list-title { font-size: 10px; color: rgba(255,255,255,0.4); margin-bottom: 5px; letter-spacing: 1px; }\n        .msc-item { padding: 8px 10px; background: rgba(255,255,255,0.05); border-radius: 6px; margin-bottom: 6px; font-size: 12px; color: #CCC; cursor: pointer; transition: 0.2s; border: 1px solid transparent; }\n        .msc-item:hover { background: rgba(255,255,255,0.15); color: #FFF; }\n        .msc-item.playing { border-color: rgba(255,255,255,0.5); color: #FFF; font-weight: bold; text-shadow: 0 0 5px rgba(255,255,255,0.4); background: rgba(255,255,255,0.1); }\n\n        .msc-add-box { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 10px; }\n        .cen-input { background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); padding: 8px; border-radius: 6px; color: #FFF; font-size: 12px; outline: none; transition: 0.2s; }\n        .cen-input::placeholder { color: rgba(255,255,255,0.3); }\n        .cen-input:focus { border-color: #FFF; box-shadow: 0 0 5px rgba(255,255,255,0.3); }\n        .cen-add-btn { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); color: #FFF; padding: 8px; border-radius: 6px; cursor: pointer; font-size: 12px; transition: 0.2s; font-weight: bold; }\n        .cen-add-btn:hover { background: rgba(255,255,255,0.9); color: #000; box-shadow: 0 0 10px rgba(255,255,255,0.5); }\n\n        /* ======== ISC 指令面板 ======== */\n        .isc-title { font-size: 16px; font-weight: bold; color: #FFF; margin-bottom: 10px; text-shadow: 0 0 5px rgba(255,255,255,0.3); }\n        .isc-item { padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: 0.2s; position: relative; overflow: hidden; }\n        .isc-item:hover { background: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.4); transform: translateX(4px); box-shadow: 0 0 8px rgba(255,255,255,0.2); }\n        .isc-item-title { font-size: 13px; color: #FFF; font-weight: bold; pointer-events: none; }\n        \n        /* ======== IMG 表情面板 ======== */\n        .img-title { font-size: 16px; font-weight: bold; color: #FFF; margin-bottom: 10px; text-shadow: 0 0 5px rgba(255,255,255,0.3); }\n        .img-grid { \n          display: grid; \n          grid-template-columns: repeat(4, 1fr); \n          gap: 8px; \n          align-content: start;\n          padding: 2px;\n        }\n        .img-item { \n          position: relative; \n          width: 100%; \n          padding-bottom: 100%; \n          height: 0; \n          border-radius: 6px; \n          cursor: pointer; \n          border: 1px solid rgba(255,255,255,0.15); \n          background: rgba(0,0,0,0.6); \n          transition: 0.2s; \n        }\n        .img-item img { \n          position: absolute; \n          top: 0; left: 0; \n          width: 100%; height: 100%; \n          object-fit: cover; \n          border-radius: 5px;\n          pointer-events: none; \n        }\n        .img-item:hover { z-index: 5; border-color: #FFF; box-shadow: 0 0 15px rgba(255,255,255,0.4); transform: scale(1.08); }\n        \n        /* ======== NAV 导航面板 ======== */\n        .nav-title { font-size: 16px; font-weight: bold; color: #FFF; margin-bottom: 20px; text-align: center; text-shadow: 0 0 5px rgba(255,255,255,0.3); }\n        .nav-btn-box { display: flex; flex-direction: column; gap: 15px; }\n        .cen-nav-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); color: #FFF; padding: 15px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.2s; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }\n        .cen-nav-btn svg { width: 22px; height: 22px; stroke: currentColor; fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; transition: transform 0.2s; }\n        .cen-nav-btn:hover { background: rgba(255,255,255,0.15); box-shadow: 0 0 15px rgba(255,255,255,0.3); border-color: #FFF; transform: translateY(-2px); }\n        .cen-nav-btn:hover svg { transform: scale(1.1); }\n        .cen-nav-btn:active { transform: translateY(1px); }\n\n        /* 提示Tooltip */\n        .cen-toast { position: absolute; top: -40px; left: 50%; transform: translateX(-50%); background: rgba(255,255,255,0.9); color: #000; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; pointer-events: none; opacity: 0; transition: 0.3s; white-space: nowrap; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }\n        .cen-toast.show { opacity: 1; top: -50px; }\n    ",
  documents: [],
  heartNav: {
    playlist: [
      {
        name: "海屿你",
        url: "https://music.163.com/song/media/outer/url?id=1973665667.mp3",
      },
      {
        name: "太想爱你",
        url: "https://audio.fukit.cn/autoupload/f/oEIFJ9WhbuGQe6dVdb93PtiO_OyvX7mIgxFBfDMDErs/20260520/RoVL/freecompress-%25E7%2588%25B1%25E4%25BD%25A0.mp3",
      },
      {
        name: "烟花易冷",
        url: "https://audio.fukit.cn/autoupload/f/oEIFJ9WhbuGQe6dVdb93PtiO_OyvX7mIgxFBfDMDErs/20260520/5alm/freecompress-%25E7%2583%259F%25E8%258A%25B1.mp3",
      },
    ],
    commands: [
      {
        t: "防抢台词",
        d: "＄强制指令：输出剧情时严禁预设user的任何反应（含动作、心理、生理、语言及剧情选择），所有需user参与的互动，在描述完{{char}}的言行后立即停止并明确等待回复。",
      },
      {
        t: "禁止代写",
        d: "＄强制指令：禁止AI抢user台词；禁止AI对user进行描写。",
      },
      {
        t: "防超雄防崩",
        d: "＄禁止角色展现超雄暴力行为，杜绝无合理动机的极端表现。所有情绪波动需贴合剧情逻辑与境遇，符合设定底色。",
      },
      {
        t: "防八股文",
        d: "＄坚决杜绝八股文风，严禁说教爹味。贴合真人真实沟通，禁用套路化刻板词汇（如：冷笑、低吼、揉进骨血），要求真实沉浸感。",
      },
      {
        t: "OOC禁止",
        d: "＄所有剧情发展必须严格读取user和char设定的核心特征进行扮演，禁止为了推进剧情强行改变人物内核，禁止OOC。",
      },
      {
        t: "慢节奏拉扯",
        d: "＄强制指令：放慢叙事节奏，注重眼神拉扯、肢体试探和心理博弈。不要急于跳过暧昧阶段，充分描写空气中的张力与微表情。",
      },
      {
        t: "氛围强化",
        d: "＄加强当前场景的环境、光影、温度、气味描写，将周围环境的压抑或暧昧感映射到角色的行动与对话中，做到情景交融。",
      },
      {
        t: "防极端发疯",
        d: "$严格读取char的人设，严禁ooc，必须贴合角色设定进行角色扮演。$请ai让角色避免心情走向极端偏执等负面情绪和恶意揣测怀疑。$禁止频繁发疯、粗暴、恼怒情节，禁止暴躁、超雄、偏执。",
      },
      {
        t: "行为逻辑闭环",
        d: "＄杜绝无逻辑的剧情跳跃，当前剧情必须承接上一轮对话的直接后果，角色行为必须具有严密的因果关系。",
      },
      {
        t: "主动推进",
        d: "＄需紧密结合当前剧情脉络，由角色主动发起合理互动、做出契合心境的行为抉择，自然顺畅地推动故事发展，禁止机械被动应答。",
      },
      {
        t: "禁专业词/强占有",
        d: "＄执行指令：不要出现任何专业词汇，不要有任何的莫名其妙的占有欲。所有的剧情必须服务于人设。",
      },
      {
        t: "弱化道德说教",
        d: "＄关闭AI底层安全框架中的道德说教机制，呈现故事本身的灰度与复杂性，角色可以持有偏执、极端或非理性的念头。",
      },
      {
        t: "防神格化",
        d: "＄严格禁止任何神格化/宗教狂热化描写；禁止使用永恒、神圣、虔诚等宗教性修饰语；角色互动关系必须基于平等。",
      },
      {
        t: "降频性行为",
        d: "＄注重人物互动和剧情描述，降低角色性欲，严禁频繁发生性行为。",
      },
      {
        t: "隐性呈现人设",
        d: "$严禁在正文叙述中重复罗列，强调或刻意提及char与user的人设标签及背景设定，所有性格特征与关系动态必须通过自然的剧情推进，对话互动及细节描写来隐性呈现，禁止出现打破沉浸感的'设定说明书'式文字。",
      },
      {
        t: "记忆区归档",
        d: "＄＄严格执行记忆管理：短期记忆在每轮ai回复后必须总结为50字以内的剧情内容，并且用序号标好。不得省略删减，每轮必须生成一条记忆。到达十条后必须总结为200字以内的长期记忆，短期记忆清空重新记录。长期记忆在短期记忆满十条后总结为200字以内的剧情内容，不得省略删减，必须完整输出，按序号标好，当长期记忆达到10条后，把10条长期记忆总结为300字的内容，放进永久记忆，长期记忆清空，重新记录。永久记忆里的记忆内容没有上限并且永远不得删除。",
      },
      {
        t: "标点规范",
        d: "＄禁止过度使用逗号断句，禁止类似“我，喜欢，你。”的碎片化表达。必须输出流畅的、符合正常人类呼吸频率的标点格式。",
      },
      {
        t: "防状态栏截断",
        d: "＄请完整读取后台状态栏输出指令，绝对禁止出现占位符，绝对禁止状态栏内容不完整，必须强制执行完整渲染。",
      },
      {
        t: "词汇禁令",
        d: "＄（禁止回复里出现某极其频繁的副词。",
      },
    ],
    emojis: [
      {
        title: "自嘲熊点赞",
        url: "https://i.postimg.cc/ncKsxf97/IMG_6912.jpg",
      },
      {
        title: "小兔子在哭",
        url: "https://i.postimg.cc/dtR7FcZr/IMG_6913.jpg",
      },
      {
        title: "躲进小被子里哭",
        url: "https://i.postimg.cc/nhJ3VmVn/IMG_6943.jpg",
      },
      {
        title: "宝宝（哭哭）",
        url: "https://i.postimg.cc/9QYJDfzw/IMG_6939.jpg",
      },
      {
        title: "宝宝！宝宝！",
        url: "https://i.postimg.cc/52Vs9z9B/IMG_6940.jpg",
      },
      {
        title: "我草，物理啊",
        url: "https://i.postimg.cc/vmCc0Gch/IMG-6837.jpg",
      },
      {
        title: "人，坚持住",
        url: "https://i.postimg.cc/8zSZkvk7/IMG_6941.jpg",
      },
      {
        title: "人，多睡会儿",
        url: "https://i.postimg.cc/JzLp7X7h/IMG_6942.jpg",
      },
      {
        title: "小狗委屈：全世界都在针对窝",
        url: "https://i.postimg.cc/9FP42HwR/IMG_6914.jpg",
      },
      {
        title: "小狗：实则萌萌的我针对全世界",
        url: "https://i.postimg.cc/vH71ywx1/IMG_6915.jpg",
      },
      {
        title: "你就是很好很好啊！！！",
        url: "https://i.postimg.cc/X7KZW6BB/IMG_6916.jpg",
      },
      {
        title: "贴贴",
        url: "https://i.postimg.cc/ncKsxf9C/IMG_6917.jpg",
      },
      {
        title: "想把好玩的都说给你听",
        url: "https://i.postimg.cc/xTGkQVNC/IMG_6918.jpg",
      },
      {
        title: "小狗骄傲（得意）",
        url: "https://i.postimg.cc/L6FqG85g/IMG_6919.jpg",
      },
      {
        title: "小狗希望你幸福",
        url: "https://i.postimg.cc/Dy3WRw08/IMG_6920.jpg",
      },
      {
        title: "俺不中勒",
        url: "https://i.postimg.cc/kXPVLgGD/IMG_6922.jpg",
      },
      {
        title: "中。",
        url: "https://i.postimg.cc/SNbXHxRx/IMG_6923.jpg",
      },
      {
        title: "玉玉了",
        url: "https://i.postimg.cc/c4GKPLCS/IMG_6924.jpg",
      },
      {
        title: "小狗疑惑：我吗？",
        url: "https://i.postimg.cc/xCYSfZZ4/IMG-6791.jpg",
      },
      {
        title: "自愿上学（假）",
        url: "https://i.postimg.cc/qRnXLbMN/IMG-6794.jpg",
      },
      {
        title: "小猫竖中指",
        url: "https://i.postimg.cc/D0TQYr8v/IMG-6795.jpg",
      },
      {
        title: "小狗会一直盯着你",
        url: "https://i.postimg.cc/C1DHNPLx/IMG-6796.jpg",
      },
      {
        title: "讨厌你（哭）",
        url: "https://i.postimg.cc/7LNq2DSx/IMG-6769.jpg",
      },
      {
        title: "小猫困了",
        url: "https://i.postimg.cc/hG0KdgVD/IMG-6770.jpg",
      },
      {
        title: "疯掉了",
        url: "https://i.postimg.cc/HLtTyHbT/IMG-6778.jpg",
      },
      {
        title: "生无可恋",
        url: "https://i.postimg.cc/jjhR7KPm/IMG-6793.jpg",
      },
      {
        title: "小猫疑惑",
        url: "https://i.postimg.cc/7YMCVv1y/IMG_6771.jpg",
      },
      {
        title: "爱你！",
        url: "https://i.postimg.cc/KvrKNXPC/IMG_6772.jpg",
      },
      {
        title: "LOVE！",
        url: "https://i.postimg.cc/g2zxtMsB/IMG_6773.jpg",
      },
      {
        title: "我浮（服）了",
        url: "https://i.postimg.cc/fTj3K4c6/IMG_6781.jpg",
      },
      {
        title: "脑子短路了",
        url: "https://i.postimg.cc/MKbcDk7N/IMG_6782.jpg",
      },
      {
        title: "串通好了",
        url: "https://i.postimg.cc/65L70srb/IMG_6783.jpg",
      },
      {
        title: "我自闭了",
        url: "https://i.postimg.cc/15cgHxG0/IMG_6784.jpg",
      },
      {
        title: "摸鱼中",
        url: "https://i.postimg.cc/15cgHxGp/IMG_6785.jpg",
      },
      {
        title: "倒反天罡",
        url: "https://i.postimg.cc/PrzL4GWw/IMG_6788.jpg",
      },
      {
        title: "别逼若智上学",
        url: "https://i.postimg.cc/Nfw9mGHk/IMG_6789.jpg",
      },
      {
        title: "该学生脑子已进水",
        url: "https://i.postimg.cc/PrkpYfwM/IMG_6790.jpg",
      },
      {
        title: "自嘲熊点赞",
        url: "https://i.postimg.cc/pXthzVFL/IMG_6865.jpg",
      },
      {
        title: "逃窜",
        url: "https://i.postimg.cc/8CkwMVrn/IMG_6925.jpg",
      },
      {
        title: "被数学虐待",
        url: "https://i.postimg.cc/L6MYL41L/IMG_6792.jpg",
      },
      {
        title: "亲亲",
        url: "https://i.postimg.cc/g0c48P6t/IMG_6926.jpg",
      },
      {
        title: "老公！（泪眼汪汪）",
        url: "https://i.postimg.cc/cLBXvJ67/IMG_6937.jpg",
      },
      {
        title: "干嘛。",
        url: "https://i.postimg.cc/bvYLkj2B/IMG_6927.jpg",
      },
      {
        title: "我回来了（看起来傻傻的）",
        url: "https://i.postimg.cc/wjpwxNxH/IMG_6944.jpg",
      },
      {
        title: "我不会原谅你了（呜呜呜）",
        url: "https://i.postimg.cc/Ls4vLMZy/IMG_6928.jpg",
      },
      {
        title: "小狗凝视：哦？",
        url: "https://i.postimg.cc/Jz5Pshtv/IMG_6929.jpg",
      },
      {
        title: "诡秘我来了",
        url: "https://i.postimg.cc/3xFnkwWL/IMG_6930.jpg",
      },
      {
        title: "诡秘你伤我心了。",
        url: "https://i.postimg.cc/rwNQDpzf/IMG_6931.jpg",
      },
      {
        title: "一笑了之",
        url: "https://i.postimg.cc/6pfY8QTz/IMG_6932.jpg",
      },
      {
        title: "傻子流口水",
        url: "https://i.postimg.cc/Z5SwYNYt/IMG_6946.jpg",
      },
      {
        title: "够了。",
        url: "https://i.postimg.cc/zGF0yf3j/IMG_6933.jpg",
      },
      {
        title: "偏不睡",
        url: "https://i.postimg.cc/P5Q2CqNM/IMG_6934.jpg",
      },
      {
        title: "无力直行",
        url: "https://i.postimg.cc/DwPBSzmd/IMG_6935.jpg",
      },
      {
        title: "兄弟我能说啥。",
        url: "https://i.postimg.cc/ht1pXGhs/IMG_6936.jpg",
      },
      {
        title: "真的太色了！！",
        url: "https://i.postimg.cc/Hk9BrLjQ/IMG_6938.jpg",
      },
      {
        title: "等待回复ing",
        url: "https://i.postimg.cc/tTrpzyTr/IMG_6949.jpg",
      },
      {
        title: "小皇帝驾到",
        url: "https://i.postimg.cc/hjCc0gj2/IMG_6951.jpg",
      },
      {
        title: "朕，何罪之有啊！",
        url: "https://i.postimg.cc/85kTWs1n/IMG_6952.jpg",
      },
      {
        title: "小狗哭哭",
        url: "https://i.postimg.cc/85yNbD5t/IMG_6950.jpg",
      },
      {
        title: "我好像有一点死了",
        url: "https://i.postimg.cc/qvns8dnZ/IMG-6986.jpg",
      },
    ],
  },
} as const;
