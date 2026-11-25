"""Build a read-only legacy-batch handoff. Never promotes acceptance or edits QA."""
import datetime
import hashlib
import json
from pathlib import Path
import time

started = time.perf_counter()
base = Path('logs/mufy-profiles/full-20261013/next-batch-30-20261028')
out = base / 'handoff-operations-20261107'
out.mkdir(exist_ok=True)
(out / 'cards').mkdir(exist_ok=True)
qa_path = base / 'qa-progress.json'
qa_before = hashlib.sha256(qa_path.read_bytes()).hexdigest()
qa = json.loads(qa_path.read_text(encoding='utf-8-sig'))
gates = 'identity source-completeness import-roundtrip opening-mobile opening-desktop reply1-mobile reply1-desktop reply2-mobile reply2-desktop controls-mobile controls-desktop author-style-isolation player-name fold-lifecycle streaming-stability fixed-widgets speech-avatars media custom-interactions'.split()
names = dict(zip([21,22,23,24,25,26,27,28,29,30,32,33,34,35,36,38,39,40,41,42,43,44,45,46,47,48,49], '傅司晏 江峙 许江禾（小狗单） 周辰野 陈闯 肖褚楠 顾晏琛 裴清野 邱石 卓序生 唐志泽 蛇谷凛 黎俨 段信 裴宪宇 宋锦琛 谢闽 贺璟昫 沈砚 慕行昭 江之余 祁述 林叙 宋锦荣 许江禾 内森·特斯曼 慕昭宁'.split()))
# These are scoped facts, not inferred whole-card passes. Each card still needs
# explicit gate reconciliation. Historic map reasons may have been superseded.
focus = {
21: ('复用已验证的十条指令、光标、导航、关系图和已有真实回复；零高评论身份辅助代码不移植到聊天功能。', '核实五曲中第三/四曲的来源可用性记录；来源不可用只能具体列例外。复核关系区当前布局及尚无归档的视觉门槛。'),
22: ('复用四命中搜索循环/跳转、17表情16指令、时间线选择、手机草稿及光标记录。', '补搜索胶囊来源/目标视觉与拖拽证据；手机其他状态按组件表逐项归档，不重复已有发送框/光标测试。'),
23: ('复用人物/访谈折叠、两段模拟聊天、已有两条真实回复。官方视频两端空白沿用来源例外证据。', '对照当前开场/回复视觉归档；两首歌曲time=0不能写已播放，按实际有界结果处理。'),
24: ('复用已验证侧栏29表情17指令与原图解码；读取11月4/5日第二曲和伴随工具最新证据，不能只看旧映射pending。', '先审music-second-track及companion-mobile最新记录；仅补仍缺的手机锚定、真实回复/视觉或音频行为。'),
25: ('复用七曲真实进度、十指令、六NPC、自定义命令保存/重载/删除、背景上传后还原，以及11月7日导航自动收起。', '头像上传仍缺真实效果证明；来源回顶取样498.667不能宣称两端绝对滚动坐标一致。'),
26: ('复用四个人物折叠、三个开场分支、四人图片、三快捷插入/光标。', '先审reviewedRuntimeIntegration及最新文件，确认10px溢出修复是否已实际上线复验，再补未覆盖视觉/真实回复门槛。'),
27: ('复用人物折叠、原头像/音频双方不可用例外、两条已保存回复；11月7日两处玩家名称和亮色表面样式已有实测。', '新版本只复验受影响开场布局，再合并开场与两条回复手机/桌面视觉证据；不重新播放不可用原音频。'),
28: ('复用七个开场块、拼贴简介/渐变和原mp3双方不可用的11月5日记录。', '将开场、两条真实回复和平台控件分别归入19门槛；原mp3不换资源、不反复重播。'),
29: ('复用引导展开/关闭、排版及原mp3双方不可用记录。', '仅补未归档开场/回复视觉与控件；保留原曲来源例外。'),
30: ('复用三页签、两折叠、三关系、十五头像原图和复制实际粘贴；优先读11月4/5日实际站头像证据。', '原时钟/音乐的交互与来源播放证据分别判定；不要把旧local-only描述直接变成重做指令。'),
32: ('复用三人物折叠与已保存回复；优先读11月4日ghost-sidebar及vinyl真实站记录。', '归档黑胶控制与真实音频进度的区别；readyState0/time0不算播放成功。侧栏复验范围由最新证据决定。'),
33: ('复用11月7日播放器两端331.927×65.333尺寸闭环及11月4/5日回复折叠、字体/动效证据。', '尺寸相等不代表全视觉通过；阅读配对截图确认画面，再补尚无证明的门槛。'),
34: ('复用全部八项世界/人物折叠、七关系、原图、两曲真实播放及11月7日390/1280根布局闭环。owner修复SHA以最新记录为准。', '实际外层768px平板边界仍缺证明；480px iframe代理不算768验收。归档两条回复/流式等整卡门槛。'),
35: ('复用五日记、八场景、第二场景真实站切换、14QA导航及模拟手机公开正文。', '水平容纳/物理滑动、原生岛复制与音频的实际站证据不足时只补对应动作；本地复制成功不能替代真实站粘贴。'),
36: ('复用简介/经历折叠及33头像；实际站复制优先读avatar-copy-live-test-20261104，不沿用旧local-only结论。', '核对时钟与歌曲选择/进度证据是否完整，再补未归档的视觉、回复门槛。'),
38: ('复用宋锦琛标题泄漏已UI保存复验、六人物折叠、四朋友折叠、七模拟聊天、十色指令和已有两条正常回复。', '先读zen-prefix/zen-ten-colors/zen-mobile最新实际站证据；仅补媒体及尚无配对视觉。禁止旧候选覆盖修好的标题。'),
39: ('复用标题字体真实源/目标匹配，以及组件表指向的历史成功记录。', '按本卡组件表逐项审证据，再归档19门槛；当前资料未形成整卡签字，不能直接标通过。'),
40: ('复用11月7日第一关系卡稳定展开356×481.333正文对应，以及历史三正文/画廊记录。', '只补未覆盖组件状态及回复/控件视觉；不将动画过渡尺寸当稳定结果。'),
41: ('复用四人物页签、时间线、面具提取真实粘贴等历史证据；先查最新实际站记录是否覆盖本地修复。', '逐项确认移动端全视口滚动、爱心导航、六前缀、七曲播放器的真实站效果；local-only不直接通过。'),
42: ('复用三翻页/正文控制实际记录与原音频真实进度。第一版空壳补丁的失败记录保留。', '最高优先：新镜像硬刷新后只剩五个有意义开场文档、无五个1px采集壳；原三个翻页内容未丢失，390不溢出。具体步骤见操作手册第3节。'),
43: ('复用标题字体实际对齐、三模块/五歌曲/六关系/26指令和原始装饰局部证据。', '区分local与实际站：四箭头父级滚动、拖拽、390锚定及中间光标插入按最新integration证据归档，缺哪项补哪项。'),
44: ('复用三新闻页签、四人物页、九图对、两指令折叠。', '确认继承字体修复有当前实际站证据；补未归档视觉/回复/平台控件门槛。'),
45: ('复用拼贴排版、七原图对及两项双方失败记录。', '确认独立文档字体、真实雨滴动效有实际站证明；本地动效通过不等于上线通过。'),
46: ('复用owner调色保存并重载后的四个白底红字表面。', '审最新实际站全视口人物弹层关闭、滚动/重开/Esc证据；仅本地成功的项需要正常UI实测。'),
47: ('复用三页签四折叠、七OC部分、两组网络关系及原音频双方实际播放。', '复制必须查真实站粘贴，不用本地粘贴代替；补尚未归档的视觉/回复门槛。'),
48: ('复用四QA/头像启用、四关系、三业务、236.437秒原曲真实进度与标题字体。', '原站和目标复制都不能用按用户来源例外记录，不再盲试；独立侧栏音轨须区别于已通过的长音轨。'),
49: ('复用17贴纸22命令光标、owner电影简介UI保存及三日记390对照。', '绘画命令生命周期核对实际站integration；已有本地记录只说明修复候选，不替代实际站。'),
}

index = []
for row in qa['rows']:
    rank = row['rank']
    if rank in (31,37,50):
        continue  # No paused-card content inspection, even for the handoff.
    if rank not in names:
        continue
    carddir = base / 'final-acceptance' / str(rank)
    mapping_path = carddir / 'component-ui-mapping.json'
    mapping = json.loads(mapping_path.read_text(encoding='utf-8-sig')) if mapping_path.exists() else {}
    refs = []
    for p in sorted(carddir.iterdir()):
        if p.is_file() and p.suffix.lower() in ('.json','.jsonl','.png','.jpg'):
            refs.append({'path': p.relative_to(base).as_posix(), 'sha256':hashlib.sha256(p.read_bytes()).hexdigest(), 'bytes':p.stat().st_size})
    components = [{'id':f'{rank}:row{ordinal}:source{r.get("sourceIndex", "unknown")}', 'historicalMapping':r, 'disposition':'review-latest-evidence; do not repeat a proved unchanged action'} for ordinal,r in enumerate(mapping.get('rows',[]),1)]
    record = dict(rank=rank,name=names[rank],targetUrl=row.get('targetUrl'),sourceUrl=mapping.get('sourceUrl'),wholeCardAccepted=False,
        reusableScopedFacts=focus[rank][0],specificRemaining=focus[rank][1],
        gateReconciliation=[dict(id=g,status='unreconciled',action='Review existing evidence first. Record reusable proof and runtime impact; browser work only for an actual gap.') for g in gates],
        components=components,evidenceFiles=refs,qaRowSnapshot=row,
        warning='Unreconciled is an evidence-index gap, NOT proof the behavior was never tested. Historical pending reasons may be superseded. This file never promotes qa-progress.')
    (out/'cards'/f'{rank}.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf8')
    latest = [r for r in refs if any(d in r['path'] for d in ('20261107','20261106','20261105','20261104')) and r['path'].endswith(('.json','.jsonl'))]
    lines = [f'# rank{rank} {names[rank]}', '',f'- 来源：{record["sourceUrl"]}',f'- 目标：{record["targetUrl"]}', '- 当前：专项证据存在，整卡尚未签字。先审证据，不重新迁移。','', '## 已有事实：不要无条件重做','',focus[rank][0],'','## 本卡明确待办','',focus[rank][1],'','## 每项如何关闭','', '依操作手册的19项表逐项归档。已有文件满足标准且未受改动影响，写 reuse；不满足时写具体 gap 后只补该 gap。未归档不等于从未测试，禁止一键把19项全部重跑。','', '## 来源组件登记（历史快照，不是最新待办判决）','']
    for c in components:
        r=c['historicalMapping']
        lines += [f'### {c["id"]}', '',f'- 旧状态：{r.get("status")}; UI={r.get("targetUiVerified")}; fidelity={r.get("fidelityVerified")}', f'- 旧备注：{r.get("reason", "未写明")}', f'- 证据入口：{r.get("evidence", "见JSON内完整原行")}', '']
    lines += ['## 优先阅读的较新记录','', '日期只决定阅读顺序，不决定证据通过。旧成功仍在完整清单中。','']
    lines += [f'- `{r["path"]}`' for r in latest]
    lines += ['', f'全部文件及SHA256、原qa字段、19项归档槽见同目录 `{rank}.json`。成功/失败旧件都保留，禁止覆盖。']
    (out/'cards'/f'{rank}.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
    index.append(dict(rank=rank,name=names[rank],sourceUrl=record['sourceUrl'],targetUrl=record['targetUrl'],card=f'cards/{rank}.md',facts=focus[rank][0],remaining=focus[rank][1],evidenceFiles=len(refs)))
assert len(index)==27 and len({r['rank'] for r in index})==27
assert hashlib.sha256(qa_path.read_bytes()).hexdigest()==qa_before
payload=dict(generatedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),kind='handoff-evidence-index-not-acceptance',qaSha256=qa_before,eligible=27,held=[31,50],pausedNoRead=[37],fullFidelityAccepted=qa['fullFidelityAccepted'],cards=index,elapsedMs=(time.perf_counter()-started)*1000)
(out/'index.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf8')
lines=['# 27张逐卡交接入口','','这是查阅入口，不是27张通过报告。待办包括证据归档，不能理解成所有浏览器动作都要重做。','', '|rank|角色|本卡操作单|下一步|','|---|---|---|---|']
lines += [f'|{r["rank"]}|{r["name"]}|[{r["rank"]}](cards/{r["rank"]}.md)|{r["remaining"]}|' for r in index]
(out/'逐卡清单.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
print(json.dumps(dict(cards=len(index),evidenceFiles=sum(r['evidenceFiles'] for r in index),qaUnchanged=True,output=str(out),elapsedMs=payload['elapsedMs']),ensure_ascii=False))
