import {expect,test} from 'bun:test';
import {insMusicTriggerTop,insMusicDocumentPresentation} from '../opening/native-ins-presentation';
import spec from '../../../logs/mufy-profiles/full-20261013/next-batch-30-20261028/rule-repairs/45/native-ins-music/sidebar-spec.json';

test('INS uses its source placement rather than replacing205px with20vh',()=>{
 expect(insMusicTriggerTop(spec.css)).toBe('205px');
 expect(insMusicTriggerTop('/* .ins-music-sidebar{top:999px} */.ins-music-sidebar{top:15vh;top:205px!important;}')).toBe('205px');
 expect(insMusicTriggerTop('.ins-music-sidebar{top:30%;}')).toBe('30%');
 for(const css of ['.other{top:205px}', '.ins-music-sidebar{top:calc(100% + 2px)}','.ins-music-sidebar{top:-5px}','.ins-music-sidebar{top:9999px}','.ins-music-sidebar{top:101vh}'])expect(insMusicTriggerTop(css)).toBeUndefined();
});

test('semantic INS buttons keep source typography, inline append and all other document bytes',()=>{
 const document=spec.documents[0],shown=insMusicDocumentPresentation(document);
 expect(shown.slice(shown.indexOf('</style>')+8).replace('window.host.fillComposer(str,{separator:"none"});','window.host.fillComposer(str);')).toBe(document);
 expect(shown).toContain('window.host.fillComposer(str,{separator:"none"});');
 expect(shown).toContain('#ins-wrapper-cen{line-height:1.5}');
 expect(shown).toContain('#ins-wrapper-cen button{font-family:inherit;line-height:inherit}');
 expect(insMusicDocumentPresentation(shown)).toBe(shown);
 expect(insMusicDocumentPresentation('<script>window.host.fillComposer(str);</script>')).toContain('window.host.fillComposer(str);');
});
