import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {applyGuildBoss,guildBossView,editGuildBoss,validateBossStage,bossMonsters,defaultStageCount,maxLevel} from '../server/guild-config.mjs';
import {guildData,stageData,stageHp,bossMonster} from '../server/guild.mjs';
import {validateStages,validateMonsters,monsterList} from '../server/content-admin.mjs';
afterEach(()=>applyGuildBoss(null));
test('view lists the 60 original boss stages with monsters and rewards',()=>{
 const v=guildBossView();assert.equal(v.stages.length,60);assert.ok(v.stages[0].monsters[0].head);assert.ok(v.stages[59].power>v.stages[0].power);assert.ok(v.monsters.length>100);
});
test('edit a stage: monsters, level, stars, rewards; stats follow the level',()=>{
 const s=structuredClone(guildBossView().stages[0]),before=bossMonster(stageData(1).monsters[0],0);
 s.monsters[0].level=500;s.monsters[0].stars=10;s.gold=99999;s.final['1'].coin=777;
 applyGuildBoss({stages:editGuildBoss({op:'save',stage:1,data:s})});
 assert.equal(stageData(1).monsters[0].level,500);assert.equal(stageData(1).gold,99999);assert.equal(stageData(1).final['1'].coin,777);
 assert.ok(bossMonster(stageData(1).monsters[0],0).maxHp>before.maxHp*20);assert.equal(stageHp(1).length,s.monsters.length);
 const bad=structuredClone(s);bad.monsters[1].position=bad.monsters[0].position;assert.throws(()=>validateBossStage(bad,1),/trùng vị trí/);
 bad.monsters=[{avatar:'nope',level:1}];assert.throws(()=>validateBossStage(bad,1),/không dùng được/);
 const huge=structuredClone(s);huge.monsters[0].level=5000000;assert.equal(validateBossStage(huge,1).monsters[0].level,5000000);
 const newcomer=structuredClone(s);newcomer.monsters=[{avatar:bossMonsters[0].avatar,level:120,stars:6,position:2}];const v=validateBossStage(newcomer,1);assert.equal(v.monsters[0].name,bossMonsters[0].name);assert.equal(v.monsters[0].skillLevel,120);
});
test('add new boss stages after the last one and remove only added ones',()=>{
 assert.throws(()=>editGuildBoss({op:'remove'}),/đã thêm/);
 applyGuildBoss({stages:editGuildBoss({op:'add'})});assert.equal(guildData.stages.length,61);
 const s61=stageData(61),s60=stageData(60);assert.equal(s61.stage,61);assert.ok(s61.monsters[0].level>s60.monsters[0].level);assert.ok(s61.gold>s60.gold);
 applyGuildBoss({stages:editGuildBoss({op:'remove'})});assert.equal(guildData.stages.length,defaultStageCount);
});
test('monster level is no longer capped at 1000',()=>{
 assert.equal(maxLevel,10000000);
 assert.equal(validateStages('brave',{stages:{'1':{level:250000}}}).stages['1'].level,250000);
 assert.equal(validateMonsters({[monsterList[0].avatar]:{level:5000}})[monsterList[0].avatar].level,5000);
});
