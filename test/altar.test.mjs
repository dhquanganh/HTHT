import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView} from '../server/game.mjs';
import {spentExp,spentStones} from '../server/altar.mjs';
import {heroDefinitions} from '../server/catalog.mjs';
import {newHero} from '../server/hero-roster.mjs';

const setup=()=>{const p=starterPlayer('Altar');p.reserveHeroes??={};for(const d of heroDefinitions.filter(d=>!['luffy-gear-2','zoro-king-of-hell'].includes(d.id)).slice(0,3))p.reserveHeroes[d.id]=newHero(d);return p};
test('sacrifice refunds EXP, stones, gear and Hồn hải tặc; heroes leave roster and formation',()=>{
 const p=setup();const id=Object.keys(p.reserveHeroes).find(k=>k!=='zoro-king-of-hell'&&k!=='luffy-gear-2');const h=p.reserveHeroes[id];
 h.level=30;h.stars=6;h.equipment={pants:'equipment:1'};p.formation={version:2,slots:[p.hero.id,id,null,null,null,null]};
 const spirit=p.wallet.spirit,stones=p.inventory['consumable:2']||0,gear=p.inventory['equipment:1']||0;
 const r=applyAction(p,'altar',{op:'sacrifice',heroIds:[id]});
 assert.ok(!p.reserveHeroes[id]);assert.equal(p.formation.slots[1],null);
 assert.equal(p.wallet.spirit-spirit,spentExp(30));assert.equal((p.inventory['consumable:2']||0)-stones,spentStones(6));assert.equal((p.inventory['equipment:1']||0)-gear,1);
 assert.ok(p.inventory['consumable:7']>0);assert.ok(r.rewards.length>=3);
});
test('rules: no main hero, no locked hero, not all heroes, at most 8',()=>{
 const p=setup();assert.throws(()=>applyAction(p,'altar',{op:'sacrifice',heroIds:[p.hero.id]}),/tướng chính/);
 const ids=Object.keys(p.reserveHeroes);applyAction(p,'altar',{op:'lock',heroId:ids[0]});assert.throws(()=>applyAction(p,'altar',{op:'sacrifice',heroIds:[ids[0]]}),/khóa/);
 assert.throws(()=>applyAction(p,'altar',{op:'sacrifice',heroIds:[]}),/chưa chọn/);
 assert.throws(()=>applyAction(p,'altar',{op:'sacrifice',heroIds:Array(9).fill(0).map((_,i)=>'x'+i)}),/đầy/);
});
test('return: hero back to level 1 with all EXP, 50 diamonds; shop spends Hồn hải tặc with daily limits',()=>{
 const p=setup();const id=Object.keys(p.reserveHeroes)[1];p.reserveHeroes[id].level=20;const gems=p.wallet.diamonds,spirit=p.wallet.spirit;
 applyAction(p,'altar',{op:'return',heroId:id});assert.equal(p.reserveHeroes[id].level,1);assert.equal(p.wallet.diamonds,gems-50);assert.equal(p.wallet.spirit-spirit,spentExp(20));
 p.inventory['consumable:7']=1000;const barrels=p.inventory['consumable:16']||0;applyAction(p,'altar',{op:'buy',id:'barrel'});
 assert.equal(p.inventory['consumable:7'],700);assert.equal(p.inventory['consumable:16'],barrels+1);assert.equal(playerView(p).altar.shop.find(o=>o.id==='barrel').bought,1);
});
