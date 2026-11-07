import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView} from '../server/game.mjs';
import {chestData,itemById,heroDefinitions} from '../server/catalog.mjs';
import {rollChest} from '../server/chests.mjs';

const ids=Object.keys(chestData),random=ids.filter(id=>chestData[id].mode==='random'),choice=ids.filter(id=>chestData[id].mode==='choice');
const heroChest=choice.find(id=>chestData[id].rewards.every(r=>r.kind==='hero')),itemChest=choice.find(id=>chestData[id].rewards.every(r=>r.kind==='item'));
const give=(id,n=1)=>{const p=starterPlayer('Captain');p.inventory[id]=n;return p};

test('every chest is an item with deliverable rewards',()=>{
 assert.ok(random.length>=150);assert.ok(choice.length>=80);
 for(const id of ids){const item=itemById.get(id);assert.ok(item,id);assert.ok(item.chest,id);assert.ok(chestData[id].rewards.length,id);for(const r of chestData[id].rewards){assert.ok(r.quantity>0,id);if(r.kind==='item')assert.ok(itemById.has(r.itemId),`${id} ${r.itemId}`);if(r.kind==='hero')assert.ok(heroDefinitions.some(h=>h.avatar===r.avatar),`${id} ${r.avatar}`)}}
});
test('no chest can be bought or sold, so generated prices are not an exploit',()=>{
 const p=starterPlayer('Captain');p.wallet.gold=1e9;p.wallet.diamonds=1e9;
 for(const id of ids){assert.equal(itemById.get(id).noShop,true,id);assert.throws(()=>applyAction(p,'buy',{itemId:id,quantity:1}),/không bán/,id)}
 const q=give('consumable:37');assert.throws(()=>applyAction(q,'sell',{itemId:'consumable:37',quantity:1}),/không bán/);
});
test('every chest opens without errors',()=>{
 for(const id of ids){const p=give(id,2),result=chestData[id].mode==='choice'?applyAction(p,'chest-open',{itemId:id,index:0}):applyAction(p,'chest-open',{itemId:id,count:1});assert.ok(result.rewards.length,id);assert.equal(p.inventory[id],1,id)}
});
test('a random chest pays exactly what it reports',()=>{
 const id=random.find(id=>chestData[id].rewards.every(r=>r.kind==='gold'||r.kind==='diamonds'))||random.find(id=>chestData[id].rewards.some(r=>r.kind==='diamonds'));
 for(let i=0;i<40;i++){const p=give(id),gold=p.wallet.gold,diamonds=p.wallet.diamonds,{rewards}=applyAction(p,'chest-open',{itemId:id,count:1});assert.equal(p.wallet.gold-gold,rewards.filter(r=>r.kind==='gold').reduce((n,r)=>n+r.quantity,0));assert.equal(p.wallet.diamonds-diamonds,rewards.filter(r=>r.kind==='diamonds').reduce((n,r)=>n+r.quantity,0));for(const r of rewards.filter(r=>r.kind==='item'))assert.ok(p.inventory[r.itemId]>=r.quantity)}
});
test('rewards come from the table with equal odds and without repeats in one draw',()=>{
 const id=random.find(id=>chestData[id].rewards.length===5&&!chestData[id].draws),chest=chestData[id],seen=new Map();let seed=9;const roll=()=>{seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296};
 for(let i=0;i<5000;i++){const {rewards}=rollChest(itemById.get(id),{count:1},roll);assert.equal(rewards.length,1);assert.ok(chest.rewards.includes(rewards[0]));seen.set(rewards[0],(seen.get(rewards[0])||0)+1)}
 assert.equal(seen.size,5);for(const n of seen.values())assert.ok(Math.abs(n-1000)<130);
 const multi=random.find(id=>chestData[id].draws>1&&chestData[id].rewards.length>chestData[id].draws);if(multi){const {rewards}=rollChest(itemById.get(multi),{count:1},roll);assert.equal(rewards.length,chestData[multi].draws);assert.equal(new Set(rewards).size,rewards.length)}
});
test('opening ten spends ten and merges repeats into one line',()=>{
 const id=random[0],p=give(id,12),{rewards}=applyAction(p,'chest-open',{itemId:id,count:10});assert.equal(p.inventory[id],2);const keys=rewards.map(r=>r.itemId||r.kind+r.avatar);assert.equal(new Set(keys).size,keys.length);
});
test('a choice chest gives the picked reward',()=>{
 const p=give(itemChest),reward=chestData[itemChest].rewards[1],before=p.inventory[reward.itemId]||0;applyAction(p,'chest-open',{itemId:itemChest,index:1});assert.equal(p.inventory[reward.itemId],before+reward.quantity);assert.equal(p.inventory[itemChest],0);
});
test('a hero chest adds the hero, and the same hero again becomes shards',()=>{
 const reward=chestData[heroChest].rewards.find(r=>r.avatar!=='109'),index=chestData[heroChest].rewards.indexOf(reward),p=give(heroChest,2);
 const first=applyAction(p,'chest-open',{itemId:heroChest,index}).rewards[0];assert.equal(first.fresh,true);assert.ok(playerView(p).heroes.some(h=>h.id==='hero-'+reward.avatar));
 const second=applyAction(p,'chest-open',{itemId:heroChest,index}).rewards[0];assert.equal(second.shardItem,'heroshard:'+reward.avatar);assert.equal(second.quantity,8);assert.equal(p.inventory['heroshard:'+reward.avatar],8);
});
test('bad requests are refused and spend nothing',()=>{
 const p=give(itemChest,1),q=give(random[0],5);
 for(const input of [{itemId:itemChest,index:-1},{itemId:itemChest,index:99999},{itemId:itemChest},{itemId:itemChest,index:0,count:2}])assert.throws(()=>applyAction(p,'chest-open',input));assert.equal(p.inventory[itemChest],1);
 for(const count of [0,11,-1,1.5])assert.throws(()=>applyAction(q,'chest-open',{itemId:random[0],count}));assert.throws(()=>applyAction(q,'chest-open',{itemId:random[0],count:6}),/Không đủ/);assert.equal(q.inventory[random[0]],5);
 assert.throws(()=>applyAction(starterPlayer('Captain'),'chest-open',{itemId:random[0],count:1}),/Không đủ/);assert.throws(()=>applyAction(starterPlayer('Captain'),'chest-open',{itemId:'consumable:1',count:1}),/không mở được/);
});
test('client-supplied rewards are ignored and battles block opening',()=>{
 const p=give(random[0]),gold=p.wallet.gold;const before=JSON.stringify(chestData[random[0]]);applyAction(p,'chest-open',{itemId:random[0],count:1,rewards:[{kind:'gold',quantity:1e12}]});assert.ok(p.wallet.gold<gold+1e11);assert.equal(JSON.stringify(chestData[random[0]]),before);
 const q=give(random[0]);applyAction(q,'battle-start',{stageId:1});assert.throws(()=>applyAction(q,'chest-open',{itemId:random[0],count:1}),/kết thúc trận/);
});
