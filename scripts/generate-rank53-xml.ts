import {readFileSync, writeFileSync, mkdirSync} from 'fs';

// 为rank53生成ui-import.xml
const archiveDir = 'E:/agent/YearnAI/yearn-chat/outputs/mufy-local-archives-rank52-100-20261109';
const outputDir = 'E:/agent/YearnAI/yearn-chat/outputs/rank53-prepared';

mkdirSync(outputDir, {recursive: true});

const record = JSON.parse(readFileSync(`${archiveDir}/char_aa9035bfa02027d6173b/archive-record.json`, 'utf-8'));
const prompt = readFileSync(`${archiveDir}/char_aa9035bfa02027d6173b/prompt.txt`, 'utf-8');

// 从record提取信息
const name = record.character_name;

// 生成XML
const xml = `<?xml version="1.0" encoding="UTF-8"?><mufy-character><元信息><名称><![CDATA[${name}]]></名称><性别文本><![CDATA[男]]></性别文本><年龄><![CDATA[25]]></年龄><NSFW><![CDATA[false]]></NSFW><AI><![CDATA[false]]></AI><内容类型><![CDATA[original]]></内容类型><头像><![CDATA[https://cdn.mufy.ai/placeholder-avatar.png]]></头像><封面图><![CDATA[]]></封面图></元信息><标签></标签><角色介绍><![CDATA[${name}]]></角色介绍><作者的话><![CDATA[]]></作者的话><人设><![CDATA[${prompt}]]></人设><开场白><![CDATA[你好，我是${name}。]]></开场白><对话范例><![CDATA[]]></对话范例></mufy-character>`;

writeFileSync(`${outputDir}/ui-import.xml`, xml, 'utf-8');

console.log('✅ 已生成rank53的ui-import.xml');
console.log('文件位置:', `${outputDir}/ui-import.xml`);
console.log('文件大小:', xml.length, '字符');
