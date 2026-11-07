import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView} from '../server/game.mjs';
import {heroDefinitions} from '../server/catalog.mjs';
import {newHero} from '../server/hero-roster.mjs';
import {beastBosses,defaultBoss,defaultConfig} from '../server/beast.mjs';
import {masteryQuests,milestones} from '../server/mastery.mjs';

const now=1000000;
const context={season:{id:1,endsAt:new Date(Date.now()+86400000)},config:{...defaultConfig},bosses:Object.fromEntries(beastBosses.map(boss=>{const {_id,...stats}=defaultBoss(boss);return[boss.key,stats]}))};
const view=p=>playerView(p,now).mastery;
const heroView=(p,id)=>view(p).heroes.find(h=>h.heroId===id);

test('every owned hero gets the five mastery quests of lap 1 with the original wording',()=>{
 const p=starterPlayer('m1'),h=heroView(p,p.hero.id);
 assert.equal(h.lap,1);assert.equal(h.laps,3);assert.equal(h.quests.length,masteryQuests.length);
 assert.equal(h.quests[0].text,'[Cường hóa] Nâng tới cấp 20');assert.equal(h.quests[1].text,'[Boss] Đánh boss 3 lần');
 assert.equal(view(p).points,0);assert.deepEqual(view(p).milestones.map(m=>m.status),milestones.map(()=>0));
});

test('boss battles count fights, damage, ultimates and basic attacks for each hero in the team',()=>{
 const p=starterPlayer('m2'),defs=heroDefinitions.filter(h=>h.class==='assassin'&&h.ultimate).slice(0,2);
 p.reserveHeroes={...(p.reserveHeroes||{})};for(const def of defs){const hero=newHero(def);hero.level=20;p.reserveHeroes[def.id]=hero}
 applyAction(p,'beast-start',{boss:'sea-king',formation:[...defs.map(d=>d.id),null,null,null,null],skip:true},now,context);
 if(p.battle?.status==='active')applyAction(p,'battle-leave',{},now,context);
 const stats=p.mastery.heroes[defs[0].id].stats;
 assert.equal(stats.fights,1);assert.ok(stats.damage>0,'damage is counted');assert.ok(stats.attacks+stats.ultimates>0,'actions are counted');
 const again=p.mastery.heroes[defs[0].id].stats.fights;try{applyAction(p,'battle-leave',{},now,context)}catch{}
 assert.equal(p.mastery.heroes[defs[0].id].stats.fights,again,'a battle is recorded once');
});

test('claiming quests pays points and rewards, finishing the set moves to the next lap, milestones unlock with points',()=>{
 const p=starterPlayer('m3');p.hero.level=60;
 p.mastery={points:0,milestones:[],heroes:{[p.hero.id]:{lap:1,claimed:[],stats:{fights:30,damage:5e6,ultimates:60,attacks:120}}}};
 assert.throws(()=>applyAction(p,'mastery-milestone',{points:50},now),/Chưa đủ/);
 const gold=p.wallet.gold;const r=applyAction(p,'mastery-claim',{heroId:p.hero.id,quest:0},now);
 assert.equal(p.wallet.gold,gold+20000);assert.equal(view(p).points,10);assert.equal(r.rewards.length,2);
 assert.throws(()=>applyAction(p,'mastery-claim',{heroId:p.hero.id,quest:0},now),/Đã nhận/);
 for(const q of [1,2,3,4])applyAction(p,'mastery-claim',{heroId:p.hero.id,quest:q},now);
 const h=heroView(p,p.hero.id);assert.equal(h.lap,2);assert.equal(h.quests[0].text,'[Cường hóa] Nâng tới cấp 40');assert.equal(h.quests[0].points,20);
 assert.equal(view(p).milestones[0].status,1);
 const gems=p.wallet.diamonds;applyAction(p,'mastery-milestone',{points:50},now);assert.equal(p.wallet.diamonds,gems+100);assert.equal(p.inventory['consumable:16']>=1,true);
 assert.equal(view(p).milestones[0].status,2);assert.throws(()=>applyAction(p,'mastery-milestone',{points:50},now),/Đã nhận/);
 for(let lap=2;lap<=3;lap++)for(const q of [0,1,2,3,4])applyAction(p,'mastery-claim',{heroId:p.hero.id,quest:q},now);
 assert.equal(heroView(p,p.hero.id).done,true);assert.throws(()=>applyAction(p,'mastery-claim',{heroId:p.hero.id,quest:0},now),/hoàn thành mọi vòng/);
 assert.equal(view(p).points,50+100+150);
});

test('a quest that is not done yet and a hero not owned are refused',()=>{
 const p=starterPlayer('m4');
 assert.throws(()=>applyAction(p,'mastery-claim',{heroId:p.hero.id,quest:1},now),/Chưa hoàn thành/);
 assert.throws(()=>applyAction(p,'mastery-claim',{heroId:'nobody',quest:0},now),/chưa sở hữu/);
});
