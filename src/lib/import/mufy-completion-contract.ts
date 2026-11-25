/** A migration compatibility reminder, not a change to the source archive.
 * Resolve host state-end ordering while retaining the creator's visible suffix. */
export const MUFY_COMPLETION_ADAPTER = `<MufyCompletionCompatibility>
保留原卡要求的全部三个状态栏和其中所有必填内容，不简化任何板块。
先完整输出三个状态栏并闭合其全部HTML；检查无遗漏后，将原卡要求的「☆已生成完整」作为本轮最后一行可见文字输出。
如使用宿主DEARM_STATE边界注释，请将该完成标记放在DEARM_STATE_END注释之前，然后立即停止。注释不是可见文字，这仍满足原卡末尾标记要求。
若任一板块尚未完成，不得提前输出完成标记；继续完成缺项后再输出。只输出一次完整回复，不重写正文，不复述检查过程。
结尾结构示例：生成完第三个状态栏内容后，实际回复必须以如下结构结尾（不要输出代码围栏）：
</details>
</div>
☆已生成完整
<!-- DEARM_STATE_END -->
上例仅展示闭合末尾，不得以它代替完整状态栏。完成标记是需要实际输出的可见文字，不是仅供内部检查的说明。
</MufyCompletionCompatibility>`;

export function adaptMufyCompletionContract(outputSetting: string): string {
  if (!outputSetting.includes('☆已生成完整') || (!outputSetting.includes('Cmtt_fold_block')&&!outputSetting.includes('三个状态栏'))) return outputSetting;
  const original=outputSetting.replace(/\s*<MufyCompletionCompatibility>[\s\S]*?<\/MufyCompletionCompatibility>\s*$/,'');
  return original.trimEnd() + '\n\n' + MUFY_COMPLETION_ADAPTER;
}

export function reviewMufyCompletion(raw: string) {
  const errors: string[] = [];
  const text = raw.replace(/<!--[\s\S]*?-->/g,'');
  const classes = ['Cmtt_fold_block','Ks_split_layout','Tuan_mobile_vertical','Z_CONFIG_extra'];
  const counts = Object.fromEntries(classes.map(cls=>[cls,[...text.matchAll(/<(?:div|details|section)\b[^>]*\bclass\s*=\s*["']([^"']+)["'][^>]*>/g)].filter(m=>m[1].split(/\s+/).includes(cls)).length]));
  if(/```/.test(text))errors.push('RAW_CODE_FENCE_IN_STATUS_OUTPUT');
  if(counts.Cmtt_fold_block!==3)errors.push('THREE_STATUS_SECTIONS_REQUIRED');
  for(const cls of classes.slice(1))if(counts[cls]!==1)errors.push('STATUS_SECTION_MISSING_OR_DUPLICATED:'+cls);
  if(/ai(?:生成|填充)/i.test(text))errors.push('UNFILLED_PLACEHOLDER');
  const stack:string[]=[];
  for(const m of text.matchAll(/<\/?(div|details|section)\b[^>]*>/gi)){
    const tag=m[1].toLowerCase();
    if(m[0].startsWith('</')){if(stack.pop()!==tag)errors.push('UNBALANCED_HTML');}
    else if(!m[0].endsWith('/>'))stack.push(tag);
  }
  if(stack.length)errors.push('UNCLOSED_HTML');
  const visible=text.replace(/<[^>]*>/g,'').trim();
  if(!visible.endsWith('☆已生成完整'))errors.push('END_MARKER_MISSING_OR_NOT_LAST');
  if((visible.match(/☆已生成完整/g)||[]).length!==1)errors.push('EXACTLY_ONE_END_MARKER_REQUIRED');
  return {ok:errors.length===0,errors:[...new Set(errors)],counts,chars:raw.length};
}
