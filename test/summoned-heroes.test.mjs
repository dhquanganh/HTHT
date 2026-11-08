import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,heroStats,playerView} from '../server/game.mjs';
import {heroDefinitions,heroAlbum,definitionFor,itemById,ultimateFrom} from '../server/catalog.mjs';
import {grantSummon} from '../server/summon.mjs';

const owned=(avatars)=>{const p=starterPlayer('Captain');p.account.level=100;for(const avatar of avatars)grantSummon(p,{avatar});return p};
const slots=(...ids)=>[...ids,...Array(6-ids.length).fill(null)];
const ids=()=>heroDefinitions.filter(h=>h.ultimate);

test('every album hero with art is playable and has an ultimate',()=>{
 assert.ok(ids().length>=200);assert.equal(heroDefinitions.length,ids().length+2);
 for(const h of ids()){assert.ok(h.visual.skeleton,h.name);assert.ok(h.visual.head,h.name);assert.ok(h.skills.length>=1,h.name);assert.equal(h.skills[0].passive,false,h.name);assert.ok(h.ultimate.damage===0?h.ultimate.heal||h.ultimate.buff:h.ultimate.damage>=1.5&&h.ultimate.damage<=4,h.name);assert.ok(h.ultimate.targets>=1&&h.ultimate.targets<=6,h.name)}
 assert.equal(new Set(heroDefinitions.flatMap(h=>h.skills).map(s=>s.id)).size,heroDefinitions.flatMap(h=>h.skills).length);
});

test('a summoned hero fights in the formation and uses its ultimate',()=>{
 const p=owned(['624']),id='hero-624';applyAction(p,'formation-save',{slots:slots(id)});applyAction(p,'battle-start',{stageId:1,formation:slots(id)});
 const unit=p.battle.allies[0];assert.equal(unit.heroId,id);unit.energy=100;unit.speed=1e6;for(const e of p.battle.enemies){e.hp=e.maxHp=1e6}
 const events=applyAction(p,'battle-action',{battleId:p.battle.id,turn:1,action:'auto'}).events;
 assert.ok(events.some(e=>e.type==='skill'&&e.actor===unit.id&&e.skillId===definitionFor(id).ultimate.id));assert.equal(events.filter(e=>e.type==='damage'&&e.actor===unit.id&&e.skill).length,Math.min(definitionFor(id).ultimate.targets,p.battle.enemies.length));
});

test('below full rage the hero attacks and builds rage instead',()=>{
 // 624 có bị động +75/+50 Nộ nên vào trận đã đủ Nộ; 435 không có bị động Nộ.
 const p=owned(['435']),id='hero-435';applyAction(p,'battle-start',{stageId:1,formation:slots(id)});const unit=p.battle.allies[0];unit.speed=1e6;for(const e of p.battle.enemies){e.hp=e.maxHp=1e6}
 const events=applyAction(p,'battle-action',{battleId:p.battle.id,turn:1,action:'auto'}).events;assert.ok(events.some(e=>e.type==='attack'&&e.actor===unit.id));assert.ok(!events.some(e=>e.type==='skill'));assert.ok(unit.energy>35);
});

test('a manual ultimate needs full rage',()=>{
 const p=owned(['624']),id='hero-624';applyAction(p,'battle-start',{stageId:1,formation:slots(id)});const unit=p.battle.allies[0];unit.speed=1e6;for(const e of p.battle.enemies){e.hp=e.maxHp=1e6}
 unit.energy=80;assert.throws(()=>applyAction(p,'battle-action',{battleId:p.battle.id,turn:1,action:'skill'}),/100 nộ/);unit.energy=100;applyAction(p,'battle-action',{battleId:p.battle.id,turn:1,action:'skill'});assert.ok(unit.energy<100);
});

test('stats differ by grade and class, and stay finite for every hero',()=>{
 const p=starterPlayer('Captain');
 const stats=definition=>heroStats({...p,hero:{id:definition.id,level:10,stars:1,rank:0,skills:{},equipment:{}}});
 for(const h of ids())for(const v of Object.values(stats(h)))assert.ok(Number.isFinite(v)&&v>0,h.name);
 const pick=(rank,cls)=>ids().find(h=>h.rank===rank&&h.class===cls);assert.ok(stats(pick(6,'warrior')).attack>stats(pick(4,'warrior')).attack);assert.ok(stats(pick(6,'warrior')).maxHp>stats(pick(6,'assassin')).maxHp);
});

test('the normal upgrade loop works on a summoned hero',()=>{
 const p=owned(['624']),id='hero-624';applyAction(p,'hero-select',{heroId:id});assert.equal(p.hero.id,id);
 p.wallet.spirit=99999;p.wallet.gold=1e7;applyAction(p,'upgrade',{type:'level'});assert.equal(p.hero.level,2);
 p.hero.level=30;p.inventory['heroshard:624']=50;applyAction(p,'upgrade',{type:'star'});assert.equal(p.hero.stars,2);
 const skill=definitionFor(id).skills[0].id;p.inventory['material:skill-book']=50;p.hero.rank=1;applyAction(p,'upgrade',{type:'rank'});assert.equal(p.hero.rank,2);applyAction(p,'upgrade',{type:'skill',skillId:skill});assert.equal(p.hero.skills[skill],2);
 const view=playerView(p);assert.equal(view.hero.name,definitionFor(id).name);assert.ok(view.costs.star.items['heroshard:624']);assert.ok(itemById.has('heroshard:624'));
});

test('skill level raises the ultimate',()=>{
 const p=owned(['624']),id='hero-624',ultimate=definitionFor(id).ultimate;p.reserveHeroes[id].skills[ultimate.id]=3;applyAction(p,'battle-start',{stageId:1,formation:slots(id)});assert.ok(Math.abs(p.battle.allies[0].ultimate.damage-ultimate.damage*1.2)<1e-9);
});

test('heroes stored by the earlier collection become real heroes once',()=>{
 const p=starterPlayer('Captain');p.collection={'624':3,'603':1};applyAction(p,'formation-save',{slots:slots('hero-624')});assert.ok(p.reserveHeroes['hero-603']);assert.equal(p.collection,undefined);assert.equal(playerView(p).heroes.length,4);
});

test('a hero that is not owned cannot enter the formation',()=>{
 const p=starterPlayer('Captain');assert.throws(()=>applyAction(p,'formation-save',{slots:slots('hero-624')}),/chưa sở hữu/);assert.throws(()=>applyAction(p,'battle-start',{stageId:1,formation:slots('hero-624')}),/chưa sở hữu/);
});

test('summon pools only contain playable heroes',()=>{
 const playable=new Set(heroDefinitions.map(h=>h.avatar));for(let i=0;i<300;i++){const p=starterPlayer('Captain');const {heroes}=applyAction(p,'summon',{faction:['fortress','shadow','abyss','forest'][i%4],count:1});assert.ok(playable.has(heroes[0].avatar))}
 assert.ok(heroAlbum.heroes.length>=heroDefinitions.length);
});

const read=description=>ultimateFrom({name:'x',description},'id');
test('the damage percent is the one tied to damage, not a buff earlier in the text',()=>{
 const u=read('Nộ: Bản thân tăng 40% Công duy trì 4 lượt, tấn công 3 kẻ địch Nộ cao nhất, gây sát thương bằng 500% Công');assert.equal(u.damage,3);assert.equal(u.targets,3);assert.equal(u.pick,'rage');assert.equal(u.buff.value,.4);assert.equal(u.buff.team,false);assert.equal(u.buff.duration,4);
});
test('target counts and selection follow the text',()=>{
 assert.equal(read('Nộ: Gây sát thương (100%Công) 4 địch ngẫu nhiên').targets,4);assert.equal(read('Nộ: Gây sát thương (100%Công) 4 địch ngẫu nhiên').pick,'random');
 assert.equal(read('Nộ: Gây 2 lần sát thương 105% Công cho tất cả kẻ địch').targets,6);assert.ok(Math.abs(read('Nộ: Gây 2 lần sát thương 105% Công cho tất cả kẻ địch').damage-1.26*1.25)<2);
 assert.equal(read('Nộ: Gây sát thương (171%Công) địch có máu thấp nhất').pick,'lowest');assert.equal(read('Nộ: Gây sát thương (300%Công) kẻ địch hàng sau').pick,'back');
});
test('words about the team never turn a support skill into an area attack',()=>{
 const u=read('Nộ: Tăng toàn đội 30% Công duy trì 3 lượt, sau đó hồi phục 40% Máu tối đa cho toàn đội');assert.equal(u.damage,0);assert.equal(u.buff.team,true);assert.equal(u.buff.duration,3);assert.equal(u.heal.team,true);assert.equal(u.heal.maxHp,.4);
});
test('healing from attack is read and capped',()=>{const u=read('Nộ: Gây sát thương (171%Công) địch có máu thấp nhất và hồi máu đồng minh có máu thấp nhất (400%Công)');assert.equal(u.heal.attack,3);assert.equal(u.heal.team,false);assert.equal(u.pick,'lowest')});
test('a skill with no readable effect still does something',()=>{assert.equal(read('Nộ: Hóa đá mục tiêu').damage,1.5)});

function fight(ultimate,setup=()=>{}){
 const p=owned(['624']),id='hero-624';applyAction(p,'battle-start',{stageId:1,formation:slots(id,'zoro-king-of-hell')});
 // Kiểm tra nhánh Tuyệt kỹ chung (không có bộ kỹ năng đọc từ mô tả).
 const unit=p.battle.allies[0],other=p.battle.allies[1];delete unit.kit;unit.ultimate={...unit.ultimate,...ultimate};unit.energy=100;unit.speed=1e7;other.speed=1;other.energy=0;for(const e of p.battle.enemies){e.hp=e.maxHp=1e6;e.speed=1;e.attack=1}setup(p,unit,other);
 return{p,unit,other,events:applyAction(p,'battle-action',{battleId:p.battle.id,turn:1,action:'auto'}).events};
}
test('the lowest-health enemy is really the one hit',()=>{
 const {events,p}=fight({pick:'lowest',targets:1,damage:2},(p)=>{p.battle.enemies.at(-1).hp=500000});assert.equal(events.find(e=>e.type==='damage'&&e.skill).target,p.battle.enemies.at(-1).id);
});
test('a healer restores the most wounded ally and a team heal reaches everyone',()=>{
 const one=fight({damage:2,heal:{attack:1,maxHp:0,team:false}},(p,u,o)=>{o.hp=Math.round(o.maxHp/2)});assert.ok(one.events.some(e=>e.type==='heal'&&e.target===one.other.id&&e.amount>0));
 const all=fight({damage:0,targets:1,heal:{attack:0,maxHp:.2,team:true}},(p,u,o)=>{u.hp=1;o.hp=1});assert.equal(all.events.filter(e=>e.type==='heal'&&e.amount>0).length,2);assert.ok(!all.events.some(e=>e.type==='damage'&&e.skill));
});
test('a team buff raises the whole team and lasts its stated turns',()=>{
 const {events,unit,other}=fight({damage:0,buff:{value:.3,team:true,duration:2}});assert.equal(events.filter(e=>e.type==='buff').filter(e=>e.value===.3).length,2);assert.ok(unit.effects.some(e=>e.value===.3&&e.expiresTurn===2));assert.ok(other.effects.some(e=>e.value===.3));
});
test('Zoro direct-damage resistance now applies when he is hit',()=>{
 const run=reduction=>{const p=starterPlayer('Captain');p.hero.skills={};applyAction(p,'battle-start',{stageId:1,formation:slots('zoro-king-of-hell')});const z=p.battle.allies[0];z.skills.enma=reduction;z.skills['hiryu-jigoku']=1;z.energy=0;z.hp=z.maxHp=1e7;z.speed=1;z.attack=z.baseAttack=1;const e=p.battle.enemies[0];e.hp=e.maxHp=1e6;e.attack=e.baseAttack=5000;e.speed=9999;e.critChance=0;p.battle.seed=1234;const ev=applyAction(p,'battle-action',{battleId:p.battle.id,turn:1,action:'auto'}).events;return ev.find(x=>x.type==='damage'&&x.target===z.id&&x.amount>0)?.amount};
 assert.ok(run(3)<run(1));
});
test('every hero fights a full battle without a crash or a broken number',()=>{
 for(const h of ids()){const p=starterPlayer('Captain');p.account.level=100;p.adventure.unlockedStage=30;p.reserveHeroes={[h.id]:{id:h.id,level:1,exp:0,stars:1,rank:0,equipment:{},skills:{}},'zoro-king-of-hell':{id:'zoro-king-of-hell',level:1,exp:0,stars:1,rank:0,equipment:{},skills:{}}};applyAction(p,'battle-start',{stageId:20,formation:slots(h.id)},7);const u=p.battle.allies[0];u.hp=u.maxHp=1e7;u.energy=100;for(const e of p.battle.enemies){e.hp=e.maxHp=1e6}let casts=0;for(let r=0;r<6&&p.battle.status==='active';r++){const ev=applyAction(p,'battle-action',{battleId:p.battle.id,turn:p.battle.turn,action:'auto'}).events;casts+=ev.filter(e=>e.type==='skill').length;for(const e of ev)for(const k of ['amount','hp','energy'])if(e[k]!==undefined)assert.ok(Number.isFinite(e[k]),`${h.name} ${e.type} ${k}`)}assert.ok(casts>=1,h.name)}
});
