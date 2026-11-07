import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView} from '../server/game.mjs';
import {itemById,heroDefinitions,publicCatalog} from '../server/catalog.mjs';
import {choicePool} from '../server/summon.mjs';
import {applyAdminGrant} from '../server/admin.mjs';

const L1='consumable:53',L2='consumable:54',rare=['dark','light'];
const give=(id,n=1)=>{const p=starterPlayer('Captain');p.inventory[id]=n;return p};

test('L1 offers SS heroes outside the two rare factions, L2 only the rare ones',()=>{
 const one=choicePool(itemById.get(L1)),two=choicePool(itemById.get(L2));assert.ok(one.length>=50);assert.ok(two.length>=30);
 for(const h of one){assert.equal(h.rank,6);assert.ok(!rare.includes(h.faction),h.name)}
 for(const h of two){assert.equal(h.rank,6);assert.ok(rare.includes(h.faction),h.name)}
 for(const h of [...one,...two])assert.ok(heroDefinitions.some(d=>d.avatar===h.avatar),h.name);
});
test('choosing consumes one item and gives 50 shards of that hero, enough to merge',()=>{
 const p=give(L1,2),hero=choicePool(itemById.get(L1))[0],shard='heroshard:'+hero.avatar,result=applyAction(p,'item-choose',{itemId:L1,avatar:hero.avatar});assert.equal(p.inventory[L1],1);assert.equal(p.inventory[shard],50);assert.deepEqual(result.rewards,[{itemId:shard,quantity:50}]);assert.ok(!playerView(p).heroes.some(h=>h.id==='hero-'+hero.avatar),'Not a hero yet');
 applyAction(p,'shard-merge',{itemId:shard});assert.ok(playerView(p).heroes.some(h=>h.id==='hero-'+hero.avatar));assert.equal(p.inventory[shard]||0,0);
});
test('a hero outside the item pool is refused and nothing is spent',()=>{
 const p=give(L1),rareHero=choicePool(itemById.get(L2)).find(h=>h.avatar!=='576');assert.throws(()=>applyAction(p,'item-choose',{itemId:L1,avatar:rareHero.avatar}),/không có trong danh sách/);assert.equal(p.inventory[L1],1);
 assert.throws(()=>applyAction(give(L2),'item-choose',{itemId:L2,avatar:'109'}));
});
test('without the item, or with another item, nothing happens',()=>{
 const p=starterPlayer('Captain'),hero=choicePool(itemById.get(L1))[0];assert.throws(()=>applyAction(p,'item-choose',{itemId:L1,avatar:hero.avatar}),/Không đủ/);assert.throws(()=>applyAction(p,'item-choose',{itemId:'consumable:16',avatar:hero.avatar}),/không thể chọn/);assert.equal(p.reserveHeroes['hero-'+hero.avatar],undefined);
});
test('choosing an owned hero pays shards instead of a duplicate',()=>{
 const p=give(L2),result=applyAction(p,'item-choose',{itemId:L2,avatar:'576'});assert.equal(result.hero.shardItem,'material:zoro-shard');assert.equal(p.inventory[L2]||0,0);assert.match(result.message,/mảnh/);
});
test('choice items cannot be bought or used during a battle',()=>{
 const p=starterPlayer('Captain');p.wallet.gold=1e7;assert.throws(()=>applyAction(p,'buy',{itemId:L1,quantity:1}),/không bán/);assert.equal(p.inventory[L1],undefined);
 const q=give(L1),hero=choicePool(itemById.get(L1))[0];applyAction(q,'battle-start',{stageId:1});assert.throws(()=>applyAction(q,'item-choose',{itemId:L1,avatar:hero.avatar}),/kết thúc trận/);
 assert.ok(publicCatalog().items.find(i=>i.id===L1).noShop);
 const r=give(L1);assert.throws(()=>applyAction(r,'sell',{itemId:L1,quantity:1}),/không bán/);assert.equal(r.inventory[L1],1);
});

test('admin grant adds items and currency and reports what changed',()=>{
 const p=starterPlayer('Captain'),gold=p.wallet.gold;assert.match(applyAdminGrant(p,{itemId:L2,quantity:3,title:'Quà',text:'Chào'}),/Gửi thư: \+3 Thuyền viên SS/);assert.equal(p.inventory[L2],undefined,'Nothing reaches the bag before the player claims');assert.deepEqual(p.mail[0].rewards,[{itemId:L2,quantity:3}]);assert.equal(p.mail[0].title,'Quà');
 assert.match(applyAdminGrant(p,{gold:5000,diamonds:100}),/\+5\.000 vàng, \+100 kim cương/);assert.equal(p.wallet.gold,gold);assert.equal(p.mail.length,2);
 applyAction(p,'mail-claim',{all:true});assert.equal(p.inventory[L2],3);assert.equal(p.wallet.gold,gold+5000);assert.throws(()=>applyAction(p,'mail-claim',{all:true}),/Không có thư/);
});
test('admin grant can remove, but never below zero, and removes empty stacks',()=>{
 const p=give(L1,2);applyAdminGrant(p,{itemId:L1,quantity:-2});assert.equal(L1 in p.inventory,false);assert.throws(()=>applyAdminGrant(p,{itemId:L1,quantity:-1}),/không đủ/);
 const gold=p.wallet.gold;assert.throws(()=>applyAdminGrant(p,{gold:-(gold+1)}),/không đủ vàng/);assert.equal(p.wallet.gold,gold);
});
test('admin grant rejects bad input without partial changes',()=>{
 const p=starterPlayer('Captain');for(const input of [{},{itemId:'fake:1',quantity:1},{itemId:L1,quantity:0},{itemId:L1,quantity:1.5},{itemId:L1,quantity:'x'},{itemId:L1,quantity:1e9},{gold:1.5},{gold:0}])assert.throws(()=>applyAdminGrant(p,input),undefined,JSON.stringify(input));
 assert.equal(p.inventory[L1],undefined);assert.equal(p.mail?.length||0,0);
});
test('a mail with a bad deduction sends nothing',()=>{
 const p=starterPlayer('Captain');assert.throws(()=>applyAdminGrant(p,{itemId:L1,quantity:2,gold:-1e11}),/không đủ vàng/);assert.equal(p.mail?.length||0,0);
});
test('mail is claimed once and deleted only after claiming',()=>{
 const p=starterPlayer('Captain');applyAdminGrant(p,{itemId:L1,quantity:1});const id=p.mail[0].id;
 assert.throws(()=>applyAction(p,'mail-delete',{id}),/nhận quà trước/);applyAction(p,'mail-claim',{id});assert.equal(p.inventory[L1],1);assert.throws(()=>applyAction(p,'mail-claim',{id}),/đã nhận/);applyAction(p,'mail-delete',{id});assert.equal(p.mail.length,0);assert.throws(()=>applyAction(p,'mail-claim',{id:'nope'}),/Không có thư/);
});
