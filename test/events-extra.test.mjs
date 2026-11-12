import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView} from '../server/game.mjs';
import {eventList,trackEvent} from '../server/events.mjs';
const t0=Date.UTC(2026,10,12,3);
const ev=(p,id,now=t0)=>playerView(p,now).events[id];
test('24 new events exist with assets from the original bundle',()=>{
 for(const id of ['treasure-chest','super-spin','wanted-summon','recruit-five','lucky-point','arena-mission','training','marineford','daily-missions','weekly-packs','level-up','growth-fund','haki-awaken','vip-exp','monthly-activity','summon-call','hero-soul','transform-potion','straw-boat','gem-exchange','monthly-packs','mega-promo','summon-deal','diamond-discount'])assert.ok(eventList.find(e=>e.id===id),id);
});
test('level events follow the captain level; growth fund needs buying first and never resets',()=>{
 const p=starterPlayer('Ev');p.account.level=25;p.wallet.diamonds=5000;
 assert.equal(ev(p,'level-up').count,25);applyAction(p,'event-claim',{id:'level-up',index:1},t0);
 assert.throws(()=>applyAction(p,'event-claim',{id:'growth-fund',index:0},t0),/mua quỹ/);
 applyAction(p,'event-unlock',{id:'growth-fund'},t0);assert.equal(p.wallet.diamonds,4000);assert.throws(()=>applyAction(p,'event-unlock',{id:'growth-fund'},t0),/Đã mua/);
 const d=p.wallet.diamonds;applyAction(p,'event-claim',{id:'growth-fund',index:0},t0);assert.equal(p.wallet.diamonds,d+200);
 const later=t0+120*86400000;assert.equal(ev(p,'growth-fund',later).unlocked,true);assert.deepEqual(ev(p,'growth-fund',later).claimed,[0]);
});
test('claiming milestones builds monthly activity; treasure chest costs diamonds',()=>{
 const p=starterPlayer('Ev2');p.account.level=30;p.wallet.diamonds=1000;applyAction(p,'event-claim',{id:'level-up',index:0},t0);
 assert.equal(ev(p,'monthly-activity').count,10);
 const r=applyAction(p,'event-pray',{id:'treasure-chest',count:10},t0);assert.equal(r.rewards.length,10);assert.equal(p.wallet.diamonds,1000-300+r.rewards.filter(x=>x.itemId==='diamonds').reduce((n,x)=>n+x.quantity,0));assert.equal(ev(p,'treasure-chest').count,10);
});
test('summons, VIP EXP, tavern and daily quests feed their events; straw men drop from stage wins',()=>{
 const p=starterPlayer('Ev3');p.inventory['consumable:16']=20;applyAction(p,'summon',{faction:'fortress',count:10},t0);
 assert.equal(ev(p,'wanted-summon').count,10);assert.equal(ev(p,'lucky-point').count,10);assert.equal(ev(p,'summon-call').count,10);
 // Người rơm rơi khi thắng ải (bộ đếm 'stage'); VIP EXP nhận được cộng vào Tích Lũy VIP EXP.
 const before=p.inventory['consumable:28']||0;trackEvent(p,'stage',3,t0);assert.equal(p.inventory['consumable:28'],before+6);
 trackEvent(p,'vipExp',50,t0);assert.equal(ev(p,'vip-exp').count,50);
 p.account.level=10;playerView(p,t0);const q={id:999,star:1,slots:1,req:[],duration:1,reward:{itemId:'gold',quantity:1},state:'running',locked:false,heroes:['luffy-gear-2'],startAt:t0-10};p.tavern.quests.push(q);
 applyAction(p,'tavern',{op:'claim',questId:999},t0);assert.equal(ev(p,'marineford').count,1);
});
test('admin can save new events without the extra fields',async()=>{
 const {validateEventConfig}=await import('../server/events.mjs');const {isRewardId}=await import('../server/game.mjs');
 const fund=eventList.find(e=>e.id==='growth-fund');const out=validateEventConfig('growth-fund',{title:'Quỹ',milestones:fund.milestones},isRewardId);assert.equal(out.unlock.cost.quantity,1000);
 const straw=eventList.find(e=>e.id==='straw-boat');assert.equal(validateEventConfig('straw-boat',{title:'x',offers:straw.offers},isRewardId).drop.reward.itemId,'consumable:28');
});
