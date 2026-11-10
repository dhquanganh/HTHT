import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView,shipLevel} from '../server/game.mjs';
import {shipData,shipItems,levelCost,levelCap} from '../server/ship.mjs';

const fresh=(level=shipLevel)=>{const p=starterPlayer('Ship_QA');p.account.level=level;p.wallet.gold=1e10;return p};
const ship=(p,op,extra={})=>applyAction(p,'ship',{op,shipId:6,...extra});

test('original tables: 7 ships, unlock fees, level / evolve / ruin costs and 240 active skill levels',()=>{
 assert.equal(shipData.ships.length,7);
 assert.deepEqual(shipData.ships.map(s=>s.unlock),[240,240,320,320,410,410,410]);
 assert.equal(shipData.ships.find(s=>s.id===2).released,false,'Mộc ngưu xa is not released');
 assert.deepEqual(shipData.levels[1],{gold:16000,soul:42});assert.deepEqual(shipData.levels[180],{gold:3172080,soul:23075,wood:800});
 assert.deepEqual(shipData.evolve[30],{gold:400000,soul:2100});assert.deepEqual(shipData.ruins[1],{gold:100031,chaos:243});
 const sunny=shipData.ships.find(s=>s.id===6);assert.equal(sunny.active.length,240);assert.deepEqual({damage:sunny.active[0].damage,targets:sunny.active[0].targets},{damage:1765,targets:2});
 assert.equal(sunny.active[0].status.kind,'stun');
});

test('feature opens at level 20 with a one-time gift; activation spends Hồn chiến hạm',()=>{
 const low=fresh(shipLevel-1);assert.throws(()=>ship(low,'activate'),/cấp 20/);
 const p=fresh();assert.throws(()=>applyAction(p,'ship',{op:'activate',shipId:2}),/không tồn tại/);
 assert.throws(()=>ship(p,'activate'),/Không đủ Hồn chiến hạm/);
 applyAction(p,'ship',{op:'activate',shipId:1});assert.equal(p.inventory[shipItems.soul],300-240);assert.equal(p.inventory[shipItems.chaos],200);
 assert.throws(()=>applyAction(p,'ship',{op:'activate',shipId:1}),/đã được kích hoạt/);
});

test('levels cap at the tier, evolve at 30, passives need tiers, ruins need maxed skills, rebirth refunds souls',()=>{
 const p=fresh();p.inventory[shipItems.soul]=1e7;p.inventory[shipItems.chaos]=1e7;p.inventory[shipItems.wood]=1e6;
 ship(p,'activate');const own=()=>p.ships.list[6];assert.equal(p.ships.selected,6);assert.deepEqual(own().passives,[1,0,0,0]);
 const soul0=p.inventory[shipItems.soul],gold0=p.wallet.gold;ship(p,'level');assert.equal(own().level,2);
 assert.equal(soul0-p.inventory[shipItems.soul],42);assert.equal(gold0-p.wallet.gold,16000);
 while(own().level<30)ship(p,'level');assert.throws(()=>ship(p,'level'),/nâng phẩm/);
 assert.throws(()=>ship(p,'passive',{index:1}),/phẩm 1/);
 ship(p,'tier');assert.equal(own().tier,1);ship(p,'level');assert.equal(own().level,31);
 ship(p,'passive',{index:1});assert.equal(own().passives[1],1);
 while(own().passives[0]<20)ship(p,'passive',{index:0});assert.throws(()=>ship(p,'passive',{index:0}),/phẩm 2/);
 assert.throws(()=>ship(p,'ruin',{index:0}),/tối đa bảng kỹ năng/);
 own().tier=3;own().passives=[30,30,30,30];ship(p,'ruin',{index:0});assert.deepEqual(own().ruins,[1,0,0]);
 const view=playerView(p).ships.list[6];assert.ok(view.ruinsOpen);assert.equal(view.aura.maxHpFlat,shipData.ships[5].passives.reduce((n,lv)=>n+lv[29].find(s=>s.type==='maxHpFlat').value,0)+shipData.ships[5].ruinScale.hp);
 const spent=own().spent.soul,before=p.inventory[shipItems.soul];ship(p,'rebirth');assert.equal(own().level,1);assert.equal(own().tier,0);assert.equal(p.inventory[shipItems.soul]-before,spent);
 assert.ok(levelCost({level:1,tier:0}));assert.equal(levelCap(3),shipData.maxLevel);
});

test('in battle the selected ship buffs the team, charges 25 per allied action and casts when the bar is full',()=>{
 const p=fresh();p.inventory[shipItems.soul]=1000;ship(p,'activate');const hpBefore=playerView(p).hero.stats.maxHp;
 applyAction(p,'battle-start',{stageId:1,formation:[p.hero.id,null,null,null,null,null]});
 const b=p.battle;assert.equal(b.ship.shipId,6);assert.ok(b.allies[0].maxHp>hpBefore,'aura adds HP');
 for(const e of b.enemies){e.hp=e.maxHp=1e7}
 for(let turn=1;turn<=4&&p.battle.status==='active';turn++)applyAction(p,'battle-action',{battleId:b.id,turn,action:'auto'});
 assert.deepEqual(p.battle.events.filter(e=>e.type==='ship-energy').slice(0,4).map(e=>e.energy),[25,50,75,100]);
 const events=p.battle.events,cast=events.find(e=>e.type==='ship-skill');assert.ok(cast,'ship cast');assert.equal(cast.targets.length,Math.min(2,b.enemies.length));
 const hits=events.filter(e=>e.type==='damage'&&e.actor==='ship');assert.equal(hits.length,cast.targets.length);assert.ok(hits.every(h=>h.amount>1000));
 applyAction(p,'battle-leave',{});applyAction(p,'ship',{op:'select',shipId:null});assert.equal(p.ships.selected,null);
});
