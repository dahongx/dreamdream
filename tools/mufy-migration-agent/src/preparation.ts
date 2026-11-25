/** Pure preparation parity with the reviewed batch pipeline; no live IO. */
import {prepareMufyMigration,parseMufyPrompt,type MufyRoleDetail} from '../../../src/lib/import/mufy-migration';
import {sourceRuleTransfer} from '../../../src/lib/import/mufy-source-rule-transfer';
import {mufyQuoteCompatibilityRules} from '../../../src/lib/import/mufy-quote-compatibility';
import {mufyStatusIndentRules} from '../../../src/lib/import/mufy-status-indent';
import {repairMufySidebarBoundary} from '../../../src/lib/import/mufy-sidebar-boundary';
import {restoreMufyPublicContentCss} from '../../../src/lib/import/mufy-public-content-css';
import {adaptMufyCompletionContract} from '../../../src/lib/import/mufy-completion-contract';
import {assertMufyXmlRenderCoverage} from '../../../src/lib/import/mufy-source-rule-requirements';
import {buildMufyPublicSemanticSkin,type MufyPublicSemanticAppearance} from '../../../src/lib/import/mufy-public-semantic-skin';
import {adaptMufySpeechDecorationCss} from '../../../src/lib/import/mufy-speech-decoration';

export interface PublicAppearance {
 version:1;sourceUrl:string;roleId:string;observedAt:string;
 captureScope:'normal-page-public-dom';sourceStyles:string[];contentClasses:string[];
 speechAvatar:boolean;semantic?:MufyPublicSemanticAppearance;
}
export function preparePublicMigration(input:{detail:MufyRoleDetail;prompt:string;promptSha256:string;rules:unknown;appearance:PublicAppearance}){
 const {detail,prompt,appearance:a}=input;
 if(a.version!==1||a.roleId!==detail.characterId||a.sourceUrl!==detail.sourceUrl||a.captureScope!=='normal-page-public-dom'||!Number.isFinite(Date.parse(a.observedAt))||!Array.isArray(a.sourceStyles)||a.sourceStyles.some(s=>typeof s!=='string')||!Array.isArray(a.contentClasses)||a.contentClasses.some(s=>typeof s!=='string')||typeof a.speechAvatar!=='boolean')throw Error('PUBLIC_APPEARANCE_PROOF_REQUIRED');
 if(a.speechAvatar&&!detail.avatarUrl)throw Error('OBSERVED_SPEECH_AVATAR_URL_MISSING');
 const semantic=a.semantic?buildMufyPublicSemanticSkin(a.semantic,detail.characterId):undefined;
 const transferred=sourceRuleTransfer(input.rules,detail.characterId,detail.optimizationCode??'',a.speechAvatar?detail.avatarUrl??undefined:undefined,semantic?.nativeTextColor);
 const sourceFields=parseMufyPrompt(prompt);
 assertMufyXmlRenderCoverage([sourceFields.opening??'',sourceFields.outputSetting??''],!!transferred.ruleCount);
 const prepared=prepareMufyMigration({adaptRuntime:true,preferLocalAge:true,detail:{...detail,sourceRules:transferred.capture},promptRecord:{characterName:detail.name,prompt,source:{origin:'authorized-local-input',sha256:input.promptSha256}}});
 prepared.beautification.replyRender=transferred.envelope;
 if(prepared.beautification.openingComponent)prepared.beautification.openingComponent=repairMufySidebarBoundary(prepared.beautification.openingComponent);
 const restored=restoreMufyPublicContentCss(a.sourceStyles,a.contentClasses);
 if(restored)prepared.beautification.globalCss=restored+'\n'+prepared.beautification.globalCss;
 if(semantic)prepared.beautification.globalCss=(prepared.beautification.globalCss??'')+semantic.hostCss;
 if(a.speechAvatar)prepared.beautification.globalCss=adaptMufySpeechDecorationCss(prepared.beautification.globalCss??'').css;
 const character={...prepared.character,outputSetting:adaptMufyCompletionContract(prepared.character.outputSetting??'')||null};
 const rules=[...transferred.rules,...mufyQuoteCompatibilityRules([character.opening??''])];
 if(a.speechAvatar&&character.avatarUrl)rules.push({ruleName:'迁移兼容：公开来源台词头像',regexPattern:'/<(?:message|mes)>([\\s\\S]*?)<\\/(?:message|mes)>/g',replaceString:`<div class="mufy-import-speech-row" style="display:flex;align-items:flex-start;gap:16px;margin:8px 0"><img src="${character.avatarUrl}" alt="角色台词头像" style="width:36px;height:36px;min-width:36px;border-radius:50%;object-fit:cover"/><div class="nj_ai_message_bubble" style="max-width:calc(100% - 52px)">$1</div></div>`,enabled:true,visibility:false});
 rules.push(...mufyStatusIndentRules([character.opening??'',character.outputSetting??'',character.sampleDialogue??'']));
 return {prepared,character,rules};
}
