type Point={x:number;y:number};
export interface HaloStroke {color:string;erase:boolean;points:Point[];clear?:boolean}
/** Vector history is bounded; no image pixels, account state or external canvas is read. */
export function replayHaloStrokes(ctx:CanvasRenderingContext2D,strokes:HaloStroke[],width:number,height:number,base?:HTMLCanvasElement){
 ctx.clearRect(0,0,width,height);
 if(base&&base.width&&base.height)ctx.drawImage(base,0,0);
 for(const stroke of strokes){if(stroke.clear){ctx.clearRect(0,0,width,height);continue;}if(!stroke.points.length)continue;
  const trace=()=>{ctx.beginPath();ctx.moveTo(stroke.points[0].x,stroke.points[0].y);for(const p of stroke.points.slice(1))ctx.lineTo(p.x,p.y);if(stroke.points.length===1)ctx.lineTo(stroke.points[0].x+.01,stroke.points[0].y);};
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.globalCompositeOperation=stroke.erase?'destination-out':'source-over';
  if(stroke.erase){ctx.globalAlpha=1;ctx.lineWidth=24;trace();ctx.stroke();}else{ctx.globalAlpha=.35;ctx.strokeStyle=stroke.color;ctx.shadowColor=stroke.color;ctx.shadowBlur=8;ctx.lineWidth=20;trace();ctx.stroke();ctx.shadowBlur=0;ctx.globalAlpha=.595;ctx.strokeStyle='#ffffff';ctx.lineWidth=11;trace();ctx.stroke();}ctx.restore();
 }
}
export function bindHaloDrawing(root:HTMLElement,onActive:(active:boolean)=>void){
 const q=<T extends HTMLElement=HTMLElement>(id:string)=>root.querySelector<T>('#'+id),canvas=q<HTMLCanvasElement>('censy-drown-canvas'),toolbar=q('censy-drown-island'),grip=q('censy-drown-grip'),palette=q('censy-drown-palette'),picker=q<HTMLInputElement>('censy-drown-picker');
 let active=false,erasing=false,color='#ff6fd8',pointer:number|null=null,drag:{pointer:number;x:number;y:number;left:number;top:number}|null=null,strokes:HaloStroke[]=[],redo:HaloStroke[]=[],current:HaloStroke|null=null;
 const bindings:[EventTarget,string,EventListener][]=[];const listen=(e:EventTarget|null,type:string,fn:EventListener)=>{if(e){e.addEventListener(type,fn);bindings.push([e,type,fn]);}};
 const base=document.createElement('canvas');
 const back=document.createElement('div');back.className='nj_halo_drawing_background';back.hidden=true;canvas?.before(back);
 const colors=['#ff6fd8','#6fc3ff','#c4ff6f','#ffcf6f','#ff4444','#ffffff'];
 const render=()=>{if(!active||!canvas)return;const ctx=canvas.getContext('2d');if(ctx)replayHaloStrokes(ctx,current?[...strokes,current]:strokes,canvas.width,canvas.height,base);};
 const retainHistory=()=>{while(strokes.length>30){const oldest=strokes.shift()!,ctx=base.getContext('2d');if(!ctx)continue;const previous=document.createElement('canvas');previous.width=base.width;previous.height=base.height;previous.getContext('2d')?.drawImage(base,0,0);replayHaloStrokes(ctx,[oldest],base.width,base.height,previous);previous.width=previous.height=0;}};
 const stop=()=>{const previousPointer=pointer;pointer=null;if(previousPointer!==null&&canvas){try{if(canvas.hasPointerCapture(previousPointer))canvas.releasePointerCapture(previousPointer);}catch{/* capture may already be lost */}}if(current){strokes.push(current);current=null;retainHistory();}render();};
 const fitToolbar=()=>{if(!toolbar)return;toolbar.style.transform='none';toolbar.style.bottom='auto';const r=toolbar.getBoundingClientRect(),width=toolbar.offsetWidth,height=toolbar.offsetHeight;toolbar.style.left=Math.max(8,Math.min(r.left,document.documentElement.clientWidth-width-8))+'px';toolbar.style.top=Math.max(8,Math.min(r.top,document.documentElement.clientHeight-height-8))+'px';};
 const resize=()=>{stop();if(!canvas)return;const previous=document.createElement('canvas');previous.width=base.width;previous.height=base.height;if(base.width&&base.height)previous.getContext('2d')?.drawImage(base,0,0);canvas.width=base.width=Math.min(4096,window.innerWidth);canvas.height=base.height=Math.min(4096,window.innerHeight);if(previous.width&&previous.height)base.getContext('2d')?.drawImage(previous,0,0);previous.width=previous.height=0;render();if(active)fitToolbar();};
 const toggle=(value=!active)=>{if(!canvas||!toolbar)return;stop();active=value;root.dataset.haloDrawing=String(value);back.hidden=!value;canvas.inert=!value;toolbar.inert=!value;canvas.setAttribute('aria-hidden',String(!value));toolbar.setAttribute('aria-hidden',String(!value));
  if(value){strokes=[];redo=[];erasing=false;toolbar.style.left='50%';toolbar.style.top='';toolbar.style.bottom='160px';toolbar.style.transform='translateX(-50%)';canvas.width=base.width=Math.min(4096,window.innerWidth);canvas.height=base.height=Math.min(4096,window.innerHeight);const art=document.querySelector<HTMLElement>('#nj_background_image');if(art){const src=art.tagName==='IMG'?(art as HTMLImageElement).currentSrc:'';back.style.backgroundImage=src?`url(${JSON.stringify(src)})`:window.getComputedStyle(art).backgroundImage;}render();toolbar.querySelector<HTMLElement>('[role=button],button')?.focus();}else{strokes=[];redo=[];current=null;canvas.width=canvas.height=base.width=base.height=0;back.style.backgroundImage='none';drag=null;}onActive(value);
 };
 const point=(e:PointerEvent)=>{const r=canvas!.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas!.width/r.width,y:(e.clientY-r.top)*canvas!.height/r.height};};
 listen(canvas,'pointerdown',e=>{const p=e as PointerEvent;if(!active||pointer!==null||p.button!==0)return;pointer=p.pointerId;redo=[];current={color,erase:erasing,points:[point(p)]};canvas!.setPointerCapture?.(p.pointerId);p.preventDefault();render();});
 listen(canvas,'pointermove',e=>{const p=e as PointerEvent;if(pointer!==p.pointerId||!current)return;if(current.points.length<20000)current.points.push(point(p));p.preventDefault();render();});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(canvas,type,e=>{if((e as PointerEvent).pointerId===pointer)stop();});
 listen(window,'blur',()=>{stop();drag=null;});listen(window,'resize',resize);
 const setColor=(c:string)=>{if(!/^#[0-9a-f]{6}$/i.test(c))return;color=c;erasing=false;q('censy-drown-eraser-btn')?.classList.remove('selected');palette?.querySelectorAll<HTMLElement>('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===c)));};
 if(palette){palette.replaceChildren();for(const c of colors){const b=document.createElement('button');b.type='button';b.className='censy-drown-color';b.style.backgroundColor=c;b.dataset.color=c;b.setAttribute('aria-label','画笔颜色 '+c);b.setAttribute('aria-pressed',String(c===color));listen(b,'click',()=>setColor(c));palette.append(b);}}
 listen(picker,'change',()=>setColor(picker!.value));
 listen(grip,'pointerdown',e=>{const p=e as PointerEvent;if(!active||drag||p.button!==0)return;const r=toolbar!.getBoundingClientRect();drag={pointer:p.pointerId,x:p.clientX,y:p.clientY,left:r.left,top:r.top};grip!.setPointerCapture?.(p.pointerId);p.preventDefault();});
 listen(grip,'pointermove',e=>{const p=e as PointerEvent;if(!drag||drag.pointer!==p.pointerId)return;toolbar!.style.transform='none';toolbar!.style.left=drag.left+p.clientX-drag.x+'px';toolbar!.style.top=drag.top+p.clientY-drag.y+'px';fitToolbar();p.preventDefault();});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(grip,type,()=>{drag=null;if(active)fitToolbar();});
 const toolbarObserver=typeof window.ResizeObserver==='function'?new window.ResizeObserver(()=>{if(active&&drag)fitToolbar();}):null;if(toolbar)toolbarObserver?.observe(toolbar);
 toggle(false);
 return {toggle,isActive:()=>active,actions:{
  'censyDrownImmersive()':()=>toggle(),
  'censyDrownUndo()':()=>{stop();const s=strokes.pop();if(s)redo.push(s);render();},
  'censyDrownRedo()':()=>{stop();const s=redo.pop();if(s)strokes.push(s);render();},
  'censyDrownEraser()':()=>{stop();erasing=!erasing;q('censy-drown-eraser-btn')?.classList.toggle('selected',erasing);},
  'censyDrownClear()':()=>{stop();strokes.push({color,erase:false,points:[],clear:true});retainHistory();redo=[];render();},
  'censyDrownAddColor()':()=>picker?.click(),
 },dispose:()=>{toggle(false);toolbarObserver?.disconnect();for(const[e,type,fn]of bindings)e.removeEventListener(type,fn);back.remove();}};
}
