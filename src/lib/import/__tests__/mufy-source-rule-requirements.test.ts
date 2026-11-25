import {describe,expect,test} from 'bun:test';
import {assertMufyXmlRenderCoverage,findMufyXmlRenderProtocols} from '../mufy-source-rule-requirements';
describe('custom XML source render coverage gate',()=>{
 test('flags the observed Duan Xin protocol instead of accepting raw code',()=>{
  const source='<matrix_pre_status><current_time>19:30</current_time></matrix_pre_status><c_post_system><inner_monologue>x</inner_monologue></c_post_system>';
  expect(findMufyXmlRenderProtocols([source])).toEqual(['c_post_system','current_time','inner_monologue','matrix_pre_status']);
  expect(()=>assertMufyXmlRenderCoverage([source],false)).toThrow('MISSING_SOURCE_RENDER_RULES');
 });
 test('does not mistake ordinary source HTML/classes or speech compatibility tags for custom XML',()=>{
  expect(findMufyXmlRenderProtocols(['<details class="my_status"><summary>Status</summary><div data_state="x">x</div></details><message>hello</message>'])).toEqual([]);
  expect(()=>assertMufyXmlRenderCoverage(['<details>x</details>'],false)).not.toThrow();
 });
 test('requires paired explicit tags; a validated chain satisfies the gate',()=>{
  expect(findMufyXmlRenderProtocols(['Use the label current_time, not an output tag; <optional_tag> is just an isolated example.'])).toEqual([]);
  expect(()=>assertMufyXmlRenderCoverage(['<c_post_system>x</c_post_system>'],true)).not.toThrow();
  expect(()=>assertMufyXmlRenderCoverage(['<memorycore_v8_immutable>instruction metadata</memorycore_v8_immutable>'],false)).not.toThrow();
 });
});
