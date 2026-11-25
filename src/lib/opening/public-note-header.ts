/** Output-only prototype. Current creatorNote and old rendering stay unchanged. */
export interface PublicNoteHeaderSpec {
  version: 1;
  family: "public-note-header-v1";
  characterId: string;
  sourceUrl: string;
  fullNoteLf: string;
  title: string;
  avatarUrl: string;
  iconSize: 18;
  avatarSize: 24;
  headerHeight: 24;
  iconGap: 4;
  bodyGap: 12 | 22;
}
export interface BoundNoteHeader {
  originalNote: string;
  normalizedNote: string;
  title: string;
  body: string;
  avatarUrl: string;
  iconSize: 18;
  avatarSize: 24;
  headerHeight: 24;
  iconGap: 4;
  bodyGap: 12 | 22;
}
const keys = ["version","family","characterId","sourceUrl","fullNoteLf","title","avatarUrl","iconSize","avatarSize","headerHeight","iconGap","bodyGap"].sort();
const prefix = '<template data-nj-public-note-header-v1>';
const suffix = '</template>';
export const noteLf = (text: string) => text.replace(/\r\n/g, "\n");
/** Only a complete dedicated component is recognized, never searched inside a document/script. */
export function parsePublicNoteHeaderComponent(component: string): { metadataOnly: boolean; spec: PublicNoteHeaderSpec | null } {
  if (!component.startsWith(prefix) || !component.endsWith(suffix)) return {metadataOnly:false,spec:null};
  const json = component.slice(prefix.length,-suffix.length);
  try {
    const v: unknown = JSON.parse(json);
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).sort().join() !== keys.join()) return {metadataOnly:true,spec:null};
    const s = v as PublicNoteHeaderSpec;
    const valid = s.version===1 && s.family==='public-note-header-v1' && typeof s.characterId==='string' && /^[a-f0-9-]{36}$/.test(s.characterId) && typeof s.sourceUrl==='string' && /^https:\/\/chat\.mufy\.ai\/chat\?roleId=[a-f0-9-]{36}$/.test(s.sourceUrl) && typeof s.fullNoteLf==='string' && s.fullNoteLf.length<=20000 && !s.fullNoteLf.includes('\r') && typeof s.title==='string' && s.title.length>0 && s.title.length<=128 && !/[\r\n]/.test(s.title) && typeof s.avatarUrl==='string' && /^https:\/\/cdn\.mufy\.ai\/images\/[a-f0-9-]{36}\/public$/.test(s.avatarUrl) && s.iconSize===18 && s.avatarSize===24 && s.headerHeight===24 && s.iconGap===4 && (s.bodyGap===12 || s.bodyGap===22);
    return {metadataOnly:true,spec:valid?s:null};
  } catch { return {metadataOnly:true,spec:null}; }
}
export function publicNoteHeaderEnvelope(spec: PublicNoteHeaderSpec): string {
  return prefix + JSON.stringify(spec).replace(/</g,'\\u003c') + suffix;
}
/** Duplicate, malformed or identity/content mismatch leaves the entire old note branch in use. */
export function bindPublicNoteHeader(components: readonly string[], creatorNote: string, identity: {characterId:string}): BoundNoteHeader | null {
  const metadata = components.map(parsePublicNoteHeaderComponent).filter(x=>x.metadataOnly);
  if(metadata.length!==1 || !metadata[0].spec) return null;
  const s=metadata[0].spec, normalizedNote=noteLf(creatorNote);
  if(s.characterId!==identity.characterId || s.fullNoteLf!==normalizedNote || !normalizedNote.startsWith(s.title+'\n')) return null;
  const body=normalizedNote.slice(s.title.length+1);
  if(!body.length || s.title+'\n'+body!==normalizedNote) return null;
  return {originalNote:creatorNote,normalizedNote,title:s.title,body,avatarUrl:s.avatarUrl,iconSize:18,avatarSize:24,headerHeight:24,iconGap:4,bodyGap:s.bodyGap};
}
/** Only the opt-in branch. Source font family is intentionally not guessed here. */
export const RANK59_BOUND_NOTE_COMPATIBILITY_CSS = `
#nj_author_note[data-nj-public-note-header="v1"]{gap:22px!important}
#nj_author_note[data-nj-public-note-header="v1"]>[data-nj-note-header]{height:24px;min-height:24px;margin:0!important;display:flex;justify-content:space-between;align-items:center}
#nj_author_note[data-nj-public-note-header="v1"]>[data-nj-note-header] [data-nj-note-title]{display:flex;align-items:center;gap:4px;font-size:16px;line-height:24px;color:#59A1D5}
#nj_author_note[data-nj-public-note-header="v1"]>[data-nj-note-header] img{width:24px;height:24px;object-fit:cover;border-radius:50%}
#nj_author_note[data-nj-public-note-header="v1"]>p.whitespace-pre-wrap::first-line{font-size:14px!important;line-height:20px!important;font-weight:400!important;color:rgb(234,234,234)!important}
`;

// Presentation binding only. Public source provenance is recorded in the capture/owner evidence, not authenticated here.
export function derivePublicNoteHeader(components:readonly {enabled:boolean;content:string}[],creatorNote:string|null,characterId:string):BoundNoteHeader|null{
 if(!creatorNote)return null;
 return bindPublicNoteHeader(components.filter(c=>c.enabled).map(c=>c.content),creatorNote,{characterId});
}
