import {expect,test} from 'bun:test';
import {foldStateErrors} from './mufy-fold-state-validation';
test('ordinary panels must all expand',()=>{
 expect(foldStateErrors([[{open:true},{open:false}]],'expanded')).toEqual(['EXPANSION_INCOMPLETE']);
});
test('native exclusive group has exactly one open panel',()=>{
 expect(foldStateErrors([[{open:false,exclusiveGroup:'a'},{open:true,exclusiveGroup:'a'}]],'reopened')).toEqual([]);
 for(const open of [true,false]) expect(foldStateErrors([[{open,exclusiveGroup:'a'},{open,exclusiveGroup:'a'}]],'expanded')).toEqual(['EXCLUSIVE_GROUP_INVALID']);
});
test('same name in separate iframe documents is independent',()=>{
 expect(foldStateErrors([[{open:true,exclusiveGroup:'a'}],[{open:true,exclusiveGroup:'a'}]],'expanded')).toEqual([]);
});
test('collapsed requires every group and ordinary panel closed',()=>{
 expect(foldStateErrors([[{open:true,exclusiveGroup:'a'}]],'collapsed')).toEqual(['COLLAPSE_INCOMPLETE']);
 expect(foldStateErrors([[{open:false,exclusiveGroup:'a'}]],'collapsed')).toEqual([]);
});
