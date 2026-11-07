import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,playerView,starterPlayer} from '../server/game.mjs';
import {itemById} from '../server/catalog.mjs';
import {checkinRewards,eventList,trackEvent} from '../server/events.mjs';

const day=(n,hour=3)=>Date.UTC(2026,10,n,hour);
const event=id=>eventList.find(e=>e.id===id);
test('every event reward exists',()=>{
 const check=r=>assert.ok(['gold','diamonds','spirit'].includes(r.itemId)||itemById.has(r.itemId),r.itemId);
 checkinRewards.forEach(check);assert.equal(checkinRewards.length,30);
 for(const e of eventList){(e.milestones||[]).flatMap(m=>m.rewards).forEach(check);(e.offers||[]).forEach(o=>{check(o.cost);check(o.reward)});(e.pool||[]).forEach(row=>check(row.reward));(e.slots||[]).forEach(row=>check(row.reward));(e.stages||[]).forEach(s=>s.rewards.forEach(check));(e.days||[]).forEach(d=>d.forEach(check));for(const r of [e.cost,e.daily,e.buy?.cost].filter(Boolean))check(r)}
});
test('check-in pays one cell a day in order and resets at midnight UTC+7',()=>{
 const p=starterPlayer('Captain'),clover=p.inventory['consumable:22']||0;
 assert.equal(playerView(p,day(9)).checkin.canClaim,true);
 applyAction(p,'daily',{},day(9));assert.equal(p.inventory['consumable:22'],clover+50);
 assert.throws(()=>applyAction(p,'daily',{},day(9,16)),/đã nhận/);
 const view=playerView(p,day(9));assert.equal(view.checkin.claimedDays,1);assert.equal(view.checkin.canClaim,false);assert.ok(view.checkin.nextIn>0);
 applyAction(p,'daily',{},day(9,18));assert.equal(p.inventory['consumable:9'],50,'18:00 UTC is already the next day in Vietnam');
});
test('thirty days wrap to the first cell',()=>{
 const p=starterPlayer('Captain');for(let i=0;i<30;i++)applyAction(p,'daily',{},Date.UTC(2026,0,1+i,3));
 assert.equal(playerView(p,Date.UTC(2026,0,30,3)).checkin.claimedDays,30);assert.equal(playerView(p,Date.UTC(2026,0,31,3)).checkin.claimedDays,0);
});
test('summons fill the lucky event and milestones pay once',()=>{
 const p=starterPlayer('Captain');p.inventory['consumable:16']=30;
 applyAction(p,'summon',{faction:'fortress',count:10},day(9));applyAction(p,'summon',{faction:'fortress',count:10},day(9));
 assert.equal(playerView(p,day(9)).events['lucky-summon'].count,20);
 applyAction(p,'event-claim',{id:'lucky-summon',index:0},day(9));assert.equal(p.inventory['consumable:13'],2);
 assert.throws(()=>applyAction(p,'event-claim',{id:'lucky-summon',index:0},day(9)),/Đã nhận/);
 assert.throws(()=>applyAction(p,'event-claim',{id:'lucky-summon',index:1},day(9)),/Chưa đạt/);
});
test('week events reset on Monday, month events on the first',()=>{
 const p=starterPlayer('Captain'),monday=Date.UTC(2026,10,9,3);trackEvent(p,'summon',7,day(8));trackEvent(p,'stage',4,day(8));
 assert.equal(playerView(p,day(8)).events['lucky-summon'].count,7);
 assert.equal(playerView(p,monday).events['lucky-summon'].count,0);assert.equal(playerView(p,monday).events['stage-march'].count,4);
 assert.equal(playerView(p,Date.UTC(2026,11,1,3)).events['stage-march'].count,0);
 assert.ok(playerView(p,day(8)).events['lucky-summon'].remaining<86400000*2);
});
test('exchange spends the cost and respects its limit',()=>{
 const p=starterPlayer('Captain'),offer=event('clover-exchange').offers[0];p.inventory['consumable:22']=offer.cost.quantity*(offer.limit+1);const barrels=p.inventory['consumable:16'];
 for(let i=0;i<offer.limit;i++)applyAction(p,'event-exchange',{id:'clover-exchange',index:0},day(9));
 assert.equal(p.inventory['consumable:16'],barrels+offer.limit);assert.throws(()=>applyAction(p,'event-exchange',{id:'clover-exchange',index:0},day(9)),/hết lượt/);
 p.inventory['consumable:22']=0;assert.throws(()=>applyAction(p,'event-exchange',{id:'clover-exchange',index:2},day(9)),/Không đủ/);
 const gold=p.wallet.gold;p.wallet.diamonds=100;applyAction(p,'event-exchange',{id:'gem-sale',index:3},day(9));assert.equal(p.wallet.diamonds,70);assert.equal(p.wallet.gold,gold+50000);
});
test('prayer spends flowers, always rewards and counts',()=>{
 const p=starterPlayer('Captain');p.inventory['consumable:34']=10;
 const result=applyAction(p,'event-pray',{id:'statue-prayer',count:10},day(9));assert.equal(result.rewards.length,10);assert.equal(p.inventory['consumable:34']||0,0);assert.equal(playerView(p,day(9)).events['statue-prayer'].count,10);
 assert.throws(()=>applyAction(p,'event-pray',{id:'statue-prayer',count:1},day(9)),/Không đủ/);assert.throws(()=>applyAction(p,'event-pray',{id:'statue-prayer',count:3},day(9)),/không hợp lệ/);
});
test('hour items pay the AFK rate of the best stage',()=>{
 const p=starterPlayer('Captain'),gold=p.wallet.gold;p.inventory['consumable:60']=1;applyAction(p,'use',{itemId:'consumable:60',quantity:1});assert.ok(p.wallet.gold>gold);
});
test('broken space costs a spyglass, advances on a win and loops',()=>{
 const p=starterPlayer('Captain'),id='broken-space',winFight=()=>{applyAction(p,'event-stage',{id},day(9));for(const e of p.battle.enemies)e.hp=1;for(const a of p.battle.allies){a.attack=a.baseAttack=1e7;a.speed=a.baseSpeed=1e6;a.hp=a.maxHp=1e9}while(p.battle.status==='active')applyAction(p,'battle-action',{battleId:p.battle.id,turn:p.battle.turn,action:'auto'},day(9));assert.equal(p.battle.status,'won')};
 assert.throws(()=>applyAction(p,'event-stage',{id},day(9)),/Không đủ/);
 p.inventory['consumable:20']=8;const gold=p.wallet.gold;winFight();
 assert.equal(p.inventory['consumable:20'],7);assert.equal(p.wallet.gold,gold+50000);assert.equal(playerView(p,day(9)).events[id].stage,1);
 for(let i=1;i<7;i++)winFight();
 const view=playerView(p,day(9)).events[id];assert.equal(view.stage,0);assert.equal(view.round,2);
 applyAction(p,'event-stage',{id},day(9));assert.equal(p.inventory['consumable:20'],0);applyAction(p,'battle-leave',{});assert.equal(playerView(p,day(9)).events[id].stage,0,'Leaving keeps the stage');
});
test('a stage fight crossing into a new month pays nothing',()=>{
 const p=starterPlayer('Captain'),id='broken-space',last=Date.UTC(2026,10,30,3);p.inventory['consumable:20']=1;applyAction(p,'event-stage',{id},last);const gold=p.wallet.gold;for(const e of p.battle.enemies)e.hp=1;for(const a of p.battle.allies){a.attack=a.baseAttack=1e7;a.speed=a.baseSpeed=1e6;a.hp=a.maxHp=1e9}
 while(p.battle.status==='active')applyAction(p,'battle-action',{battleId:p.battle.id,turn:p.battle.turn,action:'auto'},Date.UTC(2026,11,1,3));
 assert.equal(p.battle.reward.counted,false);assert.equal(p.wallet.gold,gold);
});
test('spyglasses can be bought with a monthly limit',()=>{
 const p=starterPlayer('Captain'),id='broken-space';p.wallet.diamonds=10000;for(let i=0;i<10;i++)applyAction(p,'event-buy',{id},day(9));assert.equal(p.inventory['consumable:20'],10);assert.equal(p.wallet.diamonds,9500);assert.throws(()=>applyAction(p,'event-buy',{id},day(9)),/hết lượt/);
 p.wallet.diamonds=0;assert.throws(()=>applyAction(p,'event-buy',{id},Date.UTC(2026,11,2,3)),/Không đủ/);
});
import {applyEventConfig,validateEventConfig,editableEvents} from '../server/events.mjs';
import {ensureRoster} from '../server/hero-roster.mjs';
import {isRewardId} from '../server/game.mjs';
test('EXP is one shared pool and old per-hero EXP is merged once',()=>{
 const p=starterPlayer('Captain');delete p.wallet.spirit;p.hero.exp=300;p.reserveHeroes={a:{id:'a',exp:200}};ensureRoster(p);assert.equal(p.wallet.spirit,500);assert.equal(p.hero.exp,0);
 ensureRoster(p);assert.equal(p.wallet.spirit,500,'Merging happens once');
 const q=starterPlayer('Captain'),start=q.wallet.spirit;applyAction(q,'upgrade',{type:'level'});assert.ok(q.wallet.spirit<start,'Levelling spends the pool');
});
test('the lucky wheel spends a coin per spin, counts spins and gives a free coin a day',()=>{
 const p=starterPlayer('Captain'),id='lucky-wheel';p.inventory['consumable:10']=11;
 const one=applyAction(p,'event-spin',{id,count:1},day(9));assert.equal(one.hits.length,1);assert.ok(one.hits[0]>=0&&one.hits[0]<14);
 applyAction(p,'event-spin',{id,count:10},day(9));assert.equal(playerView(p,day(9)).events[id].count,11);
 assert.throws(()=>applyAction(p,'event-spin',{id,count:10},day(9)),/Không đủ/);
 applyAction(p,'event-free',{id},day(9));assert.throws(()=>applyAction(p,'event-free',{id},day(9)),/đã nhận/);applyAction(p,'event-free',{id},day(10));
 applyAction(p,'event-claim',{id,index:0},day(10));assert.throws(()=>applyAction(p,'event-claim',{id,index:1},day(10)),/Chưa đạt/);
});
test('feast rollcall pays one row per day and stops at the end',()=>{
 const p=starterPlayer('Captain'),id='feast-rollcall',e=event(id);
 for(let i=0;i<e.days.length;i++)applyAction(p,'event-rollcall',{id},Date.UTC(2026,10,1+i,3));
 assert.throws(()=>applyAction(p,'event-rollcall',{id},Date.UTC(2026,10,20,3)),/hết quà/);
 assert.throws(()=>applyAction(p,'event-rollcall',{id},Date.UTC(2026,10,7,5)),/đã điểm danh/);
});
test('feast exchange without a limit can repeat',()=>{
 const p=starterPlayer('Captain');p.inventory['consumable:22']=90;for(let i=0;i<3;i++)applyAction(p,'event-exchange',{id:'feast',index:0},day(9));assert.equal(p.inventory['consumable:2']>=1800,true);
});
test('new counters: four-star summons, diamonds spent, five-star merges',()=>{
 const p=starterPlayer('Captain');p.wallet.diamonds=1000;p.inventory['consumable:16']=10;
 applyAction(p,'summon',{faction:'fortress',count:10},day(9));assert.ok(playerView(p,day(9)).events['summon-four'].count>=1,'Ten summons always hold an A-rank or better');
 applyAction(p,'event-exchange',{id:'gem-sale',index:0},day(9));assert.equal(playerView(p,day(9)).events['diamond-spend'].count,100);
 p.inventory['shard:30000']=50;applyAction(p,'shard-merge',{itemId:'shard:30000'},day(9));assert.equal(playerView(p,day(9)).events['merge-five'].count,1);
});
test('admin config replaces rewards and validates input',()=>{
 const edit=validateEventConfig('lucky-summon',{title:'Quay Vui',milestones:[{target:5,rewards:[{itemId:'spirit',quantity:9}]}]},isRewardId);
 applyEventConfig([{_id:'lucky-summon',config:edit},{_id:'checkin',config:{rewards:[{itemId:'gold',quantity:7}]}}]);
 const e=event('lucky-summon');assert.equal(e.title,'Quay Vui');assert.equal(e.milestones[0].title,'Quay 5 lượt');assert.equal(e.counter,'summon','Structure stays');
 const p=starterPlayer('Captain'),gold=p.wallet.gold;applyAction(p,'daily',{},day(9));assert.equal(p.wallet.gold,gold+7);
 trackEvent(p,'summon',5,day(9));const spirit=p.wallet.spirit;applyAction(p,'event-claim',{id:'lucky-summon',index:0},day(9));assert.equal(p.wallet.spirit,spirit+9);
 assert.throws(()=>validateEventConfig('lucky-summon',{milestones:[{target:5,rewards:[{itemId:'nope',quantity:1}]}]},isRewardId),/không tồn tại/);
 assert.throws(()=>validateEventConfig('lucky-summon',{milestones:[{target:5,rewards:[{itemId:'gold',quantity:1}]},{target:3,rewards:[{itemId:'gold',quantity:1}]}]},isRewardId),/tăng dần/);
 assert.throws(()=>validateEventConfig('lucky-wheel',{...editableEvents().defaults.events.find(x=>x.id==='lucky-wheel'),slots:[{weight:1,reward:{itemId:'gold',quantity:1}}]},isRewardId),/14 ô/);
 assert.throws(()=>validateEventConfig('nope',{},isRewardId),/không tồn tại/);
 applyEventConfig([]);assert.equal(event('lucky-summon').title,'Quay Tướng May Mắn');assert.equal(checkinRewards.length,30);
});
test('wheel coins can be bought with diamonds up to the monthly limit',()=>{
 const p=starterPlayer('Captain'),id='lucky-wheel',e=event(id),coins=p.inventory['consumable:10']||0;p.wallet.diamonds=e.buy.cost.quantity*e.buy.limit+5;
 const result=applyAction(p,'event-buy',{id,count:3},day(9));assert.equal(p.inventory['consumable:10'],coins+3);assert.deepEqual(result.rewards,[{itemId:'consumable:10',quantity:3}]);
 assert.equal(p.wallet.diamonds,e.buy.cost.quantity*(e.buy.limit-3)+5);
 assert.throws(()=>applyAction(p,'event-buy',{id,count:e.buy.limit-2},day(9)),/hết lượt/);
 assert.throws(()=>applyAction(p,'event-buy',{id:'feast',count:1},day(9)),/không bán/);
});
