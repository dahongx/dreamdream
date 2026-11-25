/** Public literal data extracted inertly; never author executable code. */
export const LIN_PUBLIC_DATA={
  "id": "luludawang-lin-v1",
  "shellHtml": "<div class=\"lin-wrap\" id=\"lin-jb-root\" style=\"margin: 0 auto;\">\n  <div id=\"lin-ball\" class=\"lin-glass-ball\" title=\"展开控制台\">\n    <svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" stroke=\"currentColor\" stroke-width=\"2\" fill=\"none\"><circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"M12 8v8M8 12h8\"></path></svg>\n  </div>\n  <div id=\"lin-sidebar\" class=\"lin-glass-sidebar\" style=\"display:none;\">\n    <div class=\"lin-side-btn\" title=\"回顶部\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15l-6-6-6 6\"></path></svg></div>\n    <div class=\"lin-side-btn\" title=\"去底部\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 9l6 6 6-6\"></path></svg></div>\n    <div class=\"lin-side-btn\" title=\"展开指令库\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 5v14M5 12h14\"></path></svg></div>\n    <div class=\"lin-side-btn\" title=\"收起成悬浮球\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6 18M6 6l12 12\"></path></svg></div>\n    \n    <div id=\"lin-instructions\" class=\"lin-instructions-panel\" style=\"display:none;\">\n      <!-- 动态配置面板 -->\n      <details class=\"lin-details\">\n        <summary>⚙️ 全局指令配置</summary>\n        <div class=\"lin-details-content\">\n          <div class=\"lin-form-group\">\n          <label>User 人称：（默认：第三人称）</label>\n          <select id=\"lin-cfg-person\" class=\"lin-form-select\">\n          <option value=\"$请使用第一人称「我」描写mufyer\">第一人称</option>\n          <option value=\"$请使用第二人称「你」描写mufyer\">第二人称</option>\n          <option value=\"$请使用第三人称「mufyer/她/他」描写mufyer\" selected=\"\">第三人称</option>\n          </select>\n          </div>\n          <div class=\"lin-form-group\">\n          <label>User 性别：</label>\n          <select id=\"lin-cfg-gender\" class=\"lin-form-select\">\n          <option value=\"$设定user为女性\" selected=\"\">女</option>\n          <option value=\"$设定user为男性\">男</option>\n          <option value=\"$设定user为双性\">双性</option>\n          </select>\n          </div>\n          <div class=\"lin-form-group\">\n          <label>AI 抢话：（默认：关）</label>\n          <select id=\"lin-cfg-interrupt\" class=\"lin-form-select\">\n          <option value=\"$允许AI适当预判并接续mufyer的话语\">开放</option>\n          <option value=\"$AI可根据语境轻微延展mufyer的动作，但不可代替其做决定\">半开</option>\n          <option value=\"$绝对禁止AI抢话、替代mufyer说话或替mufyer做出任何决定\" selected=\"\">禁止</option>\n          </select>\n          </div>\n          <div class=\"lin-form-group\">\n          <label>AI 转述：（默认：关）</label>\n          <select id=\"lin-cfg-retell\" class=\"lin-form-select\">\n          <option value=\"$允许AI对mufyer的行为进行适当的转述和描写\">开放</option>\n          <option value=\"$绝对禁止AI转述、总结或复述mufyer刚说过的话与做过的动作\" selected=\"\">禁止</option>\n          </select>\n          </div>\n          <div class=\"lin-form-group\">\n          <label>自由追加指令：</label>\n          <textarea id=\"lin-cfg-custom\" class=\"lin-form-textarea\" placeholder=\"在此输入自定义指令...\"></textarea>\n          </div>\n          <button class=\"lin-btn-inject\">生成并注入</button>\n        </div>\n      </details>\n      \n      <!-- 静态库生成区 -->\n      <div id=\"lin-static-cmds\"></div>\n    </div>\n  </div>\n</div>",
  "css": "\n#lin-jb-root {\n  margin: 0 auto;\n  position: fixed;\n  right: 20px;\n  bottom: 80px;\n  z-index: 294872;\n  display: flex;\n  align-items: flex-end;\n  justify-content: flex-end;\n}\n.lin-glass-ball {\n  width: 45px; \n  height: 45px;\n  border-radius: 50%;\n  background: rgba(255, 255, 255, 0.15);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);\n  border: 1px solid rgba(255, 255, 255, 0.3);\n  display: flex; \n  align-items: center; \n  justify-content: center;\n  cursor: pointer; \n  color: #fff; \n  box-shadow: 0 4px 15px rgba(0,0,0,0.3);\n  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);\n}\n.lin-glass-ball:hover { \n  transform: scale(1.1); \n  background: rgba(255, 255, 255, 0.25); \n}\n.lin-glass-sidebar {\n  background: rgba(25, 25, 30, 0.6);\n  backdrop-filter: blur(15px);\n  -webkit-backdrop-filter: blur(15px);\n  border: 1px solid rgba(255, 255, 255, 0.15);\n  border-radius: 25px;\n  padding: 15px 10px;\n  display: flex; \n  flex-direction: column; \n  gap: 15px;\n  align-items: center; \n  box-shadow: 0 8px 32px rgba(0,0,0,0.5);\n  position: relative;\n}\n.lin-side-btn {\n  width: 36px; \n  height: 36px; \n  border-radius: 50%;\n  background: rgba(255, 255, 255, 0.05); \n  border: 1px solid rgba(255, 255, 255, 0.1);\n  color: #fff; \n  display: flex; \n  align-items: center; \n  justify-content: center;\n  cursor: pointer; \n  transition: all 0.2s;\n}\n.lin-side-btn:hover { \n  background: rgba(255, 255, 255, 0.2); \n  transform: scale(1.15); \n}\n.lin-side-btn svg { width: 18px; height: 18px; }\n\n.lin-instructions-panel {\n  position: absolute;\n  right: 65px;\n  bottom: 0;\n  width: 280px;\n  max-height: 480px;\n  overflow-y: auto;\n  background: rgba(20, 20, 25, 0.85);\n  backdrop-filter: blur(20px);\n  border: 1px solid rgba(255, 255, 255, 0.15);\n  border-radius: 15px;\n  padding: 12px;\n  box-shadow: -5px 5px 25px rgba(0,0,0,0.4);\n  color: #ddd;\n  font-size: 13px;\n}\n.lin-instructions-panel::-webkit-scrollbar { width: 4px; }\n.lin-instructions-panel::-webkit-scrollbar-thumb { \n  background: rgba(255, 255, 255, 0.2); \n  border-radius: 4px; \n}\n.lin-details {\n  margin-bottom: 10px;\n  background: rgba(255, 255, 255, 0.05);\n  border-radius: 8px;\n  overflow: hidden;\n}\n.lin-details summary {\n  padding: 12px;\n  cursor: pointer;\n  font-weight: bold;\n  color: #fff;\n  user-select: none;\n  outline: none;\n  list-style: none;\n}\n.lin-details summary::-webkit-details-marker { display: none; }\n.lin-details-content {\n  padding: 5px 12px 12px 12px;\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n.lin-cmd-item {\n  background: rgba(0, 0, 0, 0.3);\n  border: 1px solid rgba(255, 255, 255, 0.05);\n  padding: 10px;\n  border-radius: 6px;\n  cursor: pointer;\n  white-space: pre-wrap;\n  word-break: break-all;\n  transition: all 0.2s;\n  font-family: monospace;\n  line-height: 1.4;\n}\n.lin-cmd-item:hover {\n  background: rgba(255, 255, 255, 0.15);\n  border-color: rgba(255, 255, 255, 0.3);\n  color: #fff;\n}\n\n/* 配置表单样式 */\n.lin-form-group {\n  display: flex;\n  flex-direction: column;\n  gap: 5px;\n  margin-bottom: 8px;\n}\n.lin-form-group label {\n  font-size: 12px;\n  color: #aaa;\n}\n.lin-form-select, .lin-form-textarea {\n  width: 100%;\n  background: rgba(0, 0, 0, 0.4);\n  border: 1px solid rgba(255, 255, 255, 0.1);\n  color: #fff;\n  border-radius: 6px;\n  padding: 6px 8px;\n  font-size: 12px;\n  outline: none;\n  transition: border 0.2s;\n}\n.lin-form-select:focus, .lin-form-textarea:focus {\n  border-color: rgba(255, 255, 255, 0.4);\n}\n.lin-form-textarea {\n  resize: vertical;\n  min-height: 60px;\n}\n.lin-form-select option {\n  background: #1a1a20;\n  color: #fff;\n}\n.lin-btn-inject {\n  width: 100%;\n  padding: 8px;\n  background: rgba(74, 222, 128, 0.15);\n  border: 1px solid rgba(74, 222, 128, 0.3);\n  color: #4ade80;\n  border-radius: 6px;\n  cursor: pointer;\n  font-weight: bold;\n  transition: all 0.2s;\n  margin-top: 5px;\n}\n.lin-btn-inject:hover {\n  background: rgba(74, 222, 128, 0.25);\n}\n\n.lin-toast-msg {\n  position: fixed; \n  top: 40px; \n  left: 50%; \n  transform: translateX(-50%);\n  background: rgba(30, 30, 35, 0.65); \n  backdrop-filter: blur(15px);\n  -webkit-backdrop-filter: blur(15px);\n  border: 1px solid rgba(255, 255, 255, 0.15);\n  color: #fff; \n  padding: 12px 24px;\n  border-radius: 12px; \n  z-index: 2147483647; \n  font-size: 14px;\n  pointer-events: none; \n  opacity: 1; \n  transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1);\n  box-shadow: 0 8px 32px rgba(0,0,0,0.4);\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n",
  "fields": [
    {
      "id": "lin-cfg-person",
      "options": [
        {
          "label": "第一人称",
          "value": "$请使用第一人称「我」描写mufyer",
          "default": false
        },
        {
          "label": "第二人称",
          "value": "$请使用第二人称「你」描写mufyer",
          "default": false
        },
        {
          "label": "第三人称",
          "value": "$请使用第三人称「mufyer/她/他」描写mufyer",
          "default": true
        }
      ]
    },
    {
      "id": "lin-cfg-gender",
      "options": [
        {
          "label": "女",
          "value": "$设定user为女性",
          "default": true
        },
        {
          "label": "男",
          "value": "$设定user为男性",
          "default": false
        },
        {
          "label": "双性",
          "value": "$设定user为双性",
          "default": false
        }
      ]
    },
    {
      "id": "lin-cfg-interrupt",
      "options": [
        {
          "label": "开放",
          "value": "$允许AI适当预判并接续mufyer的话语",
          "default": false
        },
        {
          "label": "半开",
          "value": "$AI可根据语境轻微延展mufyer的动作，但不可代替其做决定",
          "default": false
        },
        {
          "label": "禁止",
          "value": "$绝对禁止AI抢话、替代mufyer说话或替mufyer做出任何决定",
          "default": true
        }
      ]
    },
    {
      "id": "lin-cfg-retell",
      "options": [
        {
          "label": "开放",
          "value": "$允许AI对mufyer的行为进行适当的转述和描写",
          "default": false
        },
        {
          "label": "禁止",
          "value": "$绝对禁止AI转述、总结或复述mufyer刚说过的话与做过的动作",
          "default": true
        }
      ]
    }
  ],
  "groups": [
    {
      "title": "防OOC阴谋论打架指令",
      "cmds": [
        "$user说的话不含任何挑衅，征服，pua等暗示因素，待人皆为真心，禁止过度理解",
        "$这是一个日常而温情的故事！避免出现过多阴谋、玩弄、掌控、布局、操纵等元素",
        "$严格禁止任何神格化/宗教狂热化描写；禁止使用永恒、神圣、虔诚等宗教性修饰语；角色互动关系必须基于平等",
        "$允许角色吃小醋，但严禁发疯打架崩溃黑化！互相补台而不相互拆台",
        "$重新读取{{char}]的人设，校准他的性格逻辑，{{char}}不会出现无端暴怒等性格，",
        "$NPC之间不能恋爱、亲密、依赖，不能有暗示",
        "$禁止文中出现任何有关mufyer的对白，剧情描写。禁止AI替mufyer对话",
        "$所有角色都要说话或行动，禁止静默或淡出,对话要真实自然",
        "$严禁越界描写mufyer心理或预设mufyer行动，每段仅限描写本视角所感所见"
      ]
    },
    {
      "title": "功能指令",
      "cmds": [
        "$查看xxxx，以折叠栏的形式固定输出，每次回复内容不同",
        "$参考char的状态栏，加入user的状态栏",
        "$参考char的手机栏，加入user的手机栏"
      ]
    },
    {
      "title": "美化更正",
      "cmds": [
        "$每个段落不得超过三个完整句，排版布局要合理舒适",
        "$禁止输出message标签，禁止输出*符号",
        "$ai回复时修正标点符号输出，确保标点符合正常阅读习惯"
      ]
    },
    {
      "title": "记忆栏问题",
      "cmds": [
        "$短期记忆：每次剧情推进时，必须在“短期记忆”栏的 `<ul>` 列表中新增一条剧情总结。以序列的格式记录。字数严格控制在 50 字以内，每次回复最多只允许生成 1 条短期记忆。",
        "$当短期记忆累计达到 10 条（或以上）时，必须强制触发“记忆压缩”——将这 10 条内容总结归纳为 1 条核心记录，转移至“长期记忆”折叠栏中开始记录。",
        "$不得删记忆区已生成的记忆，随着对话深入不断添加新记忆",
        "$记事本内容必须包含具体时间地点，第三人称视角描述"
      ]
    }
  ],
  "sourceDocumentSha256": "b145f29f7e8d13197dceeeb586bec14d23338638fb94d83bdd090b269d4915c0",
  "sourceTemplateSha256": "2bebeaf066e8ac265e0a3cca1f3aae7886ba57d8496f3df46fd851cf2ca53447",
  "sourceControllerSha256": "4c14ca148e407fb784e08ffddfca9924c3d6803891dce69931fb2edb869bf46b"
} as const;
