import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {applyTowerConfig,editTower,towerAdminView,towerMonsters,defaultFloorCount,validateFloorEdit} from '../server/tower-config.mjs';
import {towerData} from '../server/catalog.mjs';
import {starterPlayer,applyAction,isRewardId,playerView} from '../server/game.mjs';
const t0=Date.UTC(2026,10,13,3);
afterEach(()=>applyTowerConfig(null));
const fight=p=>{applyAction(p,'tower-start',{},t0);return p.battle};
test('admin view pages through the 2301 original floors',()=>{
 const v=towerAdminView(0);assert.equal(v.total,2301);assert.equal(v.floors.length,20);assert.ok(v.floors[0].enemies[0].head);assert.equal(towerAdminView(115).floors.at(-1).floor,2301);
});
test('pick monsters, level and strength for a floor; battle uses them',()=>{
 const p=starterPlayer('T');const plain=fight(p).enemies.map(e=>({...e}));applyAction(p,'battle-leave',{},t0);
 const a=towerMonsters.slice(0,2).map(h=>String(h.avatar));
 applyTowerConfig(editTower({op:'save',floor:1,data:{enemies:[{avatar:a[0],position:1},{avatar:a[1],position:4}],level:200,scale:150,stars:9}},isRewardId));
 const b=fight(p);assert.deepEqual(b.enemies.map(e=>String(e.avatar)),a);assert.ok(b.enemies.every(e=>e.level===200&&e.stars===9));
 assert.ok(b.enemies[0].maxHp>plain[0].maxHp*10);applyAction(p,'battle-leave',{},t0);
 assert.equal(playerView(p,t0).tower.floors[0].level,200);
});
test('level only: original monsters keep their faces, stats follow the level curve',()=>{
 const p=starterPlayer('T2');const before=fight(p).enemies[0];applyAction(p,'battle-leave',{},t0);
 applyTowerConfig(editTower({op:'save',floor:1,data:{level:10}},isRewardId));const after=fight(p).enemies[0];
 assert.equal(after.avatar,before.avatar);assert.equal(after.level,10);assert.ok(after.maxHp<before.maxHp);
});
test('rewards edit and win grants them; add / remove floors',()=>{
 applyTowerConfig(editTower({op:'save',floor:1,data:{gold:7777,stones:3,drops:[{itemId:'diamonds',quantity:9}]}},isRewardId));
 const p=starterPlayer('T3');const b=fight(p);for(const e of b.enemies)e.hp=0;const gold=p.wallet.gold,gems=p.wallet.diamonds;
 applyAction(p,'battle-action',{battleId:b.id,turn:b.turn,action:'auto'},t0);assert.equal(p.wallet.gold,gold+7777);
 assert.throws(()=>validateFloorEdit({drops:[{itemId:'nope',quantity:1}]},1,isRewardId),/không hợp lệ/);
 assert.throws(()=>editTower({op:'remove'},isRewardId),/đã thêm/);
 let next=editTower({op:'add'},isRewardId);applyTowerConfig(next);assert.equal(towerData.floors.length,defaultFloorCount+1);assert.equal(towerData.floors.at(-1).level,towerData.floors.at(-2).level+1);
 next=editTower({op:'remove'},isRewardId);applyTowerConfig(next);assert.equal(towerData.floors.length,defaultFloorCount);
});
test('every original tower monster can stay in a customised lineup',()=>{
 const v=towerAdminView(0),f=v.floors[0];for(const e of f.enemies)assert.ok(v.monsters.some(m=>m.avatar===e.avatar));
 assert.doesNotThrow(()=>validateFloorEdit({enemies:[{avatar:'319',position:1}]},1,isRewardId));
});
