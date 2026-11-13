import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {setContent} from '../server/content.mjs';
import {contentView,validateMonsters,validateStages,monsterList} from '../server/content-admin.mjs';
import {braveLineup,braveEnemyStats,braveCycle} from '../server/brave.mjs';
import {sealedLineup,sealedConfig,smashRewards} from '../server/sealed.mjs';
import {dungeonConfig,dungeonStageTable,stageLineup} from '../server/dungeon.mjs';
import {starterPlayer,applyAction,playerView} from '../server/game.mjs';
import {rewardTablesView} from '../server/reward-config.mjs';
const t0=Date.UTC(2026,10,13,3),ref={maxHp:10000,attack:1000,defense:500,speed:100};
afterEach(()=>setContent({}));
test('stage lineup override and strength scale apply to the fight',()=>{
 const a=monsterList.slice(0,2).map(h=>h.avatar);
 setContent({stages:validateStages('brave',{stages:{'1':{enemies:a,scale:200}}}).stages&&{brave:validateStages('brave',{stages:{'1':{enemies:a,scale:200}}}).stages}});
 assert.deepEqual(braveLineup(braveCycle(t0),1).map(e=>e.avatar),a);
 const base=(()=>{setContent({});return braveEnemyStats(ref,1,0,a[0])})();
 setContent({stages:{brave:{'1':{enemies:a,scale:200}}}});const boosted=braveEnemyStats(ref,1,0,a[0]);
 assert.equal(boosted.maxHp,base.maxHp*2);assert.equal(boosted.speed,base.speed);
 const p=starterPlayer('C');p.account.level=20;applyAction(p,'brave-fight',{formation:['luffy-gear-2','zoro-king-of-hell',null,null,null,null]},t0);
 assert.deepEqual(p.battle.enemies.map(e=>String(e.avatar)),a);
});
test('monster tuning and disabling',()=>{
 const pool=new Set();for(let s=1;s<=15;s++)for(const e of braveLineup(braveCycle(t0),s))pool.add(e.avatar);
 const victim=[...pool][0],mods=validateMonsters({[victim]:{disabled:true},[monsterList[0].avatar]:{hp:150}});
 setContent({monsters:mods});for(let s=1;s<=15;s++)assert.ok(!braveLineup(braveCycle(t0),s).some(e=>e.avatar===victim));
 const m=monsterList[0].avatar,plain=(setContent({}),braveEnemyStats(ref,3,0,m));setContent({monsters:mods});assert.equal(braveEnemyStats(ref,3,0,m).maxHp,Math.round(plain.maxHp*1.5));
 assert.throws(()=>validateMonsters({nope:{hp:120}}),/không tồn tại/);
 assert.throws(()=>validateMonsters(Object.fromEntries(monsterList.map(h=>[h.avatar,{disabled:true}]))),/ít nhất một quái/);
});
test('adding stages to Mê cung and Đảo Bánh extends levels and reward tables',()=>{
 const v=validateStages('sealed',{count:25,stages:{'light-25':{scale:150},'light-99':{scale:200}}});assert.equal(v.count,25);assert.deepEqual(Object.keys(v.stages),['light-25']);
 setContent({counts:{sealed:25,dungeon:70}});assert.equal(sealedConfig.levels,25);assert.equal(dungeonConfig.stages,70);assert.ok(smashRewards(25).length);assert.ok(dungeonStageTable[69].length);
 const p=starterPlayer('S');p.account.level=30;assert.equal(playerView(p,t0).sealed.factions.light.length,25);
 assert.equal(rewardTablesView().find(t=>t.id==='dungeon-stage').rows.length,70);
 assert.equal(contentView(t0).modes.sealed.stages.length,150);
 assert.throws(()=>validateStages('brave',{stages:{'1':{enemies:Array(7).fill(monsterList[0].avatar)}}}),/tối đa 6/);
 setContent({});assert.equal(sealedConfig.levels,20);assert.equal(sealedLineup('light',1).length,3);assert.ok(stageLineup(1,1).length);
});
test('monster level: stage level beats monster level, stats follow the hero growth curve',async()=>{
 const {levelCurve}=await import('../server/content.mjs');const a=monsterList[0].avatar,base={...ref,level:50};
 setContent({});const plain=braveEnemyStats(base,2,0,a);assert.equal(plain.level,50);
 setContent({monsters:validateMonsters({[a]:{level:100}})});const m100=braveEnemyStats(base,2,0,a);
 assert.equal(m100.level,100);assert.equal(m100.maxHp,Math.round(plain.maxHp*levelCurve.maxHp(100)/levelCurve.maxHp(50)));assert.ok(m100.attack>plain.attack&&m100.speed>plain.speed);
 setContent({monsters:{[a]:{level:100}},stages:validateStages('brave',{stages:{'2':{level:20}}}).stages&&{brave:{'2':{level:20}}}});const s20=braveEnemyStats(base,2,0,a);
 assert.equal(s20.level,20);assert.ok(s20.maxHp<plain.maxHp);
 assert.throws(()=>validateStages('brave',{stages:{'1':{level:0}}}),/Cấp quái/);
 const p=starterPlayer('L');p.account.level=20;setContent({stages:{brave:{'1':{level:77}}}});applyAction(p,'brave-fight',{formation:['luffy-gear-2','zoro-king-of-hell',null,null,null,null]},t0);
 assert.ok(p.battle.enemies.every(e=>e.level===77));
});
