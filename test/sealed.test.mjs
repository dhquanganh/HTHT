import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView} from '../server/game.mjs';
import {sealedConfig,sealedFactions,sealedLineup,challengeRewards,smashRewards,sealBook} from '../server/sealed.mjs';
const t0=Date.UTC(2026,10,12,3);
const ready=()=>{const p=starterPlayer('Seal');p.account.level=sealedConfig.minLevel;p.wallet.diamonds=5000;return p};
const fight=(p,f,slots)=>applyAction(p,'sealed-fight',{faction:f,formation:slots},t0);
const finish=(p,win)=>{if(win)for(const e of p.battle.enemies)e.hp=0;else for(const a of p.battle.allies)a.hp=0;applyAction(p,'battle-action',{battleId:p.battle.id,turn:p.battle.turn,action:'auto'},t0)};
test('6 factions x 20 levels, guards share the zone faction',()=>{
 const v=playerView(ready(),t0).sealed;assert.deepEqual(Object.keys(v.factions),sealedFactions);
 for(const f of sealedFactions){assert.equal(v.factions[f].length,20);assert.equal(v.factions[f][0].state,'challenge');assert.equal(v.factions[f][1].state,'locked')}
 assert.ok(sealedLineup('light',20).length===6&&sealedLineup('light',1).length===3);
});
test('locked under the level; only same-faction crew may fight',()=>{
 const low=starterPlayer('Low');low.account.level=1;assert.throws(()=>fight(low,'light',['zoro-king-of-hell',null,null,null,null,null]),/Yêu cầu cấp độ/);
 const p=ready();assert.throws(()=>fight(p,'light',['luffy-gear-2',null,null,null,null,null]),/cùng hệ/);
 assert.equal(playerView(p,t0).sealed.attack,sealedConfig.dailyAttack);
});
test('win clears the level with challenge rewards; loss spends the attempt only',()=>{
 const p=ready();fight(p,'light',['zoro-king-of-hell',null,null,null,null,null]);finish(p,false);
 let v=playerView(p,t0).sealed;assert.equal(v.cleared.light,0);assert.equal(v.attack,sealedConfig.dailyAttack-1);
 const books=p.inventory[sealBook]||0;fight(p,'light',['zoro-king-of-hell',null,null,null,null,null]);finish(p,true);
 v=playerView(p,t0).sealed;assert.equal(v.cleared.light,1);assert.equal(v.factions.light[0].state,'smash');assert.equal(v.factions.light[1].state,'challenge');
 assert.equal(p.inventory[sealBook],books+challengeRewards(1)[0].quantity);
});
test('smash cleared levels for instant rewards; buy attempts with gems; daily reset',()=>{
 const p=ready();playerView(p,t0);p.sealed.cleared.abyss=3;
 assert.throws(()=>applyAction(p,'sealed',{op:'smash',faction:'abyss',level:4},t0),/vượt qua ải/);
 const r=applyAction(p,'sealed',{op:'smash',faction:'abyss',level:3},t0);assert.deepEqual(r.rewards,smashRewards(3));
 p.sealed.smash=0;assert.throws(()=>applyAction(p,'sealed',{op:'smash',faction:'abyss',level:3},t0),/Hết lượt/);
 applyAction(p,'sealed',{op:'buy',kind:'smash'},t0);assert.equal(p.sealed.smash,1);assert.equal(p.wallet.diamonds,5000-sealedConfig.feeSmash);
 applyAction(p,'sealed',{op:'buy',kind:'attack'},t0);assert.equal(p.sealed.attack,sealedConfig.dailyAttack+1);
 assert.equal(playerView(p,t0+86400000).sealed.smash,sealedConfig.dailySmash);
});
