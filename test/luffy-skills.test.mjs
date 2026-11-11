import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,heroStats,playerView} from '../server/game.mjs';
import {skills} from '../server/catalog.mjs';
import {effectiveStat,skillTier} from '../server/luffy-skills.mjs';
const round=(p,action='auto')=>applyAction(p,'battle-action',{battleId:p.battle.id,turn:p.battle.turn,action});
// Cấp kỹ năng theo sao: 5 sao là cấp 3 cho cả bộ kỹ năng.
function durableBattle(levels={}){const p=starterPlayer('Captain');if(Object.keys(levels).length)p.hero.stars={1:1,2:3,3:5,4:6}[Math.max(...Object.values(levels))];applyAction(p,'battle-start',{stageId:1},12345);const e=p.battle.enemies[0];e.hp=e.maxHp=100000;e.critChance=0;return p}

test('four original icon IDs and level-three descriptions match the reference',()=>{
 assert.deepEqual(skills.map(s=>s.iconId),['685','140','183','160']);assert.deepEqual(skills.map(s=>s.name),['Roi Cao Su','Mài Dũa','Haki Vũ Trang','Tuyệt Cảnh']);
 assert.deepEqual(skills[0].levels[2].values,{damage:3.2,heal:5.6,attackBuff:.6});assert.equal(skills[1].levels[2].values.critReduction,.18);assert.deepEqual(skills[2].levels[2].values,{armor:.4,hp:.4});assert.equal(skills[3].levels[2].values.armor,1.2);
});
test('legacy upgrades remain stored and map to the current skill set without charging currency',()=>{
 const p=starterPlayer('Captain');p.hero.skills={'jet-pistol':2,'jet-gatling':4,'gear-second':3};const gold=p.wallet.gold,inventory=structuredClone(p.inventory);
 applyAction(p,'profile-update',{op:'level-ack'});assert.equal(p.hero.skills['jet-gatling'],4);assert.equal(p.hero.skills['rubber-whip'],4);assert.equal(p.hero.skills.polish,2);assert.equal(p.hero.skills['armament-haki'],3);assert.equal(p.hero.skills.desperation,1);assert.equal(p.wallet.gold,gold);assert.deepEqual(p.inventory,inventory);assert.equal(Object.keys(playerView(p).hero.skills).length,4);assert.deepEqual(Object.values(playerView(p).hero.skills),[1,1,1,1]);
});
test('an existing legacy battle keeps its HP snapshot and remaining ultimate cooldown',()=>{
 const p=durableBattle(),b=p.battle,h=b.hero;p.hero.skills={'jet-pistol':2,'jet-gatling':2,'gear-second':2};h.skills={...p.hero.skills};h.hp=500;h.maxHp=900;h.energy=100;h.cooldowns={'jet-gatling':3};const id=b.id;
 const result=round(p);assert.equal(b.id,id);assert.equal(h.maxHp,900);assert.ok(h.hp>0&&h.hp<500);assert.equal(h.cooldowns['rubber-whip'],2);assert.ok(result.events.some(e=>e.type==='attack'&&e.actor==='hero'));assert.equal(result.events.some(e=>e.type==='skill'),false);
});
test('Haki adds forty percent armor and health once, including equipment-independent base stats',()=>{
 const p=starterPlayer('Captain');p.hero.stars=5;const grow=1+1/150,stats=heroStats(p);assert.equal(stats.maxHp,Math.round(Math.round((800+grow*82)*1.8)*1.4));assert.equal(stats.defense,Math.round(Math.round((25+grow*4)*1.8)*1.4));assert.equal(heroStats(p).maxHp,stats.maxHp);
});
test('Roi Cao Su hits one enemy, heals the only ally, and buffs the next two attack turns',()=>{
 const p=durableBattle({'rubber-whip':3,'armament-haki':3}),b=p.battle,h=b.hero;h.energy=80;h.hp=100;b.enemies[0].attack=1;b.enemies.push({...b.enemies[0],id:'enemy-1'});
 const result=round(p),hits=result.events.filter(e=>e.type==='damage'&&e.actor==='hero'),heal=result.events.find(e=>e.type==='heal');
 assert.equal(hits.length,1);assert.equal(b.enemies[1].hp,100000);assert.equal(heal.target,'hero');assert.equal(heal.amount,Math.round(h.attack*5.6));assert.equal(heal.hp,100+heal.amount);assert.ok(hits[0].amount>h.attack*3);
 assert.equal(effectiveStat(h,'attack',2),Math.round(h.attack*1.6));assert.equal(effectiveStat(h,'attack',3),Math.round(h.attack*1.6));assert.equal(effectiveStat(h,'attack',4),h.attack);
});
test('healing is capped at missing HP and never revives a dead enemy',()=>{
 const p=durableBattle({'rubber-whip':3});p.battle.hero.energy=80;p.battle.enemies[0].attack=1;const result=round(p);assert.equal(result.events.find(e=>e.type==='heal').amount,0);assert.ok(p.battle.hero.hp<=p.battle.hero.maxHp);
});
test('Mài Dũa reduces the attacker critical chance, refreshes without stacking, and expires',()=>{
 const p=durableBattle({polish:3}),b=p.battle,e=b.enemies[0];e.attack=1;e.critChance=.2;
 round(p,'attack');assert.ok(Math.abs(effectiveStat(e,'critChance',2)-.02)<1e-9);assert.equal(effects(e,'polish').length,1);
 round(p,'attack');assert.equal(effects(e,'polish').length,1);assert.equal(effects(e,'polish')[0].expiresTurn,5);assert.equal(effectiveStat(e,'critChance',6),.2);
});
function effects(unit,id){return unit.effects.filter(e=>e.skillId===id)}
test('Tuyệt Cảnh triggers below thirty percent, lasts three defense rounds, and cannot retrigger',()=>{
 const p=durableBattle({desperation:3}),b=p.battle,h=b.hero;h.hp=350;h.maxHp=1000;b.enemies[0].attack=100;
 let result=round(p,'attack');assert.ok(h.hp>0&&h.hp<300);assert.equal(h.desperationUsed,true);assert.equal(effects(h,'desperation').length,1);assert.equal(effectiveStat(h,'defense',1),Math.round(h.baseDefense*2.2));
 round(p,'defend');round(p,'defend');result=round(p,'defend');assert.ok(result.events.some(e=>e.type==='effect-expired'&&e.skillId==='desperation'));assert.equal(effectiveStat(h,'defense',4),h.baseDefense);assert.equal(b.events.filter(e=>e.type==='buff'&&e.skillId==='desperation').length,1);
});
test('lethal hits do not activate Tuyệt Cảnh as a resurrection',()=>{
 const p=durableBattle({desperation:3});p.battle.hero.hp=1;round(p,'attack');assert.equal(p.battle.status,'lost');assert.equal(p.battle.hero.desperationUsed,false);
});
