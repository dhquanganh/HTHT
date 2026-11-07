import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {starterPlayer,applyAction,heroStats} from '../server/game.mjs';
import {items,itemById,itemIcon,publicCatalog} from '../server/catalog.mjs';
import {applyAdminGrant} from '../server/admin.mjs';

const extras=JSON.parse(readFileSync(new URL('../dist/items-extra.json',import.meta.url),'utf8'));
const artifact=extras.find(i=>i.category==='artifact'),consumable=extras.find(i=>i.category==='consumable'),shard=extras.find(i=>i.category==='shard');

test('every source item with art is in the catalog, once, with a name and an icon',()=>{
 assert.ok(extras.length>=900);assert.equal(new Set(items.map(i=>i.id)).size,items.length);
 for(const i of items){assert.ok(i.name?.trim(),i.id);assert.ok(itemIcon(i),i.id);assert.ok(!/<[^>]+>/.test(i.name),i.id)}
 assert.ok(artifact&&consumable&&shard);assert.ok(itemById.has('artifact:112'));assert.ok(itemById.has('consumable:115'));
});
test('existing items keep their ids, prices and stats',()=>{
 assert.equal(itemById.get('consumable:16').price,100);assert.equal(itemById.get('consumable:1').wallet,'spirit');assert.ok(itemById.get('equipment:1').stats.attack>0);assert.equal(itemById.get('consumable:53').noShop,true);assert.ok(!itemById.get('equipment:1').noShop);
});
test('new items cannot be bought or sold, so generated prices are never an exploit',()=>{
 const p=starterPlayer('Captain');p.wallet.gold=1e7;for(const i of [artifact,consumable,shard]){assert.throws(()=>applyAction(p,'buy',{itemId:i.id,quantity:1}),/không bán/);p.inventory[i.id]=1;assert.throws(()=>applyAction(p,'sell',{itemId:i.id,quantity:1}),/không bán/);assert.equal(p.inventory[i.id],1)}
});
test('admin can grant any catalog item',()=>{
 const p=starterPlayer('Captain');for(const i of items.slice(-5))applyAdminGrant(p,{itemId:i.id,quantity:2});applyAction(p,'mail-claim',{all:true});for(const i of items.slice(-5))assert.equal(p.inventory[i.id],2);
});
test('a new artifact equips, raises stats and returns to the bag',()=>{
 const p=starterPlayer('Captain');p.inventory[artifact.id]=1;const before=heroStats(p).attack;applyAction(p,'equip',{itemId:artifact.id});assert.equal(p.hero.equipment.accessory,artifact.id);assert.ok(heroStats(p).attack>before);applyAction(p,'unequip',{slot:'accessory'});assert.equal(p.inventory[artifact.id],1);
});
test('a new consumable without an effect cannot be used up',()=>{
 const p=starterPlayer('Captain');p.inventory[consumable.id]=1;assert.throws(()=>applyAction(p,'use',{itemId:consumable.id,quantity:1}));assert.equal(p.inventory[consumable.id],1);
});
test('the client receives every item',()=>{assert.equal(publicCatalog().items.length,items.length)});
