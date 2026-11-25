import {describe, expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {nativePlayerDocumentPresentation} from '../opening/native-player-presentation';

describe('independent source player box model',()=>{
  test('real captured player retains author program and styles while both migration resets are bounded',()=>{
    const original=readFileSync('logs/mufy-profiles/full-20261013/next-batch-30-20261028/final-acceptance/44/black-target-public-srcdoc-20261103.html','utf8');
    const fixed=nativePlayerDocumentPresentation(original);
    expect(fixed).not.toBe(original);
    const scripts=(s:string)=>[...s.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)].map(m=>m[0]);
    const authorStyles=(s:string)=>[...s.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map(m=>m[0]).filter(s=>!s.includes('data-mufy-adaptation="mobile-box-model"'));
    expect(scripts(fixed)).toEqual(scripts(original));
    expect(authorStyles(fixed)).toEqual(authorStyles(original));
    expect(fixed.match(/html,body\{box-sizing:border-box\}/g)?.length).toBe(2);
    expect(nativePlayerDocumentPresentation(fixed)).toBe(fixed);
  });
  test('other documents and author universal resets remain byte identical',()=>{
    const reset='<style>*,*::before,*::after{box-sizing:border-box}</style>';
    const author=reset+'<div class="censy-player-shard censy-paused"></div>';
    expect(nativePlayerDocumentPresentation(author)).toBe(author);
    const other=reset+'<div class="other-player"></div><style data-mufy-adaptation="mobile-box-model">*,*::before,*::after{box-sizing:border-box}</style>';
    expect(nativePlayerDocumentPresentation(other)).toBe(other);
  });
});
