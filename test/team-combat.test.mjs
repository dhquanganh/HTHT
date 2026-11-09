import test from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView} from '../server/game.mjs';
import {formationView,validateFormation} from '../server/formation.mjs';
import {initializeTeamBattle,teamRound} from '../server/team-combat.mjs';

const slots=['luffy-gear-2','zoro-king-of-hell',null,null,null,null];
function unit(id,side,position,overrides={}){return{id,side,position,frontRow:side==='ally'?position<2:position>=4,name:id,heroId:side==='ally'?'luffy-gear-2':undefined,maxHp:100000,hp:100000,attack:10,defense:5,speed:200-position,energy:0,skills:{'rubber-whip':1,polish:1,'armament-haki':1,desperation:1},...overrides}}
function battle(allies,enemies,seed=12345){return{allies,enemies,turn:1,seed,events:[],status:'active'}}

test('legacy formation becomes a six-slot view without modifying hero progression',()=>{
 const p=starterPlayer('Captain'),original=structuredClone(p.hero);playerView(p);p.formation={position:3};const view=formationView(p);
 assert.equal(view.slots.length,6);assert.equal(view.slots[3],original.id);assert.ok(view.slots.includes('zoro-king-of-hell'));assert.deepEqual(p.hero,original);assert.deepEqual(p.formation,{position:3});
 for(const input of [[],Array(6).fill(null),[slots[0],slots[0]],[slots[0],'toString'],Array(7).fill(null),['forged']])assert.throws(()=>validateFormation(p,input));
 applyAction(p,'formation-save',{slots});assert.deepEqual(p.formation.slots,slots);
});
test('a complete 6 versus 6 round gives each living unit exactly one initiative turn',()=>{
 // Capacity fixtures create six distinct unit instances; no extra heroes are granted to accounts.
 const b=battle(Array.from({length:6},(_,i)=>unit('a'+i,'ally',i,{speed:210-i*12})),Array.from({length:6},(_,i)=>unit('e'+i,'enemy',i+1,{speed:205-i*12})));
 const events=teamRound(b,{action:'auto'}),turns=events.filter(e=>e.type==='unit-turn'),attacks=events.filter(e=>e.type==='attack');
 assert.equal(turns.length,12);assert.equal(new Set(turns.map(e=>e.actor)).size,12);assert.equal(attacks.length,12);assert.ok(turns.every((e,i)=>!i||turns[i-1].speed>=e.speed));
 for(const e of attacks)assert.notEqual(e.actor[0],e.target[0]);assert.deepEqual(b.initiative,turns.map(e=>e.actor));
});
test('dead units lose queued turns and basic attacks protect the back row',()=>{
 const a=unit('a0','ally',0,{heroId:undefined,attack:1000,speed:1000}),e0=unit('e0','enemy',4,{hp:1,speed:999}),e1=unit('e1','enemy',1,{hp:100000,speed:900});
 const b=battle([a],[e0,e1]),events=teamRound(b,{action:'auto'});
 assert.equal(events.find(e=>e.type==='attack').target,'e0');assert.equal(e0.hp,0);assert.equal(events.some(e=>e.type==='unit-turn'&&e.actor==='e0'),false);assert.ok(events.some(e=>e.actor==='e1'&&e.type==='attack'));
});
test('Luffy heals the wounded living teammate, not only himself, without reviving a corpse',()=>{
 const luffy=unit('healer','ally',2,{energy:80,speed:1000,attack:100}),wounded=unit('wounded','ally',0,{heroId:undefined,hp:100,maxHp:1000}),dead=unit('dead','ally',1,{hp:0});
 const b=battle([luffy,wounded,dead],[unit('enemy','enemy',4,{speed:1})]);const events=teamRound(b,{action:'auto'}),heal=events.find(e=>e.type==='heal');
 assert.equal(heal.actor,'healer');assert.equal(heal.target,'wounded');assert.equal(heal.amount,180);assert.equal(dead.hp,0);assert.equal(luffy.cooldowns['rubber-whip'],3);
});
test('rage and cooldowns belong to each unit independently',()=>{
 const a=unit('a','ally',0,{energy:100,speed:500}),c=unit('c','ally',1,{energy:0,speed:400});const b=battle([a,c],[unit('e','enemy',4,{attack:1})]);
 const events=teamRound(b,{action:'auto'});assert.ok(events.some(e=>e.type==='skill'&&e.actor==='a'));assert.equal(events.some(e=>e.type==='skill'&&e.actor==='c'),false);assert.equal(c.energy,35);assert.equal(a.cooldowns['rubber-whip'],3);assert.equal(c.cooldowns['rubber-whip'],undefined);
});
test('Zoro targets lowest HP across rows and repeats his ultimate at most once',()=>{
 const zoro=unit('zoro','ally',0,{heroId:'zoro-king-of-hell',attack:100,energy:100,speed:1000,skills:{'hiryu-jigoku':3,enma:3,'conqueror-haki':3,'decisive-strike':3}}),back=unit('back','enemy',1,{hp:100}),front=unit('front','enemy',4,{hp:100000});
 const b=battle([zoro],[front,back],0),events=teamRound(b,{action:'auto'}),casts=events.filter(e=>e.type==='skill');
 assert.equal(casts[0].target,'back');assert.equal(casts.length,2);assert.equal(events.filter(e=>e.type==='trigger').length,1);assert.equal(zoro.effects.filter(e=>e.skillId==='hiryu-jigoku').length,1);
});
test('front and back Zoro receive independent Haki attack and speed effects',()=>{
 const z=position=>unit('z'+position,'ally',position,{heroId:'zoro-king-of-hell',speed:100,skills:{'conqueror-haki':3}}),front=z(0),back=z(3);const b=battle([front,back],[unit('e','enemy',4)]);initializeTeamBattle(b);
 assert.equal(front.effects.find(e=>e.attribute==='attack').value,1);assert.equal(back.effects.find(e=>e.attribute==='attack').value,.5);assert.ok(front.effects.some(e=>e.attribute==='speed'));assert.equal(back.effects.some(e=>e.attribute==='speed'),false);
 b.turn=4;teamRound(b,{action:'auto'});assert.equal(front.effects.some(e=>e.skillId==='conqueror-haki'),false);assert.equal(back.effects.some(e=>e.skillId==='conqueror-haki'),false);
});
test('the party survives a fallen primary hero, pays EXP to the pool and settles rewards once',()=>{
 const p=starterPlayer('Captain');applyAction(p,'battle-start',{stageId:1,formation:slots});const before=structuredClone(p);p.battle.allies[0].hp=0;
 const result=applyAction(p,'battle-action',{battleId:p.battle.id,turn:1,action:'auto'});assert.equal(p.battle.status,'won');assert.ok(result.events.some(e=>e.type==='skill'&&e.actor==='ally-zoro-king-of-hell'));assert.equal(p.wallet.gold,before.wallet.gold+2400);assert.equal(p.wallet.spirit,before.wallet.spirit+360,'EXP goes to the shared pool once');
 assert.throws(()=>applyAction(p,'battle-action',{battleId:p.battle.id,turn:1,action:'auto'}));assert.equal(p.adventure.wins,1);
});
test('all fallen allies end a team battle even if its primary snapshot has stale HP',()=>{
 const p=starterPlayer('Captain');applyAction(p,'battle-start',{stageId:1,formation:slots});p.battle.hero=structuredClone(p.battle.hero);for(const u of p.battle.allies)u.hp=0;
 applyAction(p,'battle-action',{battleId:p.battle.id,turn:1,action:'auto'});assert.equal(p.battle.status,'lost');assert.equal(p.battle.reward,null);assert.equal(p.adventure.wins,0);
});

test('passive extra action after the last enemy dies does not crash (arena TypeError regression)',async()=>{
 const {initializeTeamBattle,teamRound}=await import('../server/team-combat.mjs');
 const kit={ultimate:null,passives:[],stats:{},triggers:[{on:'enemyDeath',effects:[{type:'extraAction',chance:1}],chance:1,skill:'Truy kích'}]};
 const unit=(id,side,hp,extra={})=>({id,side,name:id,hp,maxHp:hp,attack:500,defense:10,speed:side==='ally'?300:50,position:0,frontRow:true,energy:0,skills:{},cooldowns:{},...extra});
 const b={id:'t',status:'active',turn:1,seed:7,allies:[unit('hero','ally',5000,{kit,heroId:'hero-x'})],enemies:[unit('enemy-0','enemy',1)],events:[]};
 initializeTeamBattle(b);assert.doesNotThrow(()=>teamRound(b,{action:'auto'}));assert.equal(b.enemies[0].hp,0);
});
