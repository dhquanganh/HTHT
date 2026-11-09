import test from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,heroStats,playerView} from '../server/game.mjs';
import {excData,excCost,excPoints,excTierStats,excHero} from '../server/exc.mjs';

// Zoro King Of Hell (key 578, avatar 576) có trong db_exc; Luffy (109) thì không.
const zoro=(stars=10)=>{const p=starterPlayer('Exc');p.hero={...p.reserveHeroes?.['zoro-king-of-hell'],id:'zoro-king-of-hell',level:150,exp:0,stars,rank:0,equipment:{},skills:{'hiryu-jigoku':3,enma:3,'conqueror-haki':3,'decisive-strike':3}};
 p.reserveHeroes={};p.wallet.diamonds=100000;Object.assign(p.inventory,{'consumable:2201':10000,'consumable:2202':10000,'consumable:2203':10000,'consumable:2204':10000});return p};

test('original db_exc: 40 levels, 39 heroes, Hải hồn costs, cumulative stats, skill tiers 10/20/30/40',()=>{
 assert.equal(excData.maxLevel,40);assert.equal(excData.heroes.length,39);assert.equal(excData.unlockStar,10);
 assert.deepEqual(excCost(0),{'consumable:2201':5});assert.deepEqual(excCost(10),{'consumable:2202':5});assert.deepEqual(excCost(39),{'consumable:2204':50});assert.deepEqual(excCost(40),{});
 assert.deepEqual(excPoints(2),{attackPct:.02,maxHpPct:.02,speed:4},'ảnh gốc: Cấp 2 = Công +2%, Máu +2%, Tốc +4');
 assert.deepEqual(excPoints(40),{attackPct:.5,maxHpPct:.5,speed:150});
 assert.ok(excHero('576'));assert.equal(excHero('109'),null);
 assert.deepEqual(excTierStats('576',20),{attack:.75});assert.deepEqual(excTierStats('576',9),{});
});

test('locked below 10 stars and for heroes outside db_exc',()=>{
 assert.throws(()=>applyAction(zoro(9),'exc',{op:'level'}),/10 sao/);
 const p=starterPlayer('L');p.hero.stars=12;assert.throws(()=>applyAction(p,'exc',{op:'level'}),/chưa mở khóa/);
 assert.equal(playerView(zoro()).hero.exc.open,true);assert.equal(playerView(zoro(9)).hero.exc.open,false);
});

test('level up pays Hải hồn, adds % Công / Máu / Tốc to hero stats, unlocks skill tier at 10, max at 40',()=>{
 const p=zoro(),before=heroStats(p),have=p.inventory['consumable:2201'];
 applyAction(p,'exc',{op:'level'});applyAction(p,'exc',{op:'level'});
 assert.equal(p.inventory['consumable:2201'],have-15);assert.equal(p.hero.exc.level,2);
 const after=heroStats(p);assert.equal(after.attack,Math.round(before.attack*1.02));assert.equal(after.speed,before.speed+4);
 let r;for(let i=2;i<10;i++)r=applyAction(p,'exc',{op:'level'});assert.equal(r.unlockedTier,1);
 const v=playerView(p).hero.exc;assert.equal(v.tier,1);assert.ok(v.skills[0].unlocked&&!v.skills[1].unlocked);
 while(p.hero.exc.level<40)applyAction(p,'exc',{op:'level'});assert.throws(()=>applyAction(p,'exc',{op:'level'}),/tối đa/);
});

test('unlocked tier joins the battle kit (Zoro: Tăng vĩnh viễn 75% Công at tier 2) without double counting',()=>{
 const p=zoro();while(p.hero.exc?.level!==20)applyAction(p,'exc',{op:'level'});
 applyAction(p,'battle-start',{stageId:1,formation:['zoro-king-of-hell',null,null,null,null,null]});
 const kit=p.battle.allies[0].kit;assert.ok(kit.passives.some(s=>/Luyện hồn 2/.test(s.name)));assert.equal(kit.stats.attack,.75);
});

test('reset costs fee_decay gems and refunds every Hải hồn',()=>{
 const p=zoro(),stock={...p.inventory},gems=p.wallet.diamonds;for(let i=0;i<12;i++)applyAction(p,'exc',{op:'level'});
 const r=applyAction(p,'exc',{op:'reset'});assert.equal(p.hero.exc.level,0);assert.equal(p.wallet.diamonds,gems-excData.levels[12].fee_decay);
 for(const id of ['consumable:2201','consumable:2202'])assert.equal(p.inventory[id],stock[id]);assert.ok(r.rewards.length===2);
 assert.throws(()=>applyAction(p,'exc',{op:'reset'}),/chưa được nâng cấp/);
});
