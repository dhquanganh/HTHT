import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView} from '../server/game.mjs';
import {shopConfig,refreshCost} from '../server/shop.mjs';
const t0=Date.UTC(2026,10,12,3);
test('market shelf: 12 distinct goods, same all day, new shelf next day',()=>{
 const p=starterPlayer('Shop'),a=playerView(p,t0).shop;assert.equal(a.items.length,shopConfig.slots);
 assert.equal(new Set(a.items.map(i=>i.reward.itemId)).size,shopConfig.slots);
 assert.deepEqual(playerView(p,t0+3600000).shop.items,a.items);
 assert.notDeepEqual(playerView(p,t0+86400000).shop.items.map(i=>i.reward),a.items.map(i=>i.reward));
});
test('buy once with the listed currency; refresh costs rising gems',()=>{
 const p=starterPlayer('Shop2');p.wallet.gold=1e7;p.wallet.diamonds=1e4;const o=playerView(p,t0).shop.items[0],cur=o.price.itemId,before=p.wallet[cur];
 const r=applyAction(p,'buy',{op:'buy',slot:0},t0);assert.deepEqual(r.rewards,[o.reward]);assert.equal(p.wallet[cur],before-o.price.quantity);
 assert.throws(()=>applyAction(p,'buy',{op:'buy',slot:0},t0),/Đã mua/);
 const g=p.wallet.diamonds;applyAction(p,'buy',{op:'refresh'},t0);assert.equal(p.wallet.diamonds,g-refreshCost(0));
 assert.equal(playerView(p,t0).shop.refreshCost,refreshCost(1));assert.ok(playerView(p,t0).shop.items.every(i=>!i.bought));
});
test('cannot afford',()=>{const p=starterPlayer('Shop3');p.wallet.gold=0;p.wallet.diamonds=0;assert.throws(()=>applyAction(p,'buy',{op:'buy',slot:0},t0))});
test('sealed land store: pay seal books, daily limit',()=>{
 const p=starterPlayer('Shop4');p.inventory['material:seal-book']=1000;const o=playerView(p,t0).shop.sealed[0];
 for(let i=0;i<o.limit;i++)applyAction(p,'buy',{op:'sealed-buy',id:o.id},t0);assert.equal(p.inventory['material:seal-book'],1000-o.limit*o.price.quantity);
 assert.throws(()=>applyAction(p,'buy',{op:'sealed-buy',id:o.id},t0),/hết lượt/);assert.equal(playerView(p,t0+86400000).shop.sealed[0].bought,0);
});
