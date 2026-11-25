/** Finite native equivalent of the public83 drag gesture; never execute the author script. */
export interface Lin83Position {version:1;left:number;top:number}
export interface Lin83PositionStore {read:()=>unknown;write:(value:Lin83Position)=>void}
const OWN_POSITION_KEY='nj-lin83-native-position-v1';
export function validLin83Position(value:unknown):value is Lin83Position{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)return false;const d=Object.getOwnPropertyDescriptors(value);
 const keys=Reflect.ownKeys(d);if(keys.some(k=>typeof k!=='string')||(keys as string[]).sort().join()!=='left,top,version'||Object.values(d).some(p=>p.get||p.set))return false;
 const p=value as Lin83Position;return p.version===1&&Number.isFinite(p.left)&&Number.isFinite(p.top)&&p.left>=0&&p.top>=0&&p.left<=100000&&p.top<=100000;
}
/** Candidate-owned coordinates only; never inspect source keys, credentials or enumerate storage. */
export function ownLin83PositionStore(view:Window):Lin83PositionStore{
 return {read(){try{const raw=view.localStorage.getItem(OWN_POSITION_KEY);if(!raw||raw.length>128)return null;const v:unknown=JSON.parse(raw);return validLin83Position(v)?v:null}catch{return null}},write(p){if(!validLin83Position(p))return;try{view.localStorage.setItem(OWN_POSITION_KEY,JSON.stringify(p))}catch{/* unavailable storage does not break dragging */}}};
}
export function bindLin83Drag(root:HTMLElement,ball:HTMLElement,handle:HTMLElement,store?:Lin83PositionStore){
 const doc=root.ownerDocument,view=doc.defaultView!;let live=true,active:null|{id:number;x:number;y:number;left:number;top:number;moved:boolean;capture:HTMLElement}=null,suppressClick=false;
 const bounds=()=>({maxX:Math.max(0,view.innerWidth-root.offsetWidth),maxY:Math.max(0,view.innerHeight-root.offsetHeight)});
 const set=(left:number,top:number)=>{const b=bounds();left=Math.max(0,Math.min(left,b.maxX));top=Math.max(0,Math.min(top,b.maxY));for(const[k,v]of Object.entries({left:left+'px',top:top+'px',right:'auto',bottom:'auto',margin:'0'}))root.style.setProperty(k,v,'important');return {version:1 as const,left,top}};
 let saved:unknown;try{saved=store?.read()}catch{saved=null}if(validLin83Position(saved))set(saved.left,saved.top);
 const remove=()=>{doc.removeEventListener('pointermove',move);doc.removeEventListener('pointerup',end);doc.removeEventListener('pointercancel',cancel)};
 const finish=(persist:boolean)=>{const a=active;if(!a)return;active=null;remove();try{if(a.capture.hasPointerCapture?.(a.id))a.capture.releasePointerCapture(a.id)}catch{}if(a.moved){suppressClick=true;if(persist){const p={version:1 as const,left:parseFloat(root.style.left),top:parseFloat(root.style.top)};if(validLin83Position(p))try{store?.write(p)}catch{}}}};
 const move=(e:PointerEvent)=>{const a=active;if(!live||!a||e.pointerId!==a.id)return;const dx=e.clientX-a.x,dy=e.clientY-a.y;if(!a.moved&&(Math.abs(dx)>5||Math.abs(dy)>5))a.moved=true;if(a.moved){e.preventDefault();set(a.left+dx,a.top+dy)}};
 const end=(e:PointerEvent)=>{if(active?.id===e.pointerId)finish(true)};
 // Cancel ends capture/listeners and preserves last visible clamped position; never activates a click.
 const cancel=(e:PointerEvent)=>{if(active?.id===e.pointerId){if(active)active.moved=true;finish(true)}};
 const start=(e:PointerEvent)=>{if(!live||active||e.button!==0||e.isPrimary===false||!Number.isFinite(e.clientX)||!Number.isFinite(e.clientY))return;suppressClick=false;const r=root.getBoundingClientRect();set(r.left,r.top);const target=e.currentTarget as HTMLElement;active={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,moved:false,capture:target};try{target.setPointerCapture?.(e.pointerId)}catch{}doc.addEventListener('pointermove',move,{passive:false});doc.addEventListener('pointerup',end);doc.addEventListener('pointercancel',cancel)};
 const stopDraggedClick=(e:MouseEvent)=>{if(suppressClick||active?.moved){e.preventDefault();e.stopImmediatePropagation();suppressClick=false}};
 for(const node of [ball,handle]){node.style.touchAction='none';node.addEventListener('pointerdown',start);node.addEventListener('click',stopDraggedClick,true)}
 return ()=>{live=false;finish(false);for(const node of [ball,handle]){node.removeEventListener('pointerdown',start);node.removeEventListener('click',stopDraggedClick,true);node.style.removeProperty('touch-action')}remove()};
}
