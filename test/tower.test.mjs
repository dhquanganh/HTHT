import {ensureRoster} from '../server/hero-roster.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView} from '../server/game.mjs';
import {towerData,materials,itemById,stages} from '../server/catalog.mjs';
import {towerStrength} from '../server/tower.mjs';

const start=Date.UTC(2026,10,6,8),day=86400000,formation=['luffy-gear-2',null,null,null,null,null];
function fight(p,now,win){applyAction(p,'tower-start',{formation},now);if(win)for(const unit of p.battle.enemies)unit.hp=1;for(const unit of p.battle.allies){unit.attack=win?1e7:1;unit.speed=win?1e6:1;unit.hp=unit.maxHp=win?1e9:1}let rounds=0;while(p.battle.status==='active'&&rounds++<45)applyAction(p,'battle-action',{battleId:p.battle.id,turn:p.battle.turn,action:'auto'},now);return p.battle}

test('every floor comes from db_tower with enemies, known rewards and a playable look',()=>{
 const {floors,enemies}=towerData;assert.equal(floors.length,2301);
 assert.deepEqual([floors[1].gold,floors[1].stones],[5000,5]);
 for(const row of floors){assert.ok(row.enemies.length>=1&&row.enemies.length<=6,'floor '+row.floor);for(const slot of row.enemies)assert.ok(enemies[slot.monsterId],'floor '+row.floor);for(const drop of row.drops)assert.ok(itemById.has(drop.itemId),drop.itemId)}
});

test('player sees the current floor and the next three',()=>{
 const view=playerView(starterPlayer('Captain'),start).tower;assert.equal(view.floor,1);assert.equal(view.turns,5);assert.equal(view.maxTurns,5);assert.deepEqual(view.floors.map(f=>f.floor),[1,2,3,4]);assert.ok(view.floors[0].avatar);
});

test('winning climbs one floor, pays the table reward and keeps the turn',()=>{
 const p=starterPlayer('Captain'),gold=p.wallet.gold,stones=p.inventory[materials.rank],row=towerData.floors[0];
 const b=fight(p,start,true);assert.equal(b.status,'won');assert.equal(p.tower.floor,2);assert.equal(p.tower.turns,5);
 assert.equal(p.wallet.gold,gold+row.gold);assert.equal(p.inventory[materials.rank],stones+row.stones);assert.equal(b.reward.gold,row.gold);assert.equal(p.adventure.wins,0);assert.deepEqual(p.adventure.cleared,[]);
});

test('a floor with equipment drops it into the bag',()=>{
 const p=starterPlayer('Captain');p.tower.floor=10;const before=p.inventory['equipment:6']||0;fight(p,start,true);assert.equal(p.inventory['equipment:6'],before+1);
});

test('losing or retreating costs one turn and pays nothing',()=>{
 const p=starterPlayer('Captain'),gold=p.wallet.gold;const b=fight(p,start,false);assert.equal(b.status,'lost');assert.equal(p.tower.turns,4);assert.equal(p.tower.floor,1);assert.equal(p.wallet.gold,gold);
 applyAction(p,'tower-start',{formation},start);applyAction(p,'battle-leave',{},start);assert.equal(p.tower.turns,3);assert.equal(p.tower.floor,1);
});

test('turns run out, then refill at midnight UTC+7',()=>{
 const p=starterPlayer('Captain');for(let i=0;i<5;i++){applyAction(p,'tower-start',{formation},start);applyAction(p,'battle-leave',{},start)}
 assert.equal(playerView(p,start).tower.turns,0);assert.throws(()=>applyAction(p,'tower-start',{formation},start),/hết lượt/);
 const midnight=Date.UTC(2026,10,6,17);assert.equal(playerView(p,midnight-1000).tower.turns,0);assert.equal(playerView(p,midnight).tower.turns,5);applyAction(p,'tower-start',{formation},midnight);assert.equal(p.tower.turns,4);
});

test('a finished battle cannot pay twice, and an active battle blocks a new one',()=>{
 const p=starterPlayer('Captain');const b=fight(p,start,true),gold=p.wallet.gold;assert.throws(()=>applyAction(p,'battle-action',{battleId:b.id,turn:b.turn,action:'auto'},start));assert.equal(p.wallet.gold,gold);assert.equal(p.tower.floor,2);
 applyAction(p,'tower-start',{formation},start);assert.throws(()=>applyAction(p,'tower-start',{formation},start),/kết thúc trận/);
});

test('client-supplied floors and rewards are ignored; the last floor ends the climb',()=>{
 const p=starterPlayer('Captain');applyAction(p,'tower-start',{formation,floor:2000,gold:1e9},start);assert.equal(p.battle.tower.floor,1);
 const q=starterPlayer('Captain');q.tower.floor=2302;assert.equal(playerView(q,start).tower.floors.length,0);assert.throws(()=>applyAction(q,'tower-start',{formation},start),/leo hết/);
});

test('accounts saved before the tower existed start at floor one',()=>{
 const p=starterPlayer('Captain');delete p.tower;assert.equal(playerView(p,start).tower.floor,1);applyAction(p,'tower-start',{formation},start);assert.equal(p.tower.turns,4);
});

test('strength follows campaign power and keeps rising past the last stage',()=>{
 assert.equal(towerStrength(stages[0].enemyPower),1);assert.ok(towerStrength(5130)>towerStrength(3704));const last=Math.max(...stages.map(s=>s.enemyPower));assert.ok(towerStrength(last*10)>stages.length);
});
test('tower rewards match db_tower',()=>{
 assert.equal(materials.rank,'consumable:2','promostone is Đá cường hóa');
 const floor=n=>towerData.floors[n-1];
 assert.deepEqual([floor(1).gold,floor(1).stones,floor(1).drops],[5000,5,[]]);
 assert.deepEqual(floor(5).drops,[{itemId:'heroshard:156',quantity:60}]);assert.equal(itemById.get('heroshard:156').name,'Mảnh Brook');
 assert.deepEqual(floor(10).drops,[{itemId:'equipment:6',quantity:1}]);
 assert.deepEqual(floor(105).drops,[{itemId:'shard:30000',quantity:50}]);
 assert.deepEqual(floor(405).drops,[{itemId:'consumable:16',quantity:5}]);
 assert.deepEqual(floor(430).drops,[{itemId:'consumable:13',quantity:10}]);
 assert.deepEqual(floor(530).drops,[{itemId:'consumable:13',quantity:30}],'The other column wins over item_use_number');assert.deepEqual(floor(605).drops,[{itemId:'consumable:16',quantity:8}]);assert.deepEqual(floor(705).drops,[{itemId:'consumable:16',quantity:50}]);
 for(const row of towerData.floors)for(const drop of row.drops)assert.ok(itemById.has(drop.itemId),drop.itemId);
});
test('old rank stones become Đá cường hóa',()=>{
 const p=starterPlayer('Captain'),before=p.inventory['consumable:2'];p.inventory['material:rank-stone']=7;ensureRoster(p);assert.equal(p.inventory['consumable:2'],before+7);assert.equal('material:rank-stone' in p.inventory,false);
});
