import {test,expect} from 'bun:test';
import {replayHaloStrokes} from '../mufy-halo-drawing';
test('halo drawing replays color glow, eraser and undoable clear without reading external pixels',()=>{
 const calls:string[]=[],ctx={clearRect:()=>calls.push('clear'),drawImage:()=>calls.push('base'),save:()=>{},restore:()=>{},beginPath:()=>{},moveTo:()=>{},lineTo:()=>{},stroke(this:{globalCompositeOperation:string}){calls.push(this.globalCompositeOperation);},globalCompositeOperation:'source-over'} as unknown as CanvasRenderingContext2D;
 const stroke={color:'#ff6fd8',erase:false,points:[{x:10,y:10},{x:20,y:20}]};replayHaloStrokes(ctx,[stroke],390,844);expect(calls).toEqual(['clear','source-over','source-over']);
 calls.length=0;replayHaloStrokes(ctx,[{...stroke,erase:true}],390,844);expect(calls).toEqual(['clear','destination-out']);
 calls.length=0;replayHaloStrokes(ctx,[stroke,{...stroke,points:[],clear:true}],390,844);expect(calls.at(-1)).toBe('clear');
});
