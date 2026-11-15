import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView,heroStats} from '../server/game.mjs';
import {grantSummon} from '../server/summon.mjs';
import {heroDefinitions,heroKits} from '../server/catalog.mjs';
import {decorConfig,defaultDecorConfig,validateDecorConfig,applyDecorConfig,points,furniture,heroSets,hammer,goldCard,redCard,decorBonus,mythicHeroes,slotAccepts} from '../server/decor.mjs';

const now=Date.UTC(2026,10,16,3);
function player(){const p=starterPlayer('Decor');p.account.level=60;p.reserveHeroes??={};p.inventory[hammer]=10000;
 for(const d of heroDefinitions.filter(d=>heroKits.has(d.id)&&mythicHeroes.includes(d.id)).slice(0,3))grantSummon(p,{avatar:d.avatar});return p}
const view=p=>playerView(p,now).decor;

test('dữ liệu gốc: 94 nội thất, 5772 phiên bản, bộ riêng tướng; cấu hình hợp lệ',()=>{
 assert.equal(furniture.size,94);assert.equal(points.size,5772);assert.ok(heroSets.size>=100);
 assert.deepEqual(validateDecorConfig(defaultDecorConfig()),defaultDecorConfig());
 assert.throws(()=>validateDecorConfig({...defaultDecorConfig(),rates:[0,0]}),/lớn hơn 0/);
 assert.ok(slotAccepts(1,2)&&slotAccepts(9,3)&&!slotAccepts(3,1)&&slotAccepts(10,1)&&!slotAccepts(18,2));
});

test('chế tạo x1 / x10 tốn Búa gỗ, mỗi 30 lần nhận Thẻ vàng; kho đầy bị chặn',()=>{
 const p=player(),c=decorConfig();applyAction(p,'decor-create',{count:1},now);assert.equal(p.inventory[hammer],10000-c.price);assert.equal(view(p).items.length,1);
 for(let i=0;i<3;i++)applyAction(p,'decor-create',{count:10},now);assert.equal(view(p).created,31);assert.equal(p.inventory[goldCard],1);
 assert.ok(view(p).items.every(i=>i.quality===1||i.quality===2));
 applyDecorConfig({...defaultDecorConfig(),maxItems:31});try{assert.throws(()=>applyAction(p,'decor-create',{count:1},now),/đầy/)}finally{applyDecorConfig(null)}
});

test('đặt hàng vàng (nghề + hệ) và đỏ (tướng riêng)',()=>{
 const p=player();p.inventory[goldCard]=1;p.inventory[redCard]=1;
 const g=applyAction(p,'decor-legend',{clazz:'warrior',faction:'light'},now).items[0];assert.equal(g.quality,2);assert.equal(g.clazz,'warrior');assert.equal(g.faction,'light');
 const hero=mythicHeroes[0],r=applyAction(p,'decor-mythic',{hero},now).items[0];assert.equal(r.quality,3);assert.equal(r.hero,hero);
 assert.throws(()=>applyAction(p,'decor-legend',{clazz:'warrior',faction:'light'},now),/Không đủ|không đủ|thiếu|Thiếu/);
});

test('đặt nội thất: đúng hàng; chỉ số cộng cho tướng đúng hệ; bộ riêng 6 món; tái chế món chưa đặt',()=>{
 const p=player(),heroId=Object.keys(p.reserveHeroes)[0],def=heroDefinitions.find(d=>d.id===heroId),set=heroSets.get(heroId);
 applyAction(p,'decor-hero',{floor:0,hero:heroId},now);
 // 6 món của bộ riêng (thêm thẳng vào kho để kiểm luật đặt).
 const s=p.decor;const ids=[...set.items].slice(0,6);for(const id of ids)s.items.push({uid:s.nextUid++,point:id});
 const before=heroStats({...p,hero:p.reserveHeroes[heroId]}).attack;
 let up=1,low=10;for(const it of s.items.slice(-6)){const place=furniture.get(points.get(it.point).item).place,slot=place===1?low++:up++;applyAction(p,'decor-place',{floor:0,slot,uid:it.uid},now)}
 const wrong=s.items.find(it=>furniture.get(points.get(it.point).item).place===1);if(wrong)assert.throws(()=>applyAction(p,'decor-place',{floor:0,slot:1,uid:wrong.uid},now),/hàng dưới/);
 assert.equal(view(p).floors[0].set.have,6);
 const b=decorBonus(p,heroId);assert.ok(b.groups.length>0);assert.ok(heroStats({...p,hero:p.reserveHeroes[heroId]}).attack>before,'Công tăng nhờ nội thất');
 assert.ok(def);
 applyAction(p,'decor-create',{count:10},now);const free=view(p).items.filter(i=>!i.placed).map(i=>i.uid);const h=p.inventory[hammer];
 applyAction(p,'decor-recycle',{uids:free},now);assert.ok(p.inventory[hammer]>h);assert.equal(view(p).items.length,6);
 assert.throws(()=>applyAction(p,'decor-recycle',{uids:[s.items[0].uid]},now),/tháo/);
 applyAction(p,'decor-clear',{floor:0},now);assert.equal(Object.keys(view(p).floors[0].slots).length,0);
 applyAction(p,'decor-auto',{floor:0},now);assert.equal(Object.keys(view(p).floors[0].slots).length,6);
});

test('Búa gỗ miễn phí mỗi ngày',()=>{
 const p=player();applyAction(p,'decor-daily',{},now);assert.equal(p.inventory[hammer],10000+decorConfig().dailyHammers);
 assert.throws(()=>applyAction(p,'decor-daily',{},now),/đã nhận/);applyAction(p,'decor-daily',{},now+86400000);
});
