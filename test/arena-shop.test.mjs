import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,playerView,starterPlayer} from '../server/game.mjs';
import {itemById} from '../server/catalog.mjs';
import {applyArenaShopConfig,validateArenaShopConfig,defaultArenaShopConfig,arenaShopConfig} from '../server/arena-shop.mjs';

const isRewardId=id=>['gold','diamonds','spirit'].includes(id)||itemById.has(id);
// 2026-11-16 là thứ Hai.
const at=(d,h=3)=>Date.UTC(2026,10,d,h);
const token='consumable:40';

test('default arena shop config is valid and every reward exists',()=>{
 const c=defaultArenaShopConfig();assert.deepEqual(validateArenaShopConfig(c,isRewardId),c);
 for(const o of c.offers)assert.ok(isRewardId(o.reward.itemId),o.reward.itemId);
 assert.throws(()=>validateArenaShopConfig({...c,reset:'year'},isRewardId),/Kỳ làm mới/);
 assert.throws(()=>validateArenaShopConfig({...c,offers:[{...c.offers[0],price:0}]},isRewardId),/giá/);
 assert.throws(()=>validateArenaShopConfig({...c,offers:[c.offers[0],c.offers[0]]},isRewardId),/trùng/);
 assert.throws(()=>validateArenaShopConfig({...c,offers:[{...c.offers[0],reward:{itemId:'nope',quantity:1}}]},isRewardId),/không tồn tại/);
});

test('buying spends arena tokens, respects the limit and resets weekly',()=>{
 applyArenaShopConfig(null);
 const p=starterPlayer('Captain');p.inventory[token]=3000;const now=at(17),barrels=p.inventory['consumable:16']||0;
 const view=playerView(p,now).shop.arena;assert.equal(view.enabled,true);assert.equal(view.resetAt,Date.UTC(2026,10,22,17),'0:00 thứ Hai sau, giờ Việt Nam');
 applyAction(p,'buy',{op:'arena-buy',id:'barrel',count:2},now);
 assert.equal(p.inventory[token],2000);assert.equal(p.inventory['consumable:16'],barrels+2);
 assert.equal(playerView(p,now).shop.arena.offers.find(o=>o.id==='barrel').bought,2);
 applyAction(p,'buy',{op:'arena-buy',id:'barrel',count:3},now);
 assert.throws(()=>applyAction(p,'buy',{op:'arena-buy',id:'barrel'},now),/hết lượt/);
 assert.throws(()=>applyAction(p,'buy',{op:'arena-buy',id:'rank-ss'},now),/Không đủ|không đủ/);
 // Tuần mới: lượt đổi làm lại.
 const next=at(24);assert.equal(playerView(p,next).shop.arena.offers.find(o=>o.id==='barrel').bought,0);
 p.inventory[token]=500;applyAction(p,'buy',{op:'arena-buy',id:'barrel'},next);assert.equal(p.inventory[token],0);
});

test('admin config applies immediately; disabled shop refuses purchases',()=>{
 const c=arenaShopConfig();
 applyArenaShopConfig(validateArenaShopConfig({...c,reset:'day',offers:[{id:'gem',reward:{itemId:'diamonds',quantity:7},price:3,limit:0}]},isRewardId));
 const p=starterPlayer('Captain');p.inventory[token]=30;const gems=p.wallet.diamonds,now=at(17);
 const v=playerView(p,now).shop.arena;assert.equal(v.offers.length,1);assert.equal(v.resetAt,Date.UTC(2026,10,17,17));
 applyAction(p,'buy',{op:'arena-buy',id:'gem',count:10},now);assert.equal(p.wallet.diamonds,gems+70);assert.equal(p.inventory[token],0);
 applyArenaShopConfig({...arenaShopConfig(),enabled:false});
 assert.equal(playerView(p,now).shop.arena.enabled,false);
 assert.throws(()=>applyAction(p,'buy',{op:'arena-buy',id:'gem'},now),/đang đóng/);
 applyArenaShopConfig(null);
});
