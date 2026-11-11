import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView} from '../server/game.mjs';
import {dungeonClock,dungeonConfig,stageLineup,enemyCount,cycleOf} from '../server/dungeon.mjs';

// 2026-11-10 12:00 giờ VN: chu kỳ đang mở.
const open=(()=>{let t=Date.UTC(2026,10,10,5);while(!dungeonClock(t).open)t+=3600000;return t})();
const ready=()=>{const p=starterPlayer('Cake');p.account.level=dungeonConfig.minLevel;return p};

test('cycle: 2 days open then 1 day closed; progress resets each cycle',()=>{
 const c=dungeonClock(open);assert.equal(c.closeAt-c.openAt,2*86400000);assert.ok(!dungeonClock(c.closeAt+1000).open);
 assert.equal(dungeonClock(c.closeAt+1000).openAt,c.openAt+3*86400000);
 const p=ready();applyAction(p,'dungeon',{op:'team',heroes:['luffy-gear-2']},open);p.dungeon.stage=9;
 assert.throws(()=>applyAction(p,'dungeon',{op:'select',heroId:'luffy-gear-2'},c.closeAt+1000),/đóng cửa/);
 assert.equal(playerView(p,c.openAt+3*86400000+1000).dungeon.stage,1);
});
test('needs level and a team; team is fixed for the cycle',()=>{
 const p=starterPlayer('Cake2');p.account.level=1;
 assert.throws(()=>applyAction(p,'dungeon',{op:'team',heroes:['luffy-gear-2']},open),/Yêu cầu cấp độ/);
 p.account.level=dungeonConfig.minLevel;assert.throws(()=>applyAction(p,'dungeon-fight',{},open),/chọn đội/);
 applyAction(p,'dungeon',{op:'team',heroes:['luffy-gear-2','zoro-king-of-hell']},open);
 assert.throws(()=>applyAction(p,'dungeon',{op:'team',heroes:['luffy-gear-2']},open),/Đội đã chọn/);
 const v=playerView(p,open).dungeon;assert.equal(v.team.length,2);assert.equal(v.enemies.length,enemyCount(1));assert.ok(v.enemies[0].maxHp>0);
});
test('fight keeps HP on both sides; a win clears the stage and may spawn a potion or merchant',()=>{
 const p=ready(),formation=JSON.stringify(p.formation);applyAction(p,'dungeon',{op:'team',heroes:['luffy-gear-2','zoro-king-of-hell']},open);
 let guard=0;
 while(p.dungeon.stage===1&&guard++<12){
  const alive=p.dungeon.team.find(id=>p.dungeon.hp[id]>0);if(!alive){p.dungeon.hp={'luffy-gear-2':1,'zoro-king-of-hell':1}}
  const r=applyAction(p,'dungeon-fight',{heroId:p.dungeon.team.find(id=>p.dungeon.hp[id]>0),skip:true},open);assert.equal(r.skipped,true);
  if(!r.result.won){assert.equal(p.dungeon.enemyHp.length,enemyCount(1),'enemy HP stored');assert.ok(p.battle.enemies.every((e,i)=>Math.abs(e.hp/e.maxHp-p.dungeon.enemyHp[i])<1e-9));assert.equal(p.dungeon.hp[r.result&&p.battle.dungeon.heroId],0)}
 }
 assert.equal(p.dungeon.stage,2);assert.equal(p.dungeon.best,1);assert.equal(p.dungeon.enemyHp,null);assert.equal(JSON.stringify(p.formation),formation);
});
test('potions: collect, HP heal, big potion revives, buffs cap at 20',()=>{
 const p=ready();applyAction(p,'dungeon',{op:'team',heroes:['luffy-gear-2']},open);const d=p.dungeon;
 d.node={type:'lotion',kind:'hp',id:1};assert.throws(()=>applyAction(p,'dungeon-fight',{},open),/nhặt vật phẩm/);
 applyAction(p,'dungeon',{op:'collect'},open);assert.equal(d.lotions[1],1);assert.equal(d.node,null);
 d.hp['luffy-gear-2']=.5;applyAction(p,'dungeon',{op:'use-hp',lotion:1},open);assert.equal(d.hp['luffy-gear-2'],.8);
 d.hp['luffy-gear-2']=0;d.lotions[2]=1;assert.throws(()=>applyAction(p,'dungeon',{op:'use-hp',lotion:2},open),/hồi sinh/);
 d.lotions[3]=1;applyAction(p,'dungeon',{op:'use-hp',lotion:3},open);assert.equal(d.hp['luffy-gear-2'],1);
 d.buffs[1]=20;d.node={type:'lotion',kind:'buff',id:1};applyAction(p,'dungeon',{op:'collect'},open);assert.equal(d.buffs[1],20);
});
test('merchant: buy now, or skip into the Đảo Bánh shop and buy later',()=>{
 const p=ready();p.wallet.diamonds=1000;applyAction(p,'dungeon',{op:'team',heroes:['luffy-gear-2']},open);const d=p.dungeon;
 const good={reward:{itemId:'consumable:16',quantity:2},price:{itemId:'diamonds',quantity:60}};
 d.node={type:'merchant',merchant:1,good};applyAction(p,'dungeon',{op:'buy'},open);assert.equal(p.wallet.diamonds,940);assert.equal(p.inventory['consumable:16']>=2,true);
 d.node={type:'merchant',merchant:2,good};applyAction(p,'dungeon',{op:'skip'},open);assert.equal(d.smashed[2].length,1);assert.equal(playerView(p,open).dungeon.smashed[2].length,1);
 applyAction(p,'dungeon',{op:'smashed-buy',merchant:2,index:0},open);assert.equal(d.smashed[2].length,0);assert.equal(p.wallet.diamonds,880);
});
test('lineups are fixed per cycle and grow from 3 to 6 heroes',()=>{
 const c=cycleOf(open);assert.deepEqual(stageLineup(c,5),stageLineup(c,5));assert.equal(stageLineup(c,1).length,3);assert.equal(stageLineup(c,60).length,6);
});
