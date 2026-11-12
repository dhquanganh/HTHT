import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rewardTablesView,validateRewardRows,applyRewardConfig} from '../server/reward-config.mjs';
import {starterPlayer,applyAction,playerView,isRewardId} from '../server/game.mjs';
import {stageRewards} from '../server/brave.mjs';
import {altarShop} from '../server/altar.mjs';
import {casinos} from '../server/casino.mjs';
const t0=Date.UTC(2026,10,12,3);
const table=id=>rewardTablesView().find(t=>t.id===id);
test('every table lists rows with valid rewards',()=>{
 const all=rewardTablesView();assert.ok(all.length>=13);
 for(const t of all){assert.ok(t.rows.length,t.id);for(const r of t.rows){assert.ok(r.rewards.length,t.id+r.key);for(const x of r.rewards)assert.ok(isRewardId(x.itemId),t.id+':'+x.itemId)}
  assert.doesNotThrow(()=>validateRewardRows(t.id,t.rows,isRewardId),t.id)}
});
test('edits apply to the live game and reset restores defaults',()=>{
 const rows=table('brave-stage').rows;rows[0].rewards=[{itemId:'diamonds',quantity:777}];
 applyRewardConfig([{_id:'brave-stage',rows:validateRewardRows('brave-stage',rows,isRewardId)}]);
 assert.deepEqual(stageRewards(1),[{itemId:'diamonds',quantity:777}]);
 applyRewardConfig([]);assert.notDeepEqual(stageRewards(1),[{itemId:'diamonds',quantity:777}]);
});
test('shop rows: price, limit and weight are applied; altar price item is fixed',()=>{
 const a=table('shop-altar').rows;a[0].limit=1;a[0].price.quantity=7;
 applyRewardConfig([{_id:'shop-altar',rows:validateRewardRows('shop-altar',a,isRewardId)}]);
 assert.equal(altarShop[0].limit,1);assert.equal(altarShop[0].cost,7);
 const p=starterPlayer('Cfg');p.inventory['consumable:7']=100;applyAction(p,'altar',{op:'buy',id:altarShop[0].id},t0);assert.equal(p.inventory['consumable:7'],93);
 assert.throws(()=>applyAction(p,'altar',{op:'buy',id:altarShop[0].id},t0),/hết lượt/i);
 a[0].price={itemId:'diamonds',quantity:5};assert.throws(()=>validateRewardRows('shop-altar',a,isRewardId),/Hồn hải tặc/);
 const c=table('casino-normal').rows;c[0].weight=999;applyRewardConfig([{_id:'casino-normal',rows:validateRewardRows('casino-normal',c,isRewardId)}]);assert.equal(casinos.normal.pool[0].weight,999);
 applyRewardConfig([]);assert.notEqual(altarShop[0].limit,1);
});
test('validation rejects bad items, quantities and row changes',()=>{
 const rows=table('sealed-smash').rows;
 assert.throws(()=>validateRewardRows('sealed-smash',rows.slice(1),isRewardId),/Số dòng/);
 const bad=structuredClone(rows);bad[0].rewards=[{itemId:'nope',quantity:1}];assert.throws(()=>validateRewardRows('sealed-smash',bad,isRewardId),/không hợp lệ/);
 bad[0].rewards=[{itemId:'gold',quantity:0}];assert.throws(()=>validateRewardRows('sealed-smash',bad,isRewardId));
 const one=structuredClone(table('casino-normal').rows);one[0].rewards.push({itemId:'gold',quantity:1});assert.throws(()=>validateRewardRows('casino-normal',one,isRewardId),/đúng 1/);
 assert.throws(()=>validateRewardRows('missing',[],isRewardId),/không tồn tại/);
});
