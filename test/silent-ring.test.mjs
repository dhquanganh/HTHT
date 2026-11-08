import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView} from '../server/game.mjs';
import {silentData,bossSkillLevel,seasonRewards,seasonOf} from '../server/silent-ring.mjs';

const now=Date.UTC(2026,10,10,5);// thứ Ba, mùa đang mở
const player=()=>{const p=starterPlayer('SR');p.account.level=100;p.hero.level=300;p.hero.stars=15;return p};
const team=p=>[p.hero.id,null,null,null,null,null];

test('db_boss_silent: 5 độ khó, hộ vệ Giant Squid / Sea Cow, boss Lord of the Coast, mốc và quà gốc',()=>{
 assert.equal(silentData.diffs.length,5);const d=silentData.diffs[0];
 assert.deepEqual(d.rankDmg,[14000000,360000000,630000000,900000000]);assert.deepEqual(d.reward[0],[3,1,2,200,3,1,3004,50,3,1,3003,1]);
 assert.equal(silentData.units['30000'].name,'Lord of the Coast');assert.equal(silentData.units['30006'].name,'Giant Squid');
 assert.equal(bossSkillLevel(d.hpSkill,100),5);assert.equal(bossSkillLevel(d.hpSkill,0),0);assert.equal(bossSkillLevel(d.hpSkill,30),2);
});

test('báo danh, đánh hộ vệ 1 → 2 → boss, mỗi thuyền viên 1 lần mỗi ngày, boss tốn lượt',()=>{
 const p=player();assert.throws(()=>applyAction(p,'sr-start',{diff:1,target:1,formation:team(p)},now),/báo danh/);
 applyAction(p,'sr-checkin',{heroes:[p.hero.id]},now);
 assert.throws(()=>applyAction(p,'sr-start',{diff:1,target:3,formation:team(p)},now),/hai hộ vệ/);
 assert.throws(()=>applyAction(p,'sr-start',{diff:1,target:2,formation:team(p)},now),/hộ vệ 1/);
 applyAction(p,'sr-start',{diff:1,target:1,formation:team(p),skip:true},now);assert.ok(p.battle.reward.damage>0);
 assert.throws(()=>applyAction(p,'sr-start',{diff:1,target:2,formation:team(p)},now+1),/đã tham chiến/);
 p.silentRing.used={};applyAction(p,'sr-start',{diff:1,target:2,formation:team(p),skip:true},now+2);
 p.silentRing.used={};applyAction(p,'sr-start',{diff:1,target:3,formation:team(p),skip:true},now+3);
 const v=playerView(p,now+4).silentRing;assert.equal(v.turns,4);assert.ok(v.damage[0]>0);assert.equal(v.bossHp[0],v.bossMax[0]-v.damage[0]);
});

test('quà theo sát thương 1 lần đánh boss và thưởng mùa (boss bị hạ thì nhân đôi)',()=>{
 const r=seasonRewards([14e6,0,0,0,0],[false,false,false,false,false]);assert.deepEqual(r,[{itemId:'consumable:3002',quantity:1},{itemId:'consumable:3001',quantity:1},{itemId:'consumable:3000',quantity:1}]);
 const twice=seasonRewards([9e8,0,0,0,0],[true,false,false,false,false]);assert.deepEqual(twice.find(x=>x.itemId==='consumable:3001'),{itemId:'consumable:3001',quantity:8});
 const p=player();applyAction(p,'sr-checkin',{heroes:[p.hero.id]},now);p.silentRing.damage[0]=4e8;
 const later=now+7*86400e3;assert.notEqual(seasonOf(later),seasonOf(now));
 const v=playerView(p,later).silentRing;assert.ok(v.lastReward);const before=p.inventory['consumable:3001']||0;
 applyAction(p,'sr-season',{},later);assert.equal((p.inventory['consumable:3001']||0)-before,2,'mốc 2 của Dễ: Thuốc tái tạo ×2');
 assert.throws(()=>applyAction(p,'sr-season',{},later),/Chưa có thưởng mùa/);
});

test('thành tựu theo mùa: khiêu chiến hộ vệ, khiêu chiến boss, tổng sát thương',()=>{
 const p=player();applyAction(p,'sr-checkin',{heroes:[p.hero.id]},now);p.silentRing.guardFights=10;
 const a=playerView(p,now).silentRing.achievements;assert.equal(a[0].text,'Khiêu chiến hộ vệ 10 lần');assert.equal(a[0].status,1);
 assert.equal(a[2].text,'Tổng sát thương lên Lord of the Coast (Dễ) đạt 14 triệu');
 const exp=p.inventory['consumable:3004']||0;applyAction(p,'sr-claim',{id:'guard'},now);assert.equal(p.inventory['consumable:3004']-exp,100);
 assert.throws(()=>applyAction(p,'sr-claim',{id:'guard'},now),/Đã nhận/);
});
