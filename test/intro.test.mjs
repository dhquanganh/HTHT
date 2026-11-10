import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView} from '../server/game.mjs';

const fresh=()=>starterPlayer('Intro_QA',{intro:true});

test('a new account has no hero, 10 Thùng bia and starts at the story',()=>{
 const p=fresh(),v=playerView(p);
 assert.equal(p.hero,null);assert.equal(p.intro,'story');assert.deepEqual(p.reserveHeroes||{},{});
 assert.equal(p.inventory['consumable:16'],10);
 assert.equal(v.hero,null);assert.deepEqual(v.heroes,[]);assert.deepEqual(v.formation.slots,[null,null,null,null,null,null]);
 assert.equal(v.inventory['consumable:16'],10);assert.ok(!('zoro-king-of-hell' in (p.reserveHeroes||{})),'no free Zoro for new accounts');
});

test('without a hero only summoning is allowed; the intro cannot finish early',()=>{
 const p=fresh();
 for(const [action,input] of [['formation-save',{slots:['luffy-gear-2']}],['daily',{}],['hero-upgrade',{type:'level'}]])
  assert.throws(()=>applyAction(p,action,input),e=>e.code==='NO_HERO',action);
 assert.equal(applyAction(p,'intro',{step:'summon'}).intro,'summon');
 assert.throws(()=>applyAction(p,'intro',{step:'done'}),e=>e.code==='NO_HERO');
 assert.throws(()=>applyAction(p,'intro',{step:'nope'}));
 assert.equal(applyAction(p,'intro',{step:'story'}).intro,'summon','the intro never goes backwards');
});

test('the x10 summon spends the 10 barrels; the first new hero becomes the main hero',()=>{
 const p=fresh();applyAction(p,'intro',{step:'summon'});
 const r=applyAction(p,'summon',{faction:'fortress',count:10});
 assert.equal(p.inventory['consumable:16']||0,0);assert.ok(p.hero,'main hero set');
 const fresh10=r.heroes.filter(h=>h.fresh);assert.ok(fresh10.length>=1);
 assert.equal(1+Object.keys(p.reserveHeroes).length,fresh10.length,'every new hero is owned once');
 const v=playerView(p);assert.equal(v.hero.id,p.hero.id);assert.equal(v.heroes.length,fresh10.length);assert.ok(v.formation.slots.includes(p.hero.id));
 assert.ok(v.hero.stats.power>0);assert.ok(v.afk&&v.events,'full view once a hero exists');
 assert.equal(applyAction(p,'intro',{step:'done'}).intro,'done');
 applyAction(p,'formation-save',{slots:[p.hero.id]});
 assert.ok(!('zoro-king-of-hell' in p.reserveHeroes)||fresh10.some(h=>h.avatar&&p.reserveHeroes['zoro-king-of-hell']),'Zoro only if summoned');
});

test('old accounts (no intro field) keep Luffy and are not sent to the intro',()=>{
 const p=starterPlayer('Old');assert.equal(p.hero.id,'luffy-gear-2');assert.equal(p.intro,undefined);
 assert.equal(playerView(p).hero.id,'luffy-gear-2');
});
