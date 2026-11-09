import test from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,heroStats,playerView} from '../server/game.mjs';
import {itemById} from '../server/catalog.mjs';
import {artifactUpgradeData,materialValue,maxStarsOf} from '../server/artifact-upgrade.mjs';

const setup=()=>{const p=starterPlayer('Captain');p.hero.equipment.accessory='artifact:231';Object.assign(p.inventory,{'artifact:51':1,'artifact:55':2,'artifact:2':3});return p};

test('original db_artifact_upgrade_data: red needs 5400 per star, gives 5400, max 6 stars',()=>{
 assert.deepEqual(artifactUpgradeData.upgrade['6'],{baseValue:5400,upgradeCost:5400,maxStar:6});
 assert.deepEqual(artifactUpgradeData.upgrade['1'],{baseValue:20,upgradeCost:40,maxStar:4});
 assert.equal(artifactUpgradeData.materialSlots,8);
 assert.equal(maxStarsOf(itemById.get('artifact:231')),6);assert.equal(maxStarsOf(itemById.get('artifact:2')),4);
 for(const kind of ['bgr_equipment','border_equipment'])assert.equal(Object.keys(artifactUpgradeData.frames[kind]).length,6);
});

test('upgraded artifacts resolve as variants with that star level stats',()=>{
 const v=itemById.get('artifact:231@4:20'),base=itemById.get('artifact:231');
 assert.equal(v.stars,4);assert.equal(v.artifactExp,20);assert.deepEqual(v.points,base.levels[3]);assert.equal(v.slot,'accessory');
 assert.equal(itemById.get('artifact:231@1:0'),undefined,'1-star zero-exp keeps the base key');assert.equal(itemById.get('artifact:231@9:0'),undefined);
 assert.equal(materialValue(v),5400+3*5400+20);
});

test('upgrading the equipped artifact consumes materials, raises stars and keeps overflow EXP',()=>{
 const p=setup(),speed=heroStats(p).speed,gold=p.wallet.gold;
 let r=applyAction(p,'artifact-upgrade',{target:'equipped',materials:{'artifact:51':1}});
 assert.equal(r.stars,2);assert.equal(p.hero.equipment.accessory,'artifact:231@2:0');assert.equal(p.inventory['artifact:51'],0);
 assert.equal(heroStats(p).speed,speed+5);assert.equal(p.wallet.gold,gold);
 r=applyAction(p,'artifact-upgrade',{target:'equipped',materials:{'artifact:55':2,'artifact:2':1}});
 assert.equal(p.hero.equipment.accessory,'artifact:231@4:20');
 // Tháo ra vẫn giữ sao/EXP, nâng tiếp trong túi đổi sang khóa mới và bỏ khóa cũ.
 applyAction(p,'unequip',{slot:'accessory'});assert.equal(p.inventory['artifact:231@4:20'],1);assert.equal(playerView(p).inventory['artifact:231@4:20'],1);
 r=applyAction(p,'artifact-upgrade',{target:'artifact:231@4:20',materials:{'artifact:2':2}});
 assert.equal(r.itemId,'artifact:231@4:60');assert.equal(p.inventory['artifact:231@4:60'],1);assert.equal('artifact:231@4:20' in p.inventory,false);
 applyAction(p,'equip',{itemId:'artifact:231@4:60'});assert.equal(p.hero.equipment.accessory,'artifact:231@4:60');
});

test('upgrade validation: materials owned, at most 8, artifacts only, not at max',()=>{
 const p=setup();
 assert.throws(()=>applyAction(p,'artifact-upgrade',{target:'equipped',materials:{}}),/nguyên liệu/);
 assert.throws(()=>applyAction(p,'artifact-upgrade',{target:'equipped',materials:{'artifact:51':2}}),/Không đủ/);
 assert.throws(()=>applyAction(p,'artifact-upgrade',{target:'equipped',materials:{'equipment:1':1}}),/bảo vật/);
 p.inventory['artifact:2']=9;assert.throws(()=>applyAction(p,'artifact-upgrade',{target:'equipped',materials:{'artifact:2':9}}));
 // Một món trong túi không thể vừa là mục tiêu vừa là nguyên liệu của chính nó.
 p.inventory['artifact:52']=1;assert.throws(()=>applyAction(p,'artifact-upgrade',{target:'artifact:52',materials:{'artifact:52':1}}),/Không đủ/);
 p.hero.equipment.accessory='artifact:231@6:0';assert.throws(()=>applyAction(p,'artifact-upgrade',{target:'equipped',materials:{'artifact:2':1}}),/tối đa/);
 // Lên tới sao tối đa thì EXP dư bỏ đi.
 p.hero.equipment.accessory='artifact:231@5:0';p.inventory['artifact:53']=1;p.inventory['artifact:54']=1;
 applyAction(p,'artifact-upgrade',{target:'equipped',materials:{'artifact:53':1,'artifact:54':1}});assert.equal(p.hero.equipment.accessory,'artifact:231@6:0');
});
