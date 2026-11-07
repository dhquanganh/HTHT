import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyAction,heroStats,starterPlayer} from '../server/game.mjs';
import {itemById,items} from '../server/catalog.mjs';
import {equipmentBonus,equipmentSets} from '../server/equipment.mjs';

const source=JSON.parse(readFileSync(new URL('../dist/equipment.json',import.meta.url),'utf8'));
const stats=(heroId,ids)=>equipmentBonus(ids,heroId);
test('every equipment row carries the asset numbers',()=>{
 assert.equal(Object.keys(source.items).length,100);
 const cap=itemById.get('equipment:83');assert.equal(cap.name,'Mũ Hải Âu');assert.equal(cap.tier,6);assert.equal(cap.rarity,'red');assert.equal(cap.stars,6);assert.deepEqual(cap.stats,{attack:2469});assert.equal(cap.sellPrice,400000);
 assert.equal(itemById.get('equipment:67').rarity,'green','Database colours map to the colours of the art');assert.equal(itemById.get('equipment:68').rarity,'blue');assert.equal(itemById.get('equipment:70').rarity,'purple');assert.equal(itemById.get('equipment:74').rarity,'yellow');
});
test('the forge chain has 16 recipes per slot, ending at six stars',()=>{
 for(const slot of ['helmet','armor','pants','boots']){const list=items.filter(i=>i.slot===slot&&i.forge);assert.equal(list.length,16,slot);assert.equal(list.filter(i=>i.stars===6).length,1)}
 assert.deepEqual(itemById.get('equipment:83').forge,{material:'equipment:82',count:3,gold:2550000});
});
test('forged equipment is not sold in the shop but can be sold back',()=>{
 const p=starterPlayer('Forge');assert.throws(()=>applyAction(p,'buy',{itemId:'equipment:83',quantity:1}),/không bán/);
 p.inventory['equipment:83']=1;const gold=p.wallet.gold;applyAction(p,'sell',{itemId:'equipment:83',quantity:1});assert.equal(p.wallet.gold,gold+400000);
});
test('forging spends three pieces and the gold',()=>{
 const p=starterPlayer('Forge');p.wallet.gold=10000;p.inventory['equipment:66']=7;
 applyAction(p,'forge',{itemId:'equipment:67',quantity:2});assert.equal(p.inventory['equipment:67'],2);assert.equal(p.inventory['equipment:66'],1);assert.equal(p.wallet.gold,8000);
 assert.throws(()=>applyAction(p,'forge',{itemId:'equipment:67',quantity:1}),/Cần 3/);p.inventory['equipment:66']=3;p.wallet.gold=1;assert.throws(()=>applyAction(p,'forge',{itemId:'equipment:67',quantity:1}),/Không đủ vàng/);
 assert.throws(()=>applyAction(p,'forge',{itemId:'equipment:66',quantity:1}),/không rèn/);
});
test('item points follow db_point_view',()=>{
 const b=stats('luffy-gear-2',['equipment:83']);assert.equal(b.flat.attack,2469);assert.equal(b.combat.skillDamage,.05);
});
test('class lines count only for the matching class',()=>{
 const assassin=stats('zoro-king-of-hell',['equipment:84']);assert.equal(assassin.combat.critChance,undefined,'Zoro is a mage');assert.equal(assassin.percent.attack,.07);
 const warrior=stats('luffy-gear-2',['equipment:100']);assert.equal(warrior.percent.attack,.13,'Luffy counts as warrior: 7% + 6%');assert.equal(warrior.combat.debuffResist,.05);
});
test('set bonuses stack at two, three and four pieces',()=>{
 const set=equipmentSets.find(s=>s.name==='Hải Âu');assert.deepEqual(set.items,['equipment:20','equipment:41','equipment:62','equipment:83']);
 assert.equal(stats('luffy-gear-2',set.items.slice(0,1)).percent.maxHp,undefined);
 assert.equal(stats('luffy-gear-2',set.items.slice(0,2)).percent.maxHp,.16);
 const three=stats('luffy-gear-2',set.items.slice(0,3));assert.equal(three.percent.attack,.21);
 const four=stats('luffy-gear-2',set.items);assert.ok(Math.abs(four.percent.maxHp-.24)<1e-9);assert.equal(four.percent.attack,.21);
});
test('worn equipment changes hero stats',()=>{
 const p=starterPlayer('Forge'),before=heroStats(p);p.inventory['equipment:83']=1;p.hero.equipment.helmet=undefined;delete p.hero.equipment.helmet;const clean=heroStats(p);p.hero.equipment.helmet='equipment:83';const after=heroStats(p);
 assert.equal(after.attack,clean.attack+2469);assert.equal(after.skillDamage,.05);assert.ok(before);
});
import {stoneRows,unlockStone,upgradeStone,convertStone,stoneEffect} from '../server/hero-stones.mjs';
test('hero stones follow db_hero_stone',()=>{
 assert.equal(stoneRows.length,26);const orange=stoneRows.find(r=>r.id===20);assert.equal(orange.name,'Đá Cam');assert.equal(orange.star,6);assert.deepEqual(orange.effects[0][0].point,[[0,2800],[100,310]],'2800 Công, 31% Công');
});
test('the stone slot opens at level 30 and upgrades and converts for gold and dust',()=>{
 const p=starterPlayer('Forge');assert.throws(()=>applyAction(p,'stone-unlock',{}),/cấp 30/);
 p.hero.level=30;applyAction(p,'stone-unlock',{});assert.equal(p.hero.stone.id,1);assert.ok(stoneEffect(p.hero.stone));
 const before=heroStats(p);p.wallet.gold=1e7;p.inventory['consumable:3']=1000;applyAction(p,'stone-upgrade',{});assert.equal(p.hero.stone.id,2);assert.equal(p.inventory['consumable:3'],964);
 const line=p.hero.stone.effect.join();applyAction(p,'stone-convert',{});assert.notEqual(p.hero.stone.effect.join(),line);assert.ok(heroStats(p).attack>=0&&before);
});
test('convert picks another line and upgrade keeps the line by gem_retain_effect',()=>{
 const hero={level:60,stone:{id:20,effect:[0,0]}},pay=()=>{};
 convertStone(hero,pay,()=>0);assert.notDeepEqual(hero.stone.effect,[0,0]);
 hero.stone={id:20,effect:[0,0]};upgradeStone(hero,pay,()=>0);assert.deepEqual(hero.stone,{id:21,effect:[0,0]},'Roll 0 is under the retain chance');
 hero.stone={id:20,effect:[0,1]};upgradeStone(hero,pay,max=>max-1);assert.equal(hero.stone.id,21);
 hero.stone={id:26,effect:[0,0]};assert.throws(()=>upgradeStone(hero,pay),/tối đa/);
});
test('stone stats count in hero stats, Đá Cam item installs a better stone, and items can be used many at once',()=>{
 const p=starterPlayer('Forge'),base=heroStats(p).attack;p.hero.stone={id:20,effect:[0,0]};const st=heroStats(p);assert.equal(st.attack,Math.round((base+2800)*1.31));
 p.inventory['consumable:60004']=1;assert.throws(()=>applyAction(p,'use',{itemId:'consumable:60004',quantity:1}),/cao hơn/);p.hero.stone={id:3,effect:[0,0]};applyAction(p,'use',{itemId:'consumable:60004',quantity:1});assert.equal(p.hero.stone.id,15);
 p.inventory['consumable:1001']=500;const gold=p.wallet.gold;applyAction(p,'use',{itemId:'consumable:1001',quantity:500});assert.equal(p.wallet.gold,gold+500000);
});
