/** Staging evidence validation only; no DOM access, download, or host access. */
export interface PublicRoleAvatarExpected { roleId:string; roleName:string; sourceUrl:string; }
export interface PublicRoleAvatarBindingEvidence {
  roleId:string; roleName:string; sourceUrl:string; observedAt:string; elapsedMs:number;
  container:{
    scope:'role-profile'|'role-chat-header'; selector:string;
    matchedRoleName:string; exactTitleMatchCount:number; text:string;
    followContextLabel:'关注'|'關注'; candidateCount:number;
  };
  image:{url:string;alt:string;visible:boolean;loaded:boolean;naturalWidth:number;naturalHeight:number};
}
const fail=(code:string):never=>{throw new Error(`PUBLIC_ROLE_AVATAR_BINDING:${code}`);};
const record=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const publicUrl=(s:unknown):s is string=>{
 if(typeof s!=='string')return false;
 try{const u=new URL(s);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}
};
const sourceRole=(s:unknown)=>{
 if(!publicUrl(s))return null;
 try{return new URL(s).searchParams.get('roleId');}catch{return null;}
};
/** A DOM collector must honestly measure these fields in the current visible role
 * container. Passing a timestamp or count cannot itself prove an observation. */
export function assertPublicRoleAvatarBinding(value:unknown, expected:PublicRoleAvatarExpected):asserts value is PublicRoleAvatarBindingEvidence {
 if(!record(value))fail('EVIDENCE_REQUIRED');
 if(!expected.roleId||!expected.roleName||!publicUrl(expected.sourceUrl)||sourceRole(expected.sourceUrl)!==expected.roleId)fail('INVALID_EXPECTED_ROLE');
 if(value.roleId!==expected.roleId||value.roleName!==expected.roleName||value.sourceUrl!==expected.sourceUrl||sourceRole(value.sourceUrl)!==expected.roleId)fail('ROLE_IDENTITY_MISMATCH');
 if(typeof value.observedAt!=='string'||!Number.isFinite(Date.parse(value.observedAt)))fail('OBSERVATION_TIME_REQUIRED');
 if(typeof value.elapsedMs!=='number'||!Number.isFinite(value.elapsedMs)||value.elapsedMs<=0)fail('MEASURED_ELAPSED_REQUIRED');
 const c=value.container,i=value.image;
 if(!record(c)||!record(i))fail('PUBLIC_CONTAINER_AND_IMAGE_REQUIRED');
 if(!['role-profile','role-chat-header'].includes(String(c.scope)))fail('UNBOUND_CONTAINER_SCOPE');
 if(typeof c.selector!=='string'||!c.selector.trim())fail('OBSERVED_CONTAINER_SELECTOR_REQUIRED');
 if(c.matchedRoleName!==expected.roleName||c.exactTitleMatchCount!==1)fail('EXACT_UNIQUE_ROLE_TITLE_REQUIRED');
 if(!['关注','關注'].includes(String(c.followContextLabel))||typeof c.text!=='string'||!c.text.includes(expected.roleName)||!c.text.includes(String(c.followContextLabel)))fail('ROLE_PROFILE_CONTEXT_REQUIRED');
 if(c.candidateCount!==1)fail('UNIQUE_ROLE_IMAGE_REQUIRED');
 if(typeof i.alt!=='string'||/userprofile/i.test(i.alt))fail('USER_AVATAR_REJECTED');
 if(!publicUrl(i.url))fail('PUBLIC_IMAGE_URL_REQUIRED');
 if(i.visible!==true||i.loaded!==true)fail('VISIBLE_LOADED_IMAGE_REQUIRED');
 for(const dim of [i.naturalWidth,i.naturalHeight])if(typeof dim!=='number'||!Number.isFinite(dim)||!Number.isInteger(dim)||dim<24||dim>8192)fail('NORMAL_IMAGE_DIMENSIONS_REQUIRED');
}
