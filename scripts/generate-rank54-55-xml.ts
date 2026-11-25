import {readFileSync, writeFileSync, mkdirSync} from 'fs';

// 为rank54和55生成XML
const archiveDir = 'E:/agent/YearnAI/yearn-chat/outputs/mufy-local-archives-rank52-100-20261109';

const ranks = [
  {rank: 54, key: 'char_133a44bd0c1bf614a704'},
  {rank: 55, key: 'char_750b09955df140c29805'}
];

for(const r of ranks) {
  const outputDir = `E:/agent/YearnAI/yearn-chat/outputs/rank${r.rank}-prepared`;
  mkdirSync(outputDir, {recursive: true});

  const record = JSON.parse(readFileSync(`${archiveDir}/${r.key}/archive-record.json`, 'utf-8'));
  const prompt = readFileSync(`${archiveDir}/${r.key}/prompt.txt`, 'utf-8');

  const name = record.character_name;

  const xml = `<?xml version="1.0" encoding="UTF-8"?><mufy-character><元信息><名称><![CDATA[${name}]]></名称><性别文本><![CDATA[男]]></性别文本><年龄><![CDATA[25]]></年龄><NSFW><![CDATA[false]]></NSFW><AI><![CDATA[false]]></AI><内容类型><![CDATA[original]]></内容类型><头像><![CDATA[https://cdn.mufy.ai/placeholder-avatar.png]]></头像><封面图><![CDATA[]]></封面图></元信息><标签></标签><角色介绍><![CDATA[${name}]]></角色介绍><作者的话><![CDATA[]]></作者的话><人设><![CDATA[${prompt}]]></人设><开场白><![CDATA[你好，我是${name}。]]></开场白><对话范例><![CDATA[]]></对话范例></mufy-character>`;

  writeFileSync(`${outputDir}/ui-import.xml`, xml, 'utf-8');
  console.log(`✅ Rank${r.rank} (${name}): ${xml.length}字符`);
}
