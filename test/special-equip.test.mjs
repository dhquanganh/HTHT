import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,heroStats,playerView,starterPlayer} from '../server/game.mjs';
import {heroDefinitions} from '../server/catalog.mjs';
import {heroIdentity,tierPercent,specialView,specialUnlockLevel} from '../server/special-equip.mjs';

const rich=()=>{const p=starterPlayer('Special');p.hero.level=60;p.wallet.gold=1e9;Object.assign(p.inventory,{'consumable:2028':10000,'consumable:2016':100,'consumable:2026':100,'consumable:2020':100,'consumable:2144':100});return p};
const up=(p,slot,kind)=>applyAction(p,'special-upgrade',{slot,kind});

test('role and rank badges follow db_heroes class and rank',()=>{
 assert.deepEqual([heroIdentity('luffy-gear-2').roleName,heroIdentity('luffy-gear-2').grade],['Đấu sĩ','S']);
 const zoro=heroIdentity('zoro-king-of-hell');assert.equal(zoro.grade,'SS');assert.equal(zoro.rankBadge,'consumable:2027');
 const mihawk=heroDefinitions.find(h=>h.name==='Mihawk Samurai');if(mihawk)assert.deepEqual([heroIdentity(mihawk.id).roleName,heroIdentity(mihawk.id).grade],['Kiếm sĩ','SS']);
});
test('locked until the crew reaches the unlock level',()=>{
 const p=starterPlayer('Locked');assert.equal(playerView(p).hero.special.role.locked,true);
 assert.throws(()=>up(p,'role','level'),new RegExp(`level ${specialUnlockLevel}`));
});
test('strengthen is capped by hero level and spends gold and Đá nâng đồ',()=>{
 const p=rich();p.hero.level=30;const gold=p.wallet.gold,stones=p.inventory['consumable:2028'];
 for(let i=0;i<30;i++)up(p,'role','level');
 assert.equal(p.hero.special.role.level,30);assert.throws(()=>up(p,'role','level'),/cấp 31/);
 assert.ok(p.wallet.gold<gold);assert.ok(p.inventory['consumable:2028']<stones);
});
test('tier needs the level milestone, then adds percent',()=>{
 const p=rich();assert.throws(()=>up(p,'role','tier'),/cấp 20/);
 const before=heroStats(p).attack;for(let i=0;i<20;i++)up(p,'role','level');up(p,'role','tier');
 assert.equal(p.hero.special.role.tier,2);assert.ok(heroStats(p).attack>before);
 assert.equal(tierPercent(1),1);assert.equal(tierPercent(15),30);
});
test('failed payment leaves the hero unchanged',()=>{
 const p=rich();p.inventory['consumable:2028']=0;assert.throws(()=>up(p,'rank','level'),/Đá nâng đồ/);
});
test('rank slot needs a hero of grade S or higher',()=>{
 const a=heroDefinitions.find(h=>h.rank===4);assert.ok(a);const view=specialView({id:a.id,level:60});
 assert.equal(view.role.locked,false);assert.equal(view.rank.locked,true);assert.match(view.rank.lock,/rank S/);
});
