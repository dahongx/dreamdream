import {describe,test,expect} from 'bun:test';
import {assertPublicRoleAvatarBinding,type PublicRoleAvatarBindingEvidence} from '../mufy-public-role-avatar-binding';
const expected={roleId:'observed-role-id',roleName:'Current role',sourceUrl:'https://chat.mufy.ai/chat?roleId=observed-role-id'};
const evidence=():PublicRoleAvatarBindingEvidence=>({...expected,observedAt:'2026-11-11T11:00:00.000Z',elapsedMs:27.4,container:{scope:'role-profile',selector:'.observed-title-parent',matchedRoleName:'Current role',exactTitleMatchCount:1,text:'Current role · observed tags · 关注',followContextLabel:'关注',candidateCount:1},image:{url:'https://cdn.mufy.ai/images/observed-role-image/public',alt:'',visible:true,loaded:true,naturalWidth:430,naturalHeight:430}});
describe('public role avatar binding evidence guard',()=>{
 test('accepts observed unique role container without imposing one source selector or inferred URL',()=>{
  expect(()=>assertPublicRoleAvatarBinding(evidence(),expected)).not.toThrow();
  const other=evidence();other.container.selector='#actually-observed-header .profile';other.container.followContextLabel='關注';other.container.text='Current role 關注';
  expect(()=>assertPublicRoleAvatarBinding(other,expected)).not.toThrow();
 });
 test('rejects wrong role ID, name, source URL and source query identity',()=>{
  for(const patch of [{roleId:'other'},{roleName:'other'},{sourceUrl:'https://chat.mufy.ai/chat?roleId=other'}])expect(()=>assertPublicRoleAvatarBinding({...evidence(),...patch},expected)).toThrow('ROLE_IDENTITY_MISMATCH');
  expect(()=>assertPublicRoleAvatarBinding(evidence(),{...expected,sourceUrl:'https://chat.mufy.ai/chat?roleId=other'})).toThrow('INVALID_EXPECTED_ROLE');
 });
 test('rejects recent-list, whole-page, ambiguous titles and multiple candidate images instead of choosing first',()=>{
  for(const patch of [{scope:'recent-list'},{scope:'document'},{matchedRoleName:'other'},{exactTitleMatchCount:2},{candidateCount:2},{text:'Current role only'}]){
   const e=evidence();Object.assign(e.container,patch);expect(()=>assertPublicRoleAvatarBinding(e,expected)).toThrow();
  }
 });
 test('rejects account-avatar, invisible/unloaded images, tiny dimensions, credentials and nonpublic URLs',()=>{
  for(const patch of [{alt:'userProfile'},{visible:false},{loaded:false},{naturalWidth:1},{naturalHeight:0},{url:'data:image/png;base64,AA'},{url:'https://name:secret@example.com/a'}]){
   const e=evidence();Object.assign(e.image,patch);expect(()=>assertPublicRoleAvatarBinding(e,expected)).toThrow();
  }
 });
 test('requires measured finite positive duration and parseable observation timestamp',()=>{
  for(const elapsedMs of [0,-1,NaN,Infinity])expect(()=>assertPublicRoleAvatarBinding({...evidence(),elapsedMs},expected)).toThrow('MEASURED_ELAPSED_REQUIRED');
  expect(()=>assertPublicRoleAvatarBinding({...evidence(),observedAt:'unknown'},expected)).toThrow('OBSERVATION_TIME_REQUIRED');
 });
 test('does not mutate source evidence or emit source text on error',()=>{
  const e=evidence(),before=JSON.stringify(e);assertPublicRoleAvatarBinding(e,expected);expect(JSON.stringify(e)).toBe(before);
  e.container.text='sensitive-source-context';try{assertPublicRoleAvatarBinding(e,expected);}catch(error){expect(String(error)).not.toContain(e.container.text);}
 });
});
