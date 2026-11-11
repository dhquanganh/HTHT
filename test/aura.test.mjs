import {test} from 'node:test';
import assert from 'node:assert/strict';
import {auraOf,applyAura} from '../server/aura.mjs';
import {starterPlayer,applyAction} from '../server/game.mjs';

test('aura matches the original popup: 2 light + 1 abyss + 1 dark = +9% HP, +6.5% ATK, +12% Miễn chống, +2% Giảm ST',()=>{
 assert.deepEqual(auraOf(['light','light','abyss','dark']),{maxHp:.09,attack:.065,damageReduction:.02,debuffResist:.12});
 assert.deepEqual(auraOf(Array(6).fill('forest')),{maxHp:.18,attack:.12,damageReduction:.12,debuffResist:0});
});
test('aura is applied once to both sides when a team battle starts',()=>{
 const units=[{faction:'light',maxHp:1000,hp:1000,attack:100},{faction:'light',maxHp:1000,hp:1000,attack:100}];
 applyAura(units);applyAura(units);assert.equal(units[0].maxHp,1050);assert.equal(units[0].debuffResist,.08);
 const p=starterPlayer('Aura');applyAction(p,'battle-start',{stageId:1,formation:[p.hero.id,null,null,null,null,null]});
 assert.ok(p.battle.aura.ally.maxHp>0);assert.ok(p.battle.allies.every(u=>u.auraApplied));
});
