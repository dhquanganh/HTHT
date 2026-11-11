import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView} from '../server/game.mjs';
import {casinos} from '../server/casino.mjs';

test('normal wheel: one free spin a day, then 1 / 8 / 80 chips for 1 / 10 / 100 spins; buying chips; daily spin quest',()=>{
 const p=starterPlayer('Spin');p.inventory['consumable:10']=0;p.wallet.diamonds=5000;
 const r=applyAction(p,'casino',{wheel:'normal'});assert.equal(r.free,true);assert.equal(r.hits.length,1);
 assert.throws(()=>applyAction(p,'casino',{wheel:'normal'}),/Không đủ/);
 const gems=p.wallet.diamonds;applyAction(p,'casino',{wheel:'normal',op:'buy',count:88});assert.equal(p.wallet.diamonds,gems-88*20);assert.equal(p.inventory['consumable:10'],88);
 const ten=applyAction(p,'casino',{wheel:'normal',times:10});assert.equal(ten.hits.length,10);assert.equal(p.inventory['consumable:10'],80);
 const hundred=applyAction(p,'casino',{wheel:'normal',times:100});assert.equal(hundred.hits.length,100);assert.equal(p.inventory['consumable:10']||0,0);
 assert.equal(new Set(hundred.rewards.map(x=>x.itemId)).size,hundred.rewards.length);
 assert.equal(playerView(p).casino.spins,111);assert.ok((p.dailyQuests?.progress?.spin||0)>=1);
});
test('wheel shows 8 distinct pool slots; refresh is free once per forced period, then costs gems; forced refresh rerolls',()=>{
 const p=starterPlayer('Spin3'),t=Date.UTC(2026,10,11,2);let v=playerView(p,t).casino.wheels.normal;
 assert.equal(v.slots.length,8);assert.equal(v.refreshCost,0);assert.equal(v.refreshAt,Date.UTC(2026,10,11,9));
 const ids=p.casino.wheels.normal.slots;assert.equal(new Set(ids).size,8);assert.ok(ids.every(i=>casinos.normal.pool[i]));
 const gems=p.wallet.diamonds;applyAction(p,'casino',{wheel:'normal',op:'refresh'},t);assert.equal(p.wallet.diamonds,gems);
 v=playerView(p,t).casino.wheels.normal;assert.equal(v.refreshCost,20);applyAction(p,'casino',{wheel:'normal',op:'refresh'},t);assert.equal(p.wallet.diamonds,gems-20);
 playerView(p,Date.UTC(2026,10,11,9));assert.equal(p.casino.wheels.normal.refreshes,0);assert.equal(p.casino.wheels.normal.refreshAt,Date.UTC(2026,10,11,17));
});
test('VIP wheel needs level 40 or VIP 3; 10 spins cost 10 super chips',()=>{
 const p=starterPlayer('Spin2');p.inventory['consumable:13']=15;assert.throws(()=>applyAction(p,'casino',{wheel:'super'}),/VIP cấp độ 3/);
 p.vip=3;const r=applyAction(p,'casino',{wheel:'super'});assert.equal(r.hits.length,1);assert.equal(p.inventory['consumable:13'],14);
 applyAction(p,'casino',{wheel:'super',times:10});assert.equal(p.inventory['consumable:13'],4);
});
