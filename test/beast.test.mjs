import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyAction,starterPlayer} from '../server/game.mjs';
import {heroDefinitions} from '../server/catalog.mjs';
import {newHero} from '../server/hero-roster.mjs';
import {beastBosses,bossByKey,bracketIndex,classLabel,defaultBoss,defaultConfig,defaultRewards,rankBrackets,validateBossStats,validateConfig,validateRewards,variantOf} from '../server/beast.mjs';

const source=JSON.parse(readFileSync(new URL('../dist/beast.json',import.meta.url),'utf8'));
const context=(season=1,config={})=>({season:{id:season,endsAt:new Date(Date.now()+86400000)},config:{...defaultConfig,...config},bosses:Object.fromEntries(beastBosses.map(boss=>{const {_id,...stats}=defaultBoss(boss);return[boss.key,stats]}))});
function team(cls){
 const p=starterPlayer('Boss'),defs=heroDefinitions.filter(h=>h.class===cls&&h.ultimate).slice(0,3),ids=defs.map(h=>h.id);
 p.reserveHeroes={...(p.reserveHeroes||{})};for(const def of defs){const hero=newHero(def);hero.level=20;p.reserveHeroes[def.id]=hero}
 return{p,slots:[...ids,null,null,null]};
}
const start=(p,slots,ctx,key='sea-king',now=1000000,skip=true)=>applyAction(p,'beast-start',{boss:key,formation:slots,skip},now,ctx);

test('five bosses keep the stats and passives of the asset',()=>{
 assert.deepEqual(beastBosses.map(b=>b.name),['Sea King','Nola','Dragon 13','Oars','Smiley']);
 const sea=bossByKey.get('sea-king');assert.deepEqual(sea.point,{attack:104,armor:48,hp:606,speed:235});assert.equal(sea.class,'assassin');assert.equal(sea.level,330);
 for(const boss of source.bosses){assert.equal(boss.variants.length,5);assert.ok(boss.visual.skeleton);assert.match(boss.active.description,/20% máu tối đa/)}
 assert.deepEqual(defaultBoss(sea),{_id:'sea-king',level:330,attack:104,defense:48,maxHp:199980,speed:235});
});
test('each season rotates the five db_quai rows',()=>{
 const boss=bossByKey.get('nola');assert.equal(variantOf(boss,1).monsterId,'70762');assert.equal(variantOf(boss,6).monsterId,'70762');assert.notEqual(variantOf(boss,2).monsterId,'70762');
});
test('rank brackets follow the original popup',()=>{
 assert.deepEqual(rankBrackets.map(b=>b.label),['1','2','3','4','5','6-10','11-20','21-50','51-100','100+']);
 for(const [rank,index] of [[1,0],[5,4],[6,5],[10,5],[11,6],[50,7],[100,8],[101,9],[5000,9]])assert.equal(bracketIndex(rank),index);
 assert.equal(bracketIndex(-1),-1);
});
test('default rewards match the reference for the top four ranks',()=>{
 const rewards=defaultRewards();assert.deepEqual(rewards[0].map(r=>r.quantity),[400000,200,100]);assert.deepEqual(rewards[3].map(r=>r.quantity),[200000,100,50]);assert.equal(validateRewards(rewards).length,10);
});
test('admin input is validated',()=>{
 const good=defaultRewards();
 assert.throws(()=>validateRewards(good.slice(1)),/10 mốc/);
 assert.throws(()=>validateRewards(good.map(()=>[{itemId:'nope',quantity:1}])),/không tồn tại/);
 assert.throws(()=>validateRewards(good.map(()=>[{itemId:'gold',quantity:0}])));
 assert.throws(()=>validateRewards(good.map(()=>[{itemId:'gold',quantity:1},{itemId:'gold',quantity:1}])),/trùng/);
 assert.throws(()=>validateBossStats({level:1,attack:-1,defense:1,maxHp:1,speed:1}));
 assert.throws(()=>validateConfig({...defaultConfig,rounds:61}));
});
test('only the boss class may fight',()=>{
 const {p,slots}=team('assassin'),def=heroDefinitions.find(h=>h.class==='mage'&&h.ultimate),wrong=def.id;p.reserveHeroes[wrong]=newHero(def);
 assert.throws(()=>start(p,[wrong,null,null,null,null,null],context()),new RegExp(`Chỉ ${classLabel('assassin')}`));
 assert.throws(()=>start(p,slots,context(1,{minLevel:50})),/cấp 50/);
});
test('Luffy fights as a warrior',()=>{
 const p=starterPlayer('Boss');assert.doesNotThrow(()=>start(p,['luffy-gear-2',null,null,null,null,null],context(),'smiley'));
});
test('a skipped fight spends one turn and accumulates damage',()=>{
 const {p,slots}=team('assassin'),saved=structuredClone(p.formation);
 start(p,slots,context());
 assert.equal(p.battle.status,'won');assert.equal(p.beast.turns,99);assert.ok(p.battle.reward.damage>0);assert.equal(p.beast.damage['sea-king'],p.battle.reward.damage);assert.deepEqual(p.formation,saved,'Main formation stays');
 const first=p.battle.reward.damage;start(p,slots,context(),'sea-king',1020000);assert.equal(p.beast.damage['sea-king'],first+p.battle.reward.damage,'Damage adds up');assert.equal(p.beast.damage.nola,undefined,'Each boss has its own total');
});
test('fifteen seconds must pass between attacks',()=>{
 const {p,slots}=team('assassin');start(p,slots,context());
 assert.throws(()=>start(p,slots,context(),'sea-king',1005000),/Đợi 10 giây/);
 assert.doesNotThrow(()=>start(p,slots,context(),'sea-king',1015000));
});
test('turns run out and return with the next season',()=>{
 const {p,slots}=team('assassin');start(p,slots,context(1,{turns:1}));
 assert.throws(()=>start(p,slots,context(1,{turns:1}),'sea-king',2000000),/hết lượt/);
 start(p,slots,context(2,{turns:1}),'sea-king',3000000);assert.equal(p.beast.season,2);assert.equal(p.beast.turns,0);assert.ok(p.beast.damage['sea-king']>0);
});
test('the boss never dies and hits everyone for a share of max HP',()=>{
 const {p,slots}=team('assassin');start(p,slots,context(),'sea-king',1000000,false);
 const boss=p.battle.enemies[0];boss.maxHp=boss.hp=5;
 applyAction(p,'battle-action',{battleId:p.battle.id,turn:1,action:'auto'});
 assert.ok(boss.hp>0,'Boss survives its HP bar');assert.ok(boss.damageTaken>=5);
 const hits=p.battle.events.filter(e=>e.type==='damage'&&e.actor==='enemy-0');assert.equal(hits.length,3,'All three allies are hit');
 for(const hit of hits){const ally=p.battle.allies.find(a=>a.id===hit.target);assert.ok(Math.abs(hit.amount-Math.min(ally.maxHp*.2,104*15))<=1)}
});
test('passives reduce only the matching hits',()=>{
 const play=season=>{const {p,slots}=team('assassin');start(p,slots,context(season),'sea-king',1000000,false);const boss=p.battle.enemies[0];assert.ok(boss.immuneDebuff);return boss.passives};
 assert.deepEqual(play(1),[]);assert.deepEqual(play(2),['critical']);assert.deepEqual(play(3),['ultimate']);assert.deepEqual(play(4),['penetration']);
});
test('leaving a fight keeps the damage already dealt',()=>{
 const {p,slots}=team('assassin');start(p,slots,context(),'sea-king',1000000,false);
 applyAction(p,'battle-action',{battleId:p.battle.id,turn:1,action:'auto'});const dealt=p.battle.enemies[0].damageTaken;applyAction(p,'battle-leave',{});
 assert.equal(p.beast.damage['sea-king'],dealt);assert.equal(p.battle.status,'won');
});
test('a fight that crosses a season is not counted',()=>{
 const {p,slots}=team('assassin');start(p,slots,context(),'sea-king',1000000,false);p.beast.season=2;p.beast.damage={};
 applyAction(p,'battle-leave',{});assert.equal(p.battle.reward.counted,false);assert.deepEqual(p.beast.damage,{});
});
test('a payout is granted once',()=>{
 const p=starterPlayer('Boss'),gold=p.wallet.gold,payouts=[{id:'1:nola',rewards:[{itemId:'gold',quantity:500},{itemId:'consumable:11',quantity:3}]}];
 applyAction(p,'beast-claim',{},Date.now(),{payouts});applyAction(p,'beast-claim',{},Date.now(),{payouts});
 assert.equal(p.wallet.gold,gold+500);assert.equal(p.inventory['consumable:11'],3);
});
