#!/usr/bin/env bun
import { readFile } from 'fs/promises';

async function main() {
  const content = await readFile('character-creation-toolkit/generated/debug-persona.json', 'utf-8');

  console.log('文件长度:', content.length);
  console.log('前200字符:');
  console.log(content.substring(0, 200));
  console.log('\n后200字符:');
  console.log(content.substring(content.length - 200));

  console.log('\n尝试解析JSON...');

  // 检查是否有\n实际换行符混合问题
  const hasRealNewline = content.includes('\n');
  const hasEscapedNewline = content.includes('\\n');
  console.log('包含真实换行符:', hasRealNewline);
  console.log('包含转义换行符:', hasEscapedNewline);

  try {
    const parsed = JSON.parse(content);
    console.log('✅ 解析成功!');
    console.log('persona长度:', parsed.persona?.length || 0);
  } catch (e: any) {
    console.error('❌ 解析失败:', e.message);

    // 尝试找到persona字段
    const personaMatch = content.match(/"persona":\s*"([^"]*)/);
    if (personaMatch) {
      console.log('\npersona字段开始部分:');
      console.log(personaMatch[0].substring(0, 200));
    }
  }
}

main().catch(console.error);
