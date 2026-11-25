import {test,expect} from 'bun:test';
import {mufySidebarOwnerIndex as owner} from '../chat/mufy-sidebar-owner';
const opening={id:'opening',role:'assistant'},user={id:'user',role:'user'},old={id:'old',role:'assistant'},next={id:'next',role:'assistant'};
test('completed first reply owns the sidebar',()=>expect(owner([opening,user,old],'ready',null)).toBe(2));
test('sending user message retains previous owner',()=>expect(owner([opening,user,old,user],'submitted',null)).toBe(2));
test('empty and partial new replies never replace previous owner',()=>{for(const status of ['submitted','streaming'])expect(owner([opening,user,old,user,next],status,null)).toBe(2);});
test('completed new reply takes ownership once',()=>expect(owner([opening,user,old,user,next],'ready',null)).toBe(4));
test('continuation retains same owner for frozen sidebar',()=>expect(owner([opening,user,old],'streaming','old')).toBe(2));
test('opening alone does not create a reply widget',()=>expect(owner([opening,user,next],'streaming',null)).toBe(-1));
