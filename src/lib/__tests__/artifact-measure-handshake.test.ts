import { expect, test } from 'bun:test';
import { wrapBareSrcdoc } from '../regex/iframe-bridge';

test('bare artifact remeasures for its parent after a missed initial resize, rejecting unrelated windows', () => {
    const messages: unknown[] = [];
    const parent = {postMessage(data: unknown) {messages.push(data);}};
    const listeners = new Map<string, (event: {source: unknown; data: unknown}) => void>();
    const window = {parent, addEventListener(type: string, listener: (event: {source: unknown; data: unknown}) => void) {listeners.set(type, listener);}};
    const document = {readyState:'complete',querySelector:()=>null,body:{hasAttribute:()=>true,getBoundingClientRect:()=>({height:347}),scrollHeight:347,offsetHeight:347}};
    const script = [...wrapBareSrcdoc('<div>controlled fixture</div>').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match=>match[1]).find(text=>text.includes('function measure()'));
    if (!script) throw new Error('MEASUREMENT_SCRIPT_MISSING');
    // Execute only our platform sizing script against a controlled fake DOM.
    new Function('window','document','parent',script)(window,document,parent);
    expect(messages).toContainEqual({type:'resize',height:347});
    messages.length=0; // Model the initial report arriving before host subscription.
    const dispatch = listeners.get('message')!;
    dispatch({data:{type:'nj-artifact-measure'},source:null});
    expect(messages).toHaveLength(0);
    dispatch({data:{type:'unknown'},source:parent});
    expect(messages).toHaveLength(0);
    dispatch({data:{type:'nj-artifact-measure'},source:parent});
    expect(messages).toContainEqual({type:'resize',height:347});
    expect(wrapBareSrcdoc('<div/>')).not.toContain('allow-same-origin');
});
