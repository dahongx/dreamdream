import {test, expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {verifyTestDisk, requireTestDiskCapacity} from './mufy-test-disk-preflight';
const report=(free:number,used:number)=>'Filesystem 1024-blocks Used Available Capacity Mounted on\n'+Array(3).fill(`/dev/vda3 100000000 75000000 ${free} ${used}% /`).join('\n');
test('accepts enough capacity at threshold',()=>expect(verifyTestDisk(report(20*1024*1024,80))).toHaveLength(3));
test('blocks insufficient free space',()=>expect(()=>verifyTestDisk(report(20*1024*1024-1,75))).toThrow('CAPACITY_BLOCKED'));
test('blocks high utilization even with enough bytes',()=>expect(()=>verifyTestDisk(report(30*1024*1024,81))).toThrow('CAPACITY_BLOCKED'));
test('fails closed on missing or malformed measurements',()=>{for(const text of ['', 'df: failed', report(1,20).replace('1 20%','bad 20%')])expect(()=>verifyTestDisk(text)).toThrow();});
test('rejects other host before running a command',async()=>{let calls=0;await expect(requireTestDiskCapacity(async()=>{calls++;return '';},['ssh','other'])).rejects.toThrow('EXACT_TEST_HOST');expect(calls).toBe(0);});
test('all TEST patch entrypoints check capacity before remote writes',()=>{
 for(const name of ['stream','statusbar','shared-style','source-rule','native-table','message-surface','component-fallbacks','sidebar-lifecycle']){
  const source=readFileSync(new URL(`./deploy-mufy-${name}-test.ts`,import.meta.url),'utf8');
  const gate=source.indexOf('await requireTestDiskCapacity(run,ssh)');
  expect(gate).toBeGreaterThan(0);
  expect(gate).toBeLessThan(source.indexOf('umask 077'));
 }
});
