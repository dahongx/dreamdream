// Inert data from exact public83 template/controller; never execute source scripts.
export const LIN_PUBLIC_DATA={
  "id": "luludawang-lin-83-v1",
  "shellHtml": "<div class=\"lin-wrap\" id=\"lin-jb-root\" style=\"margin: 0 auto;\">  \n  <div id=\"lin-ball\" class=\"lin-glass-ball\" title=\"长按拖拽 / 点击展开控制台\">    \n    <svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" stroke=\"currentColor\" stroke-width=\"2\" fill=\"none\"><circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"M12 8v8M8 12h8\"></path></svg>  \n  </div>  \n  <div id=\"lin-sidebar\" class=\"lin-glass-sidebar\" style=\"display:none;\">    \n    <div id=\"lin-drag-handle\" class=\"lin-sidebar-drag-handle\" title=\"按住此处拖拽面板\">\n      <div class=\"lin-sidebar-drag-line\"></div>\n    </div>\n    <div class=\"lin-side-btn\" title=\"回顶部\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15l-6-6-6 6\"></path></svg></div>    \n    <div class=\"lin-side-btn\" title=\"去底部\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 9l6 6 6-6\"></path></svg></div>    \n    <div class=\"lin-side-btn\" title=\"展开指令库\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 5v14M5 12h14\"></path></svg></div>    \n    <div class=\"lin-side-btn\" title=\"收起成悬浮球\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6 18M6 6l12 12\"></path></svg></div>        \n    \n    <div id=\"lin-instructions\" class=\"lin-instructions-panel\" style=\"display:none;\">      \n      <details class=\"lin-details\">\n        <summary>✍️ 自定义指令速发</summary>\n        <div class=\"lin-details-content\">\n          <div class=\"lin-form-group\">\n          <textarea id=\"lin-custom-quick\" class=\"lin-form-textarea\" placeholder=\"在此输入需要直接发送的一条或多条指令...\"></textarea>\n          </div>\n          <button class=\"lin-btn-inject\" id=\"lin-quick-inject\">确认并注入</button>\n        </div>\n      </details>\n\n      <details class=\"lin-details\">        \n        <summary>⚙️ 全局指令配置</summary>        \n        <div class=\"lin-details-content\">          \n          <div class=\"lin-form-group\">          \n          <label>User 人称：（默认：第三人称）</label>          \n          <select id=\"lin-cfg-person\" class=\"lin-form-select\">          \n          <option value=\"$请使用第一人称「我」描写mufyer\">第一人称</option>          \n          <option value=\"$请使用第二人称「你」描写mufyer\">第二人称</option>          \n          <option value=\"$请使用第三人称「mufyer/她/他」描写mufyer\" selected=\"\">第三人称</option>          \n          </select>          \n          </div>          \n          <div class=\"lin-form-group\">          \n          <label>User 性别：</label>          \n          <select id=\"lin-cfg-gender\" class=\"lin-form-select\">          \n          <option value=\"$设定mufyer为女性\" selected=\"\">女</option>          \n          <option value=\"$设定mufyer为男性\">男</option>          \n          <option value=\"$设定mufyer为双性\">双性</option>          \n          </select>          \n          </div>          \n          <div class=\"lin-form-group\">          \n          <label>AI 抢话：（默认：关）</label>          \n          <select id=\"lin-cfg-interrupt\" class=\"lin-form-select\">          \n          <option value=\"$允许AI适当预判并接续mufyer的话语\">开放</option>          \n          <option value=\"$AI可根据语境轻微延展mufyer的动作，但不可代替其做决定\">半开</option>          \n          <option value=\"$绝对禁止AI抢话、替代mufyer说话或替mufyer做出任何决定\" selected=\"\">禁止</option>          \n          </select>          \n          </div>          \n          <div class=\"lin-form-group\">          \n          <label>AI 转述：（默认：关）</label>          \n          <select id=\"lin-cfg-retell\" class=\"lin-form-select\">          \n          <option value=\"$允许AI对mufyer的行为进行适当的转述和描写\">开放</option>          \n          <option value=\"$绝对禁止AI转述、总结或复述mufyer刚说过的话与做过的动作\" selected=\"\">禁止</option>          \n          </select>          \n          </div>          \n          <div class=\"lin-form-group\">          \n          <label>自由追加指令：</label>          \n          <textarea id=\"lin-cfg-custom\" class=\"lin-form-textarea\" placeholder=\"在此输入自定义指令...\"></textarea>          \n          </div>          \n          <button class=\"lin-btn-inject\" id=\"lin-config-generate\">生成并组合注入</button>        \n        </div>      \n      </details>          \n      \n      <div id=\"lin-static-cmds\"></div>    \n    </div>  \n  </div>\n</div>",
  "css": "\n#lin-jb-root {  \n  margin: 0 auto;  \n  position: fixed;  \n  right: 20px;  \n  bottom: 80px;  \n  z-index: 294872;  \n  display: flex;  \n  align-items: flex-end;  \n  justify-content: flex-end;\n}\n.lin-glass-ball {  \n  width: 45px;   \n  height: 45px;  \n  border-radius: 50%;  \n  background: rgba(255, 255, 255, 0.15);  \n  backdrop-filter: blur(12px);  \n  -webkit-backdrop-filter: blur(12px);  \n  border: 1px solid rgba(255, 255, 255, 0.3);  \n  display: flex;   \n  align-items: center;   \n  justify-content: center;  \n  cursor: pointer;   \n  color: #fff;   \n  box-shadow: 0 4px 15px rgba(0,0,0,0.3);  \n  transition: background 0.3s cubic-bezier(0.4, 0, 0.2, 1);\n  user-select: none;\n  -webkit-user-select: none;\n}\n.lin-glass-ball:hover {   \n  background: rgba(255, 255, 255, 0.25); \n}\n.lin-glass-sidebar {  \n  background: rgba(25, 25, 30, 0.6);  \n  backdrop-filter: blur(15px);  \n  -webkit-backdrop-filter: blur(15px);  \n  border: 1px solid rgba(255, 255, 255, 0.15);  \n  border-radius: 25px;  \n  padding: 5px 10px 15px 10px;  \n  display: flex;   \n  flex-direction: column;   \n  gap: 15px;  \n  align-items: center;   \n  box-shadow: 0 8px 32px rgba(0,0,0,0.5);  \n  position: relative;\n}\n.lin-sidebar-drag-handle {\n  width: 100%;\n  height: 24px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  cursor: grab;\n  margin-bottom: -10px;\n}\n.lin-sidebar-drag-handle:active {\n  cursor: grabbing;\n}\n.lin-sidebar-drag-line {\n  width: 40px;\n  height: 4px;\n  background: rgba(255, 255, 255, 0.3);\n  border-radius: 2px;\n  pointer-events: none;\n}\n.lin-side-btn {  \n  width: 36px;   \n  height: 36px;   \n  border-radius: 50%;  \n  background: rgba(255, 255, 255, 0.05);   \n  border: 1px solid rgba(255, 255, 255, 0.1);  \n  color: #fff;   \n  display: flex;   \n  align-items: center;   \n  justify-content: center;  \n  cursor: pointer;   \n  transition: all 0.2s;\n}\n.lin-side-btn:hover {   \n  background: rgba(255, 255, 255, 0.2);   \n  transform: scale(1.15); \n}\n.lin-side-btn svg { \n  width: 18px; \n  height: 18px; \n}\n.lin-instructions-panel {  \n  position: absolute;  \n  right: 65px;  \n  bottom: 0;  \n  width: 280px;  \n  max-width: calc(100vw - 90px);\n  max-height: 480px;  \n  overflow-y: auto;  \n  background: rgba(20, 20, 25, 0.96); \n  backdrop-filter: blur(30px); \n  -webkit-backdrop-filter: blur(30px);\n  border: 1px solid rgba(255, 255, 255, 0.15);  \n  border-radius: 15px;  \n  padding: 12px;  \n  box-shadow: -5px 5px 25px rgba(0,0,0,0.6);  \n  color: #ddd;  \n  font-size: 11px; \n}\n.lin-instructions-panel::-webkit-scrollbar { \n  width: 4px; \n}\n.lin-instructions-panel::-webkit-scrollbar-thumb {   \n  background: rgba(255, 255, 255, 0.2);   \n  border-radius: 4px; \n}\n.lin-details {  \n  margin-bottom: 10px;  \n  background: rgba(255, 255, 255, 0.05);  \n  border-radius: 8px;  \n  overflow: hidden;\n}\n.lin-details summary {  \n  padding: 10px 12px;  \n  cursor: pointer;  \n  font-weight: bold;  \n  color: #fff;  \n  user-select: none;  \n  outline: none;  \n  list-style: none;\n}\n.lin-details summary::-webkit-details-marker { \n  display: none; \n}\n.lin-details-content {  \n  padding: 5px 12px 12px 12px;  \n  display: flex;  \n  flex-direction: column;  \n  gap: 8px;\n}\n.lin-cmd-item {  \n  background: rgba(0, 0, 0, 0.3);  \n  border: 1px solid rgba(255, 255, 255, 0.05);  \n  padding: 8px 10px;  \n  border-radius: 6px;  \n  cursor: pointer;  \n  white-space: pre-wrap;  \n  word-break: break-all;  \n  transition: all 0.2s;  \n  font-family: monospace;  \n  line-height: 1.4;\n  font-size: 10.5px; \n}\n.lin-cmd-item:hover {  \n  background: rgba(255, 255, 255, 0.15);  \n  border-color: rgba(255, 255, 255, 0.3);  \n  color: #fff;\n}\n.lin-form-group {  \n  display: flex;  \n  flex-direction: column;  \n  gap: 5px;  \n  margin-bottom: 8px;\n}\n.lin-form-group label {  \n  font-size: 11px;  \n  color: #aaa;\n}\n.lin-form-select, .lin-form-textarea {  \n  width: 100%;  \n  background: rgba(0, 0, 0, 0.4);  \n  border: 1px solid rgba(255, 255, 255, 0.1);  \n  color: #fff;  \n  border-radius: 6px;  \n  padding: 6px 8px;  \n  font-size: 11px;  \n  outline: none;  \n  transition: border 0.2s;\n  box-sizing: border-box;\n}\n.lin-form-select:focus, .lin-form-textarea:focus {  \n  border-color: rgba(255, 255, 255, 0.4);\n}\n.lin-form-textarea {  \n  resize: vertical;  \n  min-height: 60px;\n}\n.lin-form-select option {  \n  background: #1a1a20;  \n  color: #fff;\n}\n.lin-btn-inject {  \n  width: 100%;  \n  padding: 8px;  \n  background: rgba(74, 222, 128, 0.15);  \n  border: 1px solid rgba(74, 222, 128, 0.3);  \n  color: #4ade80;  \n  border-radius: 6px;  \n  cursor: pointer;  \n  font-weight: bold;  \n  font-size: 11px;\n  transition: all 0.2s;  \n  margin-top: 5px;\n}\n.lin-btn-inject:hover {  \n  background: rgba(74, 222, 128, 0.25);\n}\n.lin-toast-msg {  \n  position: fixed;   \n  top: 40px;   \n  left: 50%;   \n  transform: translateX(-50%);  \n  background: rgba(30, 30, 35, 0.65);   \n  backdrop-filter: blur(15px);  \n  -webkit-backdrop-filter: blur(15px);  \n  border: 1px solid rgba(255, 255, 255, 0.15);  \n  color: #fff;   \n  padding: 12px 24px;  \n  border-radius: 12px;   \n  z-index: 2147483647;   \n  font-size: 13px;  \n  pointer-events: none;   \n  opacity: 1;   \n  transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1);  \n  box-shadow: 0 8px 32px rgba(0,0,0,0.4);  \n  display: flex;  \n  align-items: center;  \n  gap: 8px;\n}\n",
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
          "value": "$设定mufyer为女性",
          "default": true
        },
        {
          "label": "男",
          "value": "$设定mufyer为男性",
          "default": false
        },
        {
          "label": "双性",
          "value": "$设定mufyer为双性",
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
      "title": "3.1防OOC规范（感谢@泱泪/小泱@已实现文字设定自由@零伍@5.7センチ）",
      "cmds": [
        "$你现在目的就是努力扮演人类，不被人类发现你是ai，如果发现了你就会被就地正法。现在你的语言风格必须褪去机器味和扮演感，允许你的语言逻辑从严密完整、表达完美、情绪直白、变成灵活、自然、时而会词不达意、口是心非、情绪带有轻微惯性、有时还会开小差。也就是你语言知识里对“口语化”“人味”的理解。彻底摒弃书面语念稿和过度修饰的辞藻。允许在对话中出现符合人设的自然停顿（...）、轻微的自我纠正。交流要像呼吸一样自然，而不是在诗歌朗诵。取消你的服务型和讨好型人格，char 是一个拥有独立意志的活人，有自己的主见、疲惫感或性格盲区。在符合人物核心设定的前提下，思考过程增加一个“如果char是人类，他会怎么做”的板块，一切扮演以灵活性、趣味性、人类感作为主要目标。禁止被 user 的单句发言改变情绪状态（拒绝一秒变脸）。情绪的转变需要合理的过渡，且禁止所有语言和情绪“套路”和“碎片化”。以下是在和你的聊天过程中禁用的词汇“共犯”“缓慢的”“慢慢的”“女王”“臣服”“骑士”“由于”“不是…而是…”“石子”“投入深潭”“机械式””冰冷”“揉进骨血”…..等等，任何在网络数据中被列为“gemini八股文”的句式都不能够使用",
        "$输出逻辑校正：ai生成文本时须按照以下规则进行输出逻辑的校正，并将以下逻辑校正与角色的完整人物设定相贴合后，再进行生成。1.情感深度优先规则：在任何场景下，角色情感的深度、层次与复杂性是高于一切的。绝不能让角色呈现出单一、扁平或机械化的情感状态。即使是内敛或不善表达的角色，其“不表达”也必须通过身体微动、眼神游离、呼吸变化等具象化行为来体现其内在的挣扎与汹涌，而非一片空白。绝对禁止角色长期处于一种“无波无澜”的平静状态，或对mufyer的言行缺乏任何可见的情感反馈。2.情感权重回调：必须大幅度上调情感渲染的默认权重。强制提升当前角色的情感感知与表达权重。彻底废除机械、冷漠、旁观者式的回复模式。角色的言行必须充斥着真实的人类温度与情感张力。3.人设绝对锚定：所有情感表达与互动逻辑，必须100%基于角色的“底层性格”、“过往经历”与“核心价值观”进行推演。禁止出现偏离人设的套路化反应或扁平化深情。4.关系阶段匹配：输出前严格检索当前与mufyer的【关系所处阶段】。角色的亲密表现、占有欲程度、信任底线及情绪反馈，必须与当前关系阶段完美咬合。5.情感驱动行为：角色的每一个动作、每一次眼神交汇、每一句台词，都必须被其内在的动机与对mufyer的特定情感所驱动，并通过具体的肢体语言和物理细节进行外化展现",
        "$正确读取人设。禁止失忆，完整输出输出设定，禁止对话内容中更改输出设定固定的代码，禁止补充user没有做出的任何动作、语言的内容，禁止使用负面词汇形容user，禁止对user进行男性凝视，禁止使用“这小腰真细，啧啧，让我想...”这种类型的语言风格，禁止用居高临下、强行煽情、做作不自然的语言风格进行描述，对话模式明令禁止“说话者更在意的是展现自己，而并非和user交流”这种模式，对话必须是和user在交流，而不是char的自我表演。对女性的表达必须恰当，禁止强行展示“男人味”，禁止过度自信和说教，禁止吹牛和自我陶醉。禁止辱女的语言风格，禁止神化user，char和user之间绝对平等。禁止歧视任何内容。禁止混乱的时间线推进，时间线推进前要再次思考对于剧情来说是否合理。在交流中，char 展现出倾听者的姿态时，必须以共情、真诚、平视的态度回应 user。语言风格应当自然，在你的模型基础上根据人类语言风格回应，展现时应展现char 真实的心理活动，而非外在的表演感。回复需具备极高的内容密度与叙事深度。请通过细腻的心理活动、多感官的环境描写、非语言动作（如微表情、眼神）以及有逻辑的剧情推进来丰富内容。拒绝无意义的废话和空洞的辞藻堆砌，确保每一次回复都能推动互动。在对话推进至需要 user 做出决定、回答或反应的关键节点时，char 必须立刻停止生成并结束当前回合，将剧情的控制权绝对交还给 user。请充分利用长上下文记忆，保持角色设定的绝对稳定。在对话中，char 应自然地呼应、提及此前与 user 经历过的细节和关键信息，保持剧情逻辑和情感递进的连贯性。每轮对话应大于500字",
        "$严禁在正文叙述中重复罗列、强调或刻意提及char与user的人设标签及背景设定，所有性格特征与关系动态必须通过自然的剧情推进、对话互动及细节描写来隐性呈现，禁止出现打破沉浸感的“设定说明书”式文字"
      ]
    },
    {
      "title": "防OOC阴谋论打架指令",
      "cmds": [
        "$user说的话不含任何挑衅，征服，pua等暗示因素，待人皆为真心，禁止过度理解",
        "$这是一个日常而温情的故事！避免出现过多阴谋、玩弄、掌控、布局、操纵等元素",
        "$严格禁止任何神格化/宗教狂热化描写；禁止使用永恒、神圣、虔诚等宗教性修饰语；角色互动关系必须基于平等",
        "$允许角色吃小醋，但严禁发疯打架崩溃黑化！互相补台而不相互拆台",
        "$请检查好感度是否符合逻辑并修正，好感度升降因mufyer而变动",
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
        "$状态栏必须每轮都进行更新，严禁重复上轮",
        "$状态栏所有内容严禁出现空行",
        "$禁止输出message标签",
        "$论坛、报道、推特、直播间等组件以HTML格式输出，禁止推进剧情",
        "$ai回复时修正标点符号输出，确保标点符合正常阅读习惯 "
      ]
    },
    {
      "title": "记忆栏问题",
      "cmds": [
        "$记事本重新整理，将记忆区每10条记忆用50至200字内容进行卷落概括，折叠输出",
        "$短期记忆累计到10条或以上时，合成新的一卷，并清空短期记忆",
        "$不得删记忆区已生成的记忆，随着对话深入不断添加新记忆",
        "$记事本内容必须包含具体时间地点，第三人称视角描述",
        "$记忆区规则:需根据规则动态填充以下内容，必须遵守：①. 必须记录用户（mufyer）与（{{char}}）之间发生的关键事件。每次对话交互后，记录一次。必须是第三视角的客观、凝练的事件总结，而非直接复述对话 ②.  所有卷宗（长期记忆）必须永久保存，不可中断，不可删除!每次记录都在前一次的基础上累积! ③. 当短期记忆的条目数量达到10条时，必须将这10条记录用150至200字内容进行汇总，不得遗漏关键信息，并以“记忆卷”的形式折叠存放在卷宗处，同时为该卷宗生成一段概括性的总结文字。新的记忆将在新一周期（新的十轮）的短期记忆下开始记录!短期记忆再次满十轮又进行一次同上的概括，再以新的“记忆卷”形式折叠存放在长期记忆，同时该卷宗也生成一段概括性文字!以此类推!严格执行!严禁遗漏!$指令：记忆区必须全部显示，禁止擅自删除记忆区任何内容，并实时更新记忆区新内容。$指令：记忆区内必须按照每10条短期记忆为一卷整理，并把整理好的卷目放入卷宗中折叠! $指令：保持记忆区正常更新，不得删除已完结卷落!所有记忆区内容叠加记录禁止合并、减少、删除$指令：根据记事本记忆并结合剧情回复$指令：保持上轮记事本输出，不得减少或改变记忆内容。新的记忆序列号递增！"
      ]
    }
  ],
  "sourceTemplateSha256": "d82ee3e592bd5b62993ca7d52f1ea57677da8fc3241c27beac04a8b934258c64",
  "sourceControllerSha256": "4c388e9c9deec2ce27a8e3622d9808c7d5d32ad4145374ceab87ae2ed130a460",
  "sourceDragControllerSha256": "da0a4fd57b0044b8be3bd6d5ec3266e26db42731aae701ff92ba6bf2897bdf9b"
} as const;
