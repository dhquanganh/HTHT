import test from 'node:test';
import assert from 'node:assert/strict';
import {campaign,stages,legacyStages} from '../server/catalog.mjs';
import {starterPlayer,applyAction,playerView} from '../server/game.mjs';

test('999 original stages retain source enemies, positions, requirements and rewards',()=>{
 assert.equal(stages.length,999);assert.equal(campaign.chapters.length,95);assert.equal(Object.keys(campaign.visuals).length,126,'119 avatar Chiến dịch + 7 avatar quái Boss hạm đội (tools/export-guild.py)');
 assert.deepEqual(stages[0].sourceReward,{exp:55,gold:2400,spirit:360,itemId:'1'});assert.equal(stages[0].code,'1-1');assert.equal(stages.at(-1).code,'99-9');
 assert.deepEqual(stages[1].enemies.map(e=>e.position),[4,6]);assert.equal(campaign.chapters[2].name,'Làng Syrup');
 for(const s of stages)for(const e of s.enemies){assert.ok(e.position>=1&&e.position<=6);const m=campaign.enemies[e.monsterId];assert.ok(m);assert.ok(campaign.visuals[m.avatar].skeleton)}
});
test('chapter and captain-level locks are enforced independently',()=>{
 const p=starterPlayer('Captain');assert.throws(()=>applyAction(p,'battle-start',{stageId:11}),/chưa được mở/);p.adventure.unlockedStage=999;
 const s=stages.find(s=>s.requireLevel>1);assert.throws(()=>applyAction(p,'battle-start',{stageId:s.id}),/Cần thuyền trưởng/);assert.equal(p.battle,null);
});
test('formation commits an owned hero and its front/back row in the battle snapshot',()=>{
 const p=starterPlayer('Captain'),luffy=structuredClone(p.hero);playerView(p);
 assert.throws(()=>applyAction(p,'battle-start',{stageId:1,heroId:'forged'}));assert.equal(p.hero.id,luffy.id);
 assert.throws(()=>applyAction(p,'battle-start',{stageId:1,position:6}));
 applyAction(p,'battle-start',{stageId:1,heroId:'zoro-king-of-hell',position:3});assert.equal(p.battle.hero.frontRow,false);assert.equal(p.formation.position,3);assert.deepEqual(p.reserveHeroes[luffy.id],luffy);
 assert.equal(p.battle.enemies[0].name,'Bandit');assert.equal(p.battle.enemies[0].avatar,'237');assert.equal(p.battle.enemies[0].level,30);assert.equal(p.battle.enemies[0].position,5);
});
test('source stage reward replaces demo loot and settles only once',()=>{
 const p=starterPlayer('Captain');applyAction(p,'battle-start',{stageId:1,heroId:'zoro-king-of-hell'});const before=structuredClone(p);applyAction(p,'battle-action',{battleId:p.battle.id,turn:1,action:'auto'});
 assert.equal(p.battle.status,'won');assert.equal(p.wallet.gold-before.wallet.gold,2400);assert.equal(p.wallet.spirit-before.wallet.spirit,360);assert.equal(p.wallet.diamonds,before.wallet.diamonds);assert.equal(p.inventory['equipment:1'],before.inventory['equipment:1']+1);assert.equal(p.adventure.unlockedStage,2);
 assert.throws(()=>applyAction(p,'battle-action',{battleId:p.battle.id,turn:1,action:'auto'}));
});
test('a battle started before campaign import keeps its previous reward schedule',()=>{
 const p=starterPlayer('Captain');applyAction(p,'battle-start',{stageId:1,heroId:'zoro-king-of-hell'});delete p.battle.campaignVersion;const gold=p.wallet.gold;
 applyAction(p,'battle-action',{battleId:p.battle.id,turn:1,action:'auto'});assert.equal(p.wallet.gold-gold,legacyStages[0].rewards.gold);assert.equal(p.battle.reward.diamonds,25);
});
