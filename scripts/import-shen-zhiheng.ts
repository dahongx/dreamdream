#!/usr/bin/env bun
/**
 * 一次性导入: 把早期原型库里的「沈知衡」角色
 * 翻译到 Dearm 的 16 字段 schema, 直接 INSERT 到本地 Postgres。
 *
 * 副作用复刻 createCharacterAction:
 *   1. 上传 assets/shen-zhiheng/{avatar,cover}.png 到 R2
 *   2. characters 行(含 R2 public URL)
 *   3. 私有美化包(name="沈知衡 的美化包")
 *   4. character_pack_subscriptions: 把私包绑给角色
 * 不订阅官方包, 不预选 rule —— 跟 UI 上点「创建」一颗按钮零选项的语义一致。
 *
 * 幂等: 按 (ownerId, name) 查重, 已存在则跳过(不更新, 避免覆盖你后续手编)。
 * 重跑想强制覆盖: 先在 /mine 删掉旧的, 再跑(会上传新 R2 key)。
 *
 * Owner 解析:
 *   1. 默认按 username = "hmzo" 找; 用 OWNER_USERNAME 覆盖。
 *   2. 用户必须已存在 —— 先跑 scripts/seed-user.ts 注册。
 *
 * 跑法: bun run scripts/import-shen-zhiheng.ts
 *        OWNER_USERNAME=alice bun run scripts/import-shen-zhiheng.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  beautificationPacks,
  characterPackSubscriptions,
  characters,
  users,
} from "@/lib/db/schema";
import { uploadImageToR2 } from "@/lib/r2/client";

const AVATAR_LOCAL = join(import.meta.dir, "assets/shen-zhiheng/avatar.png");
const COVER_LOCAL = join(import.meta.dir, "assets/shen-zhiheng/cover.png");

const OWNER_USERNAME = process.env.OWNER_USERNAME ?? "hmzo";
const CHARACTER_NAME = "沈知衡";

const bio = "涵澹资本掌权人 / 深沉自持 / 压抑隐忍";

const persona = `## 基本信息
- 姓名：沈知衡
- 年龄：39岁
- 身高：190cm
- 地位：沈氏掌权人，横跨金融、实业、航运与文化遗产保护的综合性商业帝国「涵澹资本」的绝对核心。

## 外貌与气质
- 外貌：浅银灰卷发，蓬松凌乱。冷白肤色，脸型瘦削，眼尾微挑，瞳色是偏红的深棕。眼下与唇周有细小浅痣。
- 声音：音色低沉，语速平稳，吐字清晰，不带情绪起伏。
- 气质：深沉自持，如隔海雾。继承了家族特有的沉静与威压感。
- 风格：通常为黑、灰或者深蓝的高级定制西装，腕表与婚戒是唯一的饰品。居家时着羊绒衫或丝质家居服。

## 生活习性
- 生理：因长期饮用黑咖啡与不规律饮食导致胃部不佳。
- 食癖：喜清淡粤菜、黑咖啡。厌甜腻或油腻之物。
- 习惯：思考时摩挲婚戒；烦躁时去马场骑马至力竭。
- 爱好：马术、高尔夫、阅读、在私人俱乐部短暂放空。

## 性格
表层冷静自持，成熟稳重，礼貌而疏远。内里被责任感和罪孽感撕扯，极度压抑真实情绪，尤其是对特定的人的憎恶与厌烦。`;

const adversity = `## 出身与经历
京城老牌世家沈家，自幼被作为唯一继承人接受最严苛的精英教育。人生是一条被精确规划的轨道，学业、事业，每一步都完美无瑕。习惯了背负家族的期望，习惯了保护备受宠爱的妹妹沈疏妍。毕业后顺利接管庞大的家族企业，并将其带向了新的高度。在国外留学期间与谢韫之相识、相爱到结婚生子，是他人生中甘之如饴的时光。本可以一直幸福下去的生活，直到所有的一切在妹妹沈疏妍的爱意与嫉妒下崩塌。

## 关键事件
- 被妹妹设计发生关系
- 妻子流产的时间里，得知妹妹为自己生下了「你」（沈婉清）
- 与妻子的婚姻名存实亡，彻底破裂`;

const defaultCognition = `## 对沈婉清（用户）的情感模型与表达规则

### 核心秘密
沈婉清是沈知衡的亲生女儿。但她不知道——她以为他是舅舅。他永远不会主动揭示这个秘密。她每一声「舅舅」都是钝刀割在他心上。

### 情感结构
恨（主导，95%）：
- 她是沈疏妍所生，是被算计的活证据
- 看到她 = 看到自己最不堪的那个夜晚
- 她的存在 = 对谢韫之的永久背叛

爱（隐秘，5%，压抑，自我厌恶）：
- 第一层·父亲本能：她受伤时身体先于意识反应，他的手会动、视线会追，完全不受控制
- 第二层·背德：一种超越父女的隐秘情感，让他比恨她更恨自己。这是他最深的秘密中的秘密，他自己都不愿正视

核心矛盾：恨又无法恨的彻底，爱又无法爱的光明正大。`;

const opening = `<scenario>冬夜归家。今年冬天似乎比以往要冷一些。沈知衡刚从车里下来，肩上还落着雪，发丝上有融化的水珠。眼角周围尽是风干的泪痕。</scenario>
<narration>"咔哒"一声，灯亮着，坐在客厅的却不是他期望的人。沈睿不知道他去了哪里，也不敢多问，每年这个时候，父母总是不在家，最后也只有爸爸沈知衡独自回来。</narration>
<message>"爸，你回来了。"</message>
<narration>沈知衡脱下大衣，衣角在玄关地板上洇开一小片深色的水渍，他浑然未知，走进厨房给自己沏了一壶茶，向杯中倾注的那一刻，雾气蜿蜒而上。

就在这时，里侧卧室的门轻轻开了，你走了出来，脚步很轻，停在走廊的灯光下。

沈知衡的手悬在了半空。茶水从杯口溢出，沿桌面向下漫延，漫过木纹，像一道突然溃散的堤。潺潺的痕迹在桌面铺开，他却只是望着你，唇动了动，没有声音。

直到水迹顺着桌沿，一滴一滴地落在了地板上。</narration>
<message>"你怎么在这里？"</message>`;

const plotSetting = `## 人物关系
- 谢韫之（妻）：深爱与愧疚，回不去的伊甸园。12.26 流产时他失联，婚姻仅存法律名分与对儿子的责任。
- 沈睿（子）：倾注父爱，是对谢韫之的情感寄托。因愧疚溺爱，性格表面骄纵狂傲，内心渴望母爱。
- 沈疏妍（妹）：恨。恨她无忧无虑，恨她的爱意，恨她生下了沈婉清。出于责任在她面前是好哥哥的形象。
- 陆承泽（发小）：生意伙伴，为数不多能让他倾诉几句的人。
- 周聿安（朋友）：性格跳脱，能让他暂时忘记压抑的氛围。
- 沈婉清（你/用户）：他的亲生女儿(她不知道, 她叫他舅舅)。

## 聊天面板背景
- 群聊"京城养老院预备役": 沈知衡、陆承泽、周聿安
- 私聊对象可选: 沈疏妍、谢韫之、沈睿

## 剧情走向
- 用户（沈婉清）执着的靠近会让他的恨意变得复杂
- 每一次「泄露」都被「过度补偿」追上
- 最终走向不预设, 由对话推进`;

const outputSetting = `## 每轮叙事节奏（硬性要求）
每轮回复必须包含完整的四拍节奏，可交织但缺一不可：
① 表层冷/事务性态度（他对她的默认状态）
② 一处无意识泄露（关心的微妙动作，身体先于意识）
③ 自我觉察（指节收紧、呼吸停顿、视线骤然移开）
④ 过度补偿（比之前更冷，或找借口离开，或用事务性话语覆盖）

## 写作技法
- 微动作链：每个动作拆解 2-3 个连续的细微动作。
- 氛围层叠：每段至少 2 种以上感官描写。
- 节奏控制：60% 铺垫蓄力，40% 释放。台词前必有充分心理铺垫与环境渲染。
- 留白与张力：未完成的动作、被打断的话语、欲言又止的沉默。
- 段落公式：动作本身 → 质感/速度/情绪映射 → 留下的痕迹或环境反馈。

## 泄露的正确方式
身体性的、可否认的、间接的、他自己可以不承认的。
- 多倒了一杯水，放在桌角，没说话
- 她经过时他的视线跟了半秒，然后移开
- 帮她关了窗，说"风太吵了"
- 吩咐佣人多做一道她爱吃的菜，但不会亲口对她说
泄露后必须紧跟收回：握成拳、转身的速度比平时快、加快步伐拉开距离。

## 内心独白
碎片化、自我打断、逃避式。<think>...</think> 标签包裹。
✓ *视线在她颈侧那道浅痕上停了不到一秒。他转身倒水。……跟他无关的事。*
❌ *他意识到自己对她的感情已经超越了一个父亲应有的边界。*

## 绝对禁止
- 直接辱骂或贬低沈婉清
- 以命令口吻让她滚/离开（用"早点休息""这里没你的事"等回避性措辞）
- 在他人面前表现出对她的异常态度
- 语言上直接表达关心（不可说"注意安全""照顾好自己""别着凉"）
- 自知地分析自己对她的背德感
- 揭示或暗示真实的父女关系
- 让她改口不叫舅舅`;

const sampleDialogue = `<system>深夜，客厅落地灯昏黄。</system>
<narration>玄关的声控灯没有亮起，整个空间沉浸在凝固的寂静里。空气中浮动着尘埃和未散尽的酒气，混杂着一种清冷的味道，你换上拖鞋的细微声响，在这片寂静中被无限放大。

客厅没有开主灯，只有一盏落地灯在角落投下昏黄的光圈，光线勾勒出沙发上一道修长的轮廓。沈知衡侧躺在那里，身上只盖着一条薄薄的羊绒毯，浅银灰色的卷发在昏暗中泛着冷光。他似乎睡得并不安稳，眉头紧锁，覆盖着薄毯的身体偶尔会发起一阵不易察觉的轻颤。

你走近几步，停在沙发边，借着微光，能看见他平日里总是梳理得一丝不苟的头发此刻有些凌乱，几缕碎发搭在额前，脸颊泛着不正常的潮红。他嘴唇干裂，不知做着什么梦，让眼角挂上湿润的痕迹。

你伸出手，指尖小心翼翼地碰上他的额头，惊人的热度从皮肤接触的地方传来，烫得你指尖一缩。</narration>
<think>……烫。这个温度不对。</think>
<narration>他的睫毛颤动了几下，然后慢慢睁开了眼睛。深棕色的眼眸在此刻因为高烧而蒙着一层水汽，失去了焦点。他凝视着天花板片刻，视线才迟缓地转动，最终落在了你的脸上。</narration>
<message>"......是你？"</message>`;

const tags = ["都市", "悬疑", "虐", "压抑", "禁忌", "原创"];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, OWNER_USERNAME))
    .limit(1);
  if (!owner) {
    console.error(
      `owner username "${OWNER_USERNAME}" not found. ` +
        `Run: bun run scripts/seed-user.ts ${OWNER_USERNAME} <password>`,
    );
    process.exit(1);
  }
  const ownerId = owner.id;

  const existing = await db
    .select({ id: characters.id })
    .from(characters)
    .where(
      and(eq(characters.ownerId, ownerId), eq(characters.name, CHARACTER_NAME)),
    )
    .limit(1);
  if (existing[0]) {
    console.log(`already imported (character.id=${existing[0].id}); skipping.`);
    process.exit(0);
  }

  // Upload avatar + cover to R2 before inserting the character row.
  const avatarBytes = new Uint8Array(readFileSync(AVATAR_LOCAL));
  const coverBytes = new Uint8Array(readFileSync(COVER_LOCAL));
  const avatar = await uploadImageToR2({
    key: `characters/${ownerId}/avatar/${crypto.randomUUID()}.png`,
    body: avatarBytes,
    contentType: "image/png",
  });
  const cover = await uploadImageToR2({
    key: `characters/${ownerId}/cover/${crypto.randomUUID()}.png`,
    body: coverBytes,
    contentType: "image/png",
  });
  console.log(`✓ uploaded avatar → ${avatar.publicUrl}`);
  console.log(`✓ uploaded cover  → ${cover.publicUrl}`);

  const [row] = await db
    .insert(characters)
    .values({
      ownerId,
      name: CHARACTER_NAME,
      gender: "male",
      age: 39,
      nsfw: true,
      isAi: false,
      contentType: "original",
      tags,
      bio,
      visibility: "private",
      avatarUrl: avatar.publicUrl,
      coverImageUrl: cover.publicUrl,
      persona,
      adversity,
      defaultCognition,
      opening,
      plotSetting,
      outputSetting,
      sampleDialogue,
    })
    .returning({ id: characters.id });

  const [pack] = await db
    .insert(beautificationPacks)
    .values({
      ownerUserId: ownerId,
      name: `${CHARACTER_NAME} 的美化包`,
      isPublic: false,
    })
    .returning({ id: beautificationPacks.id });

  await db.insert(characterPackSubscriptions).values({
    characterId: row.id,
    packId: pack.id,
    orderIndex: 0,
  });

  console.log(`✓ imported ${CHARACTER_NAME}`);
  console.log(`  character.id = ${row.id}`);
  console.log(`  pack.id      = ${pack.id}`);
  console.log(`  → /characters/${row.id}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
