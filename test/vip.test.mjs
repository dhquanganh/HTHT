import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView,grantReward} from '../server/game.mjs';
import {vipData,vipLevelOf,vipRewards} from '../server/vip.mjs';
import {dailyQuests,dailyFinal} from '../server/daily-quests.mjs';

test('VIP table and levels from db_vip',()=>{
 assert.equal(vipData.levels.length,20);assert.equal(vipLevelOf(99),0);assert.equal(vipLevelOf(100),1);assert.equal(vipLevelOf(15000000),20);
 assert.deepEqual(vipRewards(2).map(r=>r.kind),['hero','hero']);assert.equal(vipRewards(10).length,2);assert.equal(vipRewards(13)[0].kind,'avatar');
});
test('daily quests give VIP EXP; reaching a VIP level mails its bonus once',()=>{
 assert.ok(dailyQuests.every(q=>q.rewards.some(r=>r.itemId==='vipExp')));assert.ok(dailyFinal.rewards.some(r=>r.itemId==='vipExp'));
 const p=starterPlayer('Vip');grantReward(p,{itemId:'vipExp',quantity:260});assert.equal(p.vip,2);assert.equal(playerView(p).vipInfo.next,500);
 const mails=p.mail.filter(m=>/VIP/.test(m.title));assert.equal(mails.length,2);
 applyAction(p,'mail-claim',{all:true});assert.ok(Object.keys(p.reserveHeroes).length>1,'VIP 2 heroes joined');
 grantReward(p,{itemId:'vipExp',quantity:10});assert.equal(p.mail.filter(m=>/VIP/.test(m.title)).length,2,'no duplicate mail');
});
