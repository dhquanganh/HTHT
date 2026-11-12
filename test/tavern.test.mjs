import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView} from '../server/game.mjs';
import {tavernConfig,makeQuest,satisfies,tavernState} from '../server/tavern.mjs';

const t0=Date.UTC(2026,10,12,3);
const ready=()=>{const p=starterPlayer('Tav');p.account.level=tavernConfig.minLevel;p.wallet.diamonds=5000;return p};
const easy=(p,star=1)=>{const s=tavernState(p,t0);const q=makeQuest(900+star,star,()=>0);q.req=[];s.quests.push(q);return q};

test('daily board: VIP count, resets next day keeping locked and running quests',()=>{
 const p=ready(),v=playerView(p,t0).tavern;assert.equal(v.quests.length,tavernConfig.baseQuests);assert.ok(v.quests.every(q=>q.star>=1&&q.star<=7&&q.state==='waiting'));
 p.vip=12;const s=p.tavern;s.quests[0].locked=true;const keep=s.quests[0].id;
 const next=playerView(p,t0+86400000).tavern;assert.ok(next.quests.some(q=>q.id===keep));assert.equal(next.quests.length,15);
});
test('locked under the level',()=>{const p=starterPlayer('Low');p.account.level=1;assert.throws(()=>applyAction(p,'tavern',{op:'refresh'},t0),/Yêu cầu cấp độ/)});
test('requirements: star, faction, class need enough crew',()=>{
 const q={req:[{type:'faction',value:'light',count:1},{type:'star',value:2,count:1}]};
 assert.equal(satisfies(q,[{stars:1,faction:'light'},{stars:3,faction:'abyss'}]),true);
 assert.equal(satisfies(q,[{stars:1,faction:'light'},{stars:1,faction:'abyss'}]),false);
});
test('start, crew busy, cancel, speed-up, claim gives reward and daily progress',()=>{
 const p=ready(),q=easy(p,2);
 assert.throws(()=>applyAction(p,'tavern',{op:'start',questId:q.id,heroes:['luffy-gear-2']},t0),/nhập đủ/);
 applyAction(p,'tavern',{op:'start',questId:q.id,heroes:['luffy-gear-2','zoro-king-of-hell']},t0);
 const q2=easy(p,1);assert.throws(()=>applyAction(p,'tavern',{op:'start',questId:q2.id,heroes:['luffy-gear-2']},t0),/nhiệm vụ khác/);
 applyAction(p,'tavern',{op:'cancel',questId:q.id},t0);applyAction(p,'tavern',{op:'start',questId:q2.id,heroes:['luffy-gear-2']},t0);
 assert.throws(()=>applyAction(p,'tavern',{op:'claim',questId:q2.id},t0),/chưa hoàn thành/);
 const gems=p.wallet.diamonds;applyAction(p,'tavern',{op:'speed-up',questId:q2.id},t0+10*60000);assert.ok(p.wallet.diamonds<gems);
 const r=applyAction(p,'tavern',{op:'claim',questId:q2.id},t0+10*60000);assert.deepEqual(r.rewards,[q2.reward]);
 assert.equal(playerView(p,t0).dailyQuest.quests.find(x=>x.id==='tavern').progress,1);
 // Hết giờ thì tự xong.
 applyAction(p,'tavern',{op:'start',questId:q.id,heroes:['luffy-gear-2','zoro-king-of-hell']},t0);assert.equal(playerView(p,t0+q.duration).tavern.quests.find(x=>x.id===q.id).state,'done');
});
test('refresh replaces unlocked waiting quests for gems; scrolls add 1-3 / 4-7 star quests',()=>{
 const p=ready();playerView(p,t0);const s=p.tavern;s.quests[0].locked=true;const keep=s.quests[0].id,others=s.quests.slice(1).map(q=>q.id);
 const cost=playerView(p,t0).tavern.refreshCost;assert.equal(cost,(s.quests.length-1)*tavernConfig.gemPerQuest);
 applyAction(p,'tavern',{op:'refresh'},t0);assert.ok(s.quests.some(q=>q.id===keep));assert.ok(!s.quests.some(q=>others.includes(q.id)));
 p.inventory['consumable:18']=1;applyAction(p,'tavern',{op:'scroll',kind:'senior'},t0);assert.ok(s.quests.at(-1).star>=4);assert.equal(p.inventory['consumable:18']||0,0);
 assert.throws(()=>applyAction(p,'tavern',{op:'scroll',kind:'senior'},t0),/Không đủ cuộn/);
 p.inventory['consumable:17']=1;applyAction(p,'tavern',{op:'scroll',kind:'basic'},t0);assert.ok(s.quests.at(-1).star<=3);
});
