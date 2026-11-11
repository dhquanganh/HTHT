import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView} from '../server/game.mjs';
import {braveConfig,braveLineup,braveEnemyCount,braveCycle,braveResetAt} from '../server/brave.mjs';

const t0=Date.UTC(2026,10,11,5);
const ready=()=>{const p=starterPlayer('Brave');p.account.level=braveConfig.minLevel;return p};
const slots=p=>p.formation?.slots||['luffy-gear-2','zoro-king-of-hell',null,null,null,null];

test('15 stages, lineups grow 3 to 6 heroes, map resets every 2 days',()=>{
 const c=braveCycle(t0);assert.equal(braveLineup(c,1).length,braveEnemyCount(1));assert.equal(braveLineup(c,15).length,6);
 const p=ready(),v=playerView(p,t0).brave;assert.equal(v.map.length,15);assert.equal(v.stage,1);assert.ok(v.resetAt>t0);
 p.brave.stage=9;assert.equal(playerView(p,braveResetAt(t0)+1000).brave.stage,1);
});
test('locked under the level; HP carries over and fallen crew cannot fight',()=>{
 const p=starterPlayer('Brave2');p.account.level=1;assert.throws(()=>applyAction(p,'brave-fight',{formation:slots(p)},t0),/Yêu cầu cấp độ/);
 p.account.level=braveConfig.minLevel;let guard=0;
 while(p.brave?.stage!==2&&guard++<10){
  const alive=['luffy-gear-2','zoro-king-of-hell'].filter(id=>(p.brave?.hp?.[id]??1)>0);if(!alive.length)break;
  applyAction(p,'brave-fight',{formation:[alive[0],alive[1]||null,null,null,null,null]},t0);while(p.battle.status==='active')applyAction(p,'battle-action',{battleId:p.battle.id,turn:p.battle.turn,action:'auto'},t0);
  if(p.battle.status==='lost'){assert.equal(p.brave.enemyHp.length,braveEnemyCount(1));assert.ok(Object.values(p.brave.hp).some(v=>v===0))}
 }
 const dead=Object.entries(p.brave.hp).find(([,v])=>v===0);
 if(dead)assert.throws(()=>applyAction(p,'brave-fight',{formation:[dead[0],null,null,null,null,null]},t0),/đã ngã/);
});
test('win clears the stage, gives rewards and a badge; blessings apply to the next fight only',()=>{
 const p=ready();p.brave=undefined;playerView(p,t0);const s=p.brave;s.blessing.rage=2;
 applyAction(p,'brave-fight',{formation:slots(p)},t0);const ally=p.battle.allies[0];assert.ok(ally.attack>0);
 for(const e of p.battle.enemies)e.hp=0;const gold=p.wallet.gold,badges=s.badges;
 applyAction(p,'battle-action',{battleId:p.battle.id,turn:p.battle.turn,action:'auto'},t0);
 assert.equal(p.battle.status,'won');assert.equal(s.stage,2);assert.equal(s.badges,badges+1);assert.ok(p.wallet.gold>gold);assert.deepEqual(s.blessing,{rage:0,rock:0,storm:0});
});
test('altar opens after stage 6: revive, heal, bless each cost a badge; badges can be bought',()=>{
 const p=ready();p.wallet.diamonds=1000;playerView(p,t0);const s=p.brave;
 assert.throws(()=>applyAction(p,'brave',{op:'heal'},t0),/màn 6/);
 s.stage=7;s.hp={'luffy-gear-2':0,'zoro-king-of-hell':.3};s.badges=1;
 applyAction(p,'brave',{op:'revive',heroId:'luffy-gear-2'},t0);assert.equal(s.hp['luffy-gear-2'],braveConfig.reviveRatio);assert.equal(s.badges,0);
 assert.throws(()=>applyAction(p,'brave',{op:'heal'},t0),/huy hiệu/);
 applyAction(p,'brave',{op:'buy-badge',count:2},t0);assert.equal(s.badges,2);assert.equal(p.wallet.diamonds,900);
 applyAction(p,'brave',{op:'heal'},t0);assert.ok(Math.abs(s.hp['zoro-king-of-hell']-.8)<1e-9);
 applyAction(p,'brave',{op:'bless',kind:'storm'},t0);assert.equal(s.blessing.storm,1);assert.equal(s.badges,0);
});
test('milestone chests at 3/6/9/12/15 once each',()=>{
 const p=ready();playerView(p,t0);p.brave.stage=4;assert.throws(()=>applyAction(p,'brave',{op:'claim',stage:6},t0),/ải 6/);
 const r=applyAction(p,'brave',{op:'claim',stage:3},t0);assert.ok(r.rewards.length);assert.throws(()=>applyAction(p,'brave',{op:'claim',stage:3},t0),/Đã nhận/);
});
