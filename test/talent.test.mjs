import test from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,heroStats,playerView,upgradeCosts} from '../server/game.mjs';
import {talentData,talentUnlockStar} from '../server/talent.mjs';

const ready=()=>{const p=starterPlayer('Captain');p.hero.stars=talentUnlockStar;p.hero.level=200;p.wallet.diamonds=5000;
 Object.assign(p.inventory,{'consumable:206':500000,'consumable:205':100,'material:luffy-shard':500});return p};

test('original db_talent tables: 50 levels, 3 boards x 5 slots x 3 skills, fees',()=>{
 assert.equal(talentData.levels.length,50);assert.deepEqual(talentData.levels[0].points,[[0,100],[2,2000],[3,10]]);
 assert.deepEqual(talentData.levels[0].cost,[{itemId:'consumable:206',quantity:50}]);
 assert.deepEqual(talentData.levels.filter(r=>r.starNext>1).map(r=>[r.level,r.starNext,r.copies,r.heroLevelCap]),[[10,2,1,20],[20,3,2,50],[30,4,3,50],[40,5,4,50],[50,6,5,100]]);
 assert.deepEqual(talentData.tables.map(t=>t.name),['Cuồng Bạo','Thủ Ngự','Viện Trợ']);
 for(const t of talentData.tables){assert.equal(t.lots.length,5);for(const lot of t.lots)for(const id of lot)assert.ok(talentData.skills[id]?.description&&talentData.skills[id].icon,id)}
 assert.equal(talentData.feeChangeTable,500);assert.equal(talentData.feeReset,1000);
});

test('locked below red stars; first board pick is free and starts at level 1 / 1 star',()=>{
 const p=starterPlayer('Captain');assert.throws(()=>applyAction(p,'talent',{op:'table',tableId:1}),/chưa đủ điều kiện/);
 const q=ready(),gems=q.wallet.diamonds,before=heroStats(q);applyAction(q,'talent',{op:'table',tableId:3});
 const v=playerView(q).hero.talent;assert.equal(v.table,3);assert.equal(v.level,1);assert.equal(v.star,1);assert.equal(v.levelCap,10);assert.equal(q.wallet.diamonds,gems);
 assert.equal(heroStats(q).speed,before.speed+10);assert.ok(heroStats(q).attack>before.attack);
});

test('level up pays Kết Tinh Ý Chí, stops at star milestones; star up opens a slot and raises the hero level cap',()=>{
 const p=ready();applyAction(p,'talent',{op:'table',tableId:1});const item=p.inventory['consumable:206'];
 applyAction(p,'talent',{op:'level'});assert.equal(p.inventory['consumable:206'],item-50);
 for(let i=2;i<10;i++)applyAction(p,'talent',{op:'level'});assert.equal(p.hero.talent.level,10);
 assert.throws(()=>applyAction(p,'talent',{op:'level'}),/nâng sao/);
 assert.throws(()=>applyAction(p,'talent',{op:'skill',lot:2,index:1}),/mở khoá/);
 const cap=upgradeCosts(p).level.maxLevel,shards=p.inventory['material:luffy-shard'];
 applyAction(p,'talent',{op:'star'});assert.equal(p.hero.talent.star,2);assert.equal(upgradeCosts(p).level.maxLevel,cap+20);
 assert.equal(p.inventory['material:luffy-shard'],shards-10);assert.equal(p.inventory['consumable:205'],99);
 applyAction(p,'talent',{op:'level'});assert.equal(p.hero.talent.level,11);
});

test('skills by slot, board change keeps choices (500 gems), reset refunds everything (1000 gems)',()=>{
 const p=ready();applyAction(p,'talent',{op:'table',tableId:1});
 applyAction(p,'talent',{op:'skill',lot:1,index:2});assert.deepEqual(playerView(p).hero.talent.skillIds,[210002,0,0,0,0]);
 const gems=p.wallet.diamonds;applyAction(p,'talent',{op:'table',tableId:2});assert.equal(p.wallet.diamonds,gems-500);
 assert.deepEqual(playerView(p).hero.talent.skillIds,[210005,0,0,0,0]);
 assert.throws(()=>applyAction(p,'talent',{op:'table',tableId:2}),/Đang dùng/);
 const item=p.inventory['consumable:206'];for(let i=0;i<5;i++)applyAction(p,'talent',{op:'level'});
 const r=applyAction(p,'talent',{op:'reset'});assert.equal(p.inventory['consumable:206'],item);assert.equal(p.wallet.diamonds,gems-1500);
 assert.deepEqual([p.hero.talent.level,p.hero.talent.star,p.hero.talent.table],[1,1,2]);assert.ok(r.rewards.length);
});

test('chosen talent skills join the battle kit as passives (also for Luffy)',()=>{
 const p=ready();applyAction(p,'talent',{op:'table',tableId:3});applyAction(p,'talent',{op:'skill',lot:1,index:2});
 applyAction(p,'battle-start',{stageId:1,formation:['luffy-gear-2',null,null,null,null,null]});
 const kit=p.battle.allies[0].kit;assert.deepEqual(kit.passives.map(s=>s.name),['Khinh Phong']);assert.equal(kit.stats.speedFlat,200);
});

// Kỹ năng Thiên phú thật sự có tác dụng trong trận (bảng hiệu ứng viết tay trong server/talent.mjs).
import {talentSkillKits} from '../server/talent.mjs';
import {teamRound} from '../server/team-combat.mjs';
const withSkill=(table,lot,index)=>{const p=ready(),skills=[0,0,0,0,0];skills[lot-1]=index;p.hero.talent={table,level:1,star:5,skills,spent:{}};return p};
const fight=p=>{applyAction(p,'battle-start',{stageId:1,formation:['luffy-gear-2',null,null,null,null,null]});return p.battle};
const plain=()=>{const p=withSkill(1,1,1);p.hero.talent.skills=[0,0,0,0,0];return fight(p).allies[0]};

test('every one of the 45 original talent skills has a battle effect',()=>{
 for(const t of talentData.tables)for(const lot of t.lots)for(const id of lot){const k=talentSkillKits[id];assert.ok(k&&(Object.keys(k.stats||{}).length||k.triggers?.length),id)}
});

test('stat talents change the unit: Khinh Phong +200 speed / 25% dodge, Kháng Nộ, Bất Phá, Uyển Xà, Hấp Huyết, Hồi Thế',()=>{
 const base=plain();
 let u=fight(withSkill(3,1,2)).allies[0];assert.equal(u.speed,base.speed+200);assert.equal(u.dodgeChance,(base.dodgeChance||0)+.25);
 u=fight(withSkill(2,4,2)).allies[0];assert.equal(u.skillReduction,(base.skillReduction||0)+.5);assert.equal(u.skillDamage||0,base.skillDamage||0);
 u=fight(withSkill(2,1,3)).allies[0];assert.equal(u.critAvoid,.5);assert.equal(u.critChance,base.critChance);assert.equal(u.critResist,(base.critResist||0)+.35);
 u=fight(withSkill(3,1,1)).allies[0];assert.equal(u.debuffResist,(base.debuffResist||0)+.35);assert.equal(u.controlPierce,(base.controlPierce||0)+.25);
 u=fight(withSkill(3,1,3)).allies[0];assert.equal(u.lifesteal,(base.lifesteal||0)+.2);assert.equal(u.healTaken,(base.healTaken||0)+.35);
 u=fight(withSkill(3,4,1)).allies[0];assert.equal(u.energy,base.energy+25);assert.equal(u.energyGain,.5);
 u=fight(withSkill(1,1,1)).allies[0];assert.equal(u.attack,Math.round(base.attack*1.2));assert.equal(u.penetration,(base.penetration||0)+.35);
});

test('trigger talents fire in battle: Hộ Tâm, Gia Tốc, Phong Hồn, Trì Chiến, Huyết Lực',()=>{
 const base=plain();
 let b=fight(withSkill(2,2,1));teamRound(b);assert.equal(b.allies[0].maxHp,base.maxHp*2);
 b=fight(withSkill(3,2,1));const events=teamRound(b);assert.ok(events.some(e=>e.type==='trigger'||e.type==='buff'&&e.name==='Gia Tốc'&&e.attribute==='speed'));
 b=fight(withSkill(3,5,1));const ev=teamRound(b);assert.ok(ev.some(e=>e.type==='buff'&&e.attribute==='seal'),'Phong Ấn');
 b=fight(withSkill(3,2,3));for(let i=0;i<3&&b.status!=='won';i++){teamRound(b);b.turn++}
 if(b.allies[0].hp>0&&b.enemies.some(e=>e.hp>0)){teamRound(b);assert.ok(b.allies[0].effects.some(e=>e.name==='Trì Chiến'&&e.attribute==='attack'))}
 b=fight(withSkill(1,5,1));const hp=b.allies[0].hp;const e5=teamRound(b);assert.ok(e5.some(e=>e.type==='buff'&&e.name==='Huyết Lực'&&e.attribute==='attack'));assert.ok(hp>0);
});
