import test from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView} from '../server/game.mjs';
import {zoroDefinition} from '../server/catalog.mjs';
import {zoroRound} from '../server/zoro-combat.mjs';

test('cache maps King Of Hell to avatar 576 and four reference icons',()=>{
 assert.equal(zoroDefinition.avatar,'576');assert.deepEqual(zoroDefinition.skills.map(s=>s.iconId),['588','589','590','591']);
 assert.match(zoroDefinition.skills[0].levels[2].description,/2000%/);
 assert.match(zoroDefinition.skills[0].levels[2].description,/4000%/);
 assert.match(zoroDefinition.skills[1].levels[2].description,/70%/);
 assert.match(zoroDefinition.skills[3].levels[2].description,/80%/);
});
test('roster migration and switching preserve Luffy upgrades, equipment and wallet',()=>{
 const p=starterPlayer('Captain');applyAction(p,'upgrade',{type:'level'});const old=structuredClone(p.hero),wallet={...p.wallet},inventory={...p.inventory};
 assert.equal(playerView(p).heroes.length,2);applyAction(p,'hero-select',{heroId:'zoro-king-of-hell'});
 assert.deepEqual(Object.values(p.hero.skills),[3,3,3,3]);assert.equal(playerView(p).hero.name,'Zoro King Of Hell');
 applyAction(p,'upgrade',{type:'level'});const zoro=structuredClone(p.hero);applyAction(p,'hero-select',{heroId:'luffy-gear-2'});assert.deepEqual(p.hero,old);
 applyAction(p,'hero-select',{heroId:'zoro-king-of-hell'});assert.deepEqual(p.hero,zoro);assert.equal(p.wallet.gold,wallet.gold-140);assert.deepEqual(p.inventory,inventory);
 applyAction(p,'battle-start',{stageId:1},500);assert.equal(p.battle.hero.energy,100);assert.throws(()=>applyAction(p,'hero-select',{heroId:'luffy-gear-2'}),/trận chiến/);
 const r=applyAction(p,'battle-action',{battleId:p.battle.id,turn:1,action:'auto'});assert.ok(r.events.some(e=>e.type==='skill'&&e.skillId==='hiryu-jigoku'));assert.equal(p.battle.status,'won');
 assert.throws(()=>applyAction(p,'battle-action',{battleId:p.battle.id,turn:1,action:'auto'}));
});
function fixture(){return{turn:1,hero:{id:'hero',attack:100,defense:10,speed:200,hp:1000,maxHp:1000,energy:100,skills:{'hiryu-jigoku':3,enma:3,'conqueror-haki':3,'decisive-strike':3}},enemies:[{id:'enemy-0',hp:10000,maxHp:10000,attack:20,defense:0},{id:'enemy-1',hp:9000,maxHp:9000,attack:20,defense:0}]}}
test('Enma targets lowest absolute HP and weakens attack without stacking',()=>{
 const b=fixture(),events=[];zoroRound(b,'attack',{random:()=>.99,emit:e=>events.push(e)});
 assert.equal(events.find(e=>e.type==='attack').target,'enemy-1');assert.equal(b.enemies[1].effects[0].value,-.3);
 assert.equal(b.hero.effects.find(e=>e.skillId==='conqueror-haki').value,1);
 b.turn++;zoroRound(b,'attack',{random:()=>.99,emit:e=>events.push(e)});assert.equal(b.enemies[1].effects.length,1);
 b.turn=4;zoroRound(b,'defend',{random:()=>.99,emit:e=>events.push(e)});assert.equal(b.hero.effects.some(e=>e.skillId==='conqueror-haki'),false);assert.equal(b.hero.speed,200);
});
test('ultimate buffs before damage and executes below threshold through immunity',()=>{
 const b=fixture();b.enemies=[{id:'enemy-0',hp:20,maxHp:100,attack:20,defense:0,damageImmune:true,immortal:true}];const events=[];
 zoroRound(b,'skill',{random:()=>.99,emit:e=>events.push(e)});
 assert.equal(b.enemies[0].hp,0);assert.ok(events.some(e=>e.type==='execute'));
 assert.ok(events.findIndex(e=>e.type==='buff'&&e.skillId==='hiryu-jigoku')<events.findIndex(e=>e.type==='damage'));
});
test('Decisive Strike repeats at most once and Haki can nullify weaker attacks',()=>{
 const b=fixture();b.enemies.forEach(e=>e.hp=e.maxHp=100000);const events=[];
 zoroRound(b,'skill',{random:()=>0,emit:e=>events.push(e)});
 assert.equal(events.filter(e=>e.type==='skill').length,2);assert.equal(events.filter(e=>e.type==='trigger').length,1);
 assert.equal(b.hero.energy,24);assert.ok(events.filter(e=>e.actor!=='hero'&&e.type==='damage').every(e=>e.immune&&e.amount===0));
});
