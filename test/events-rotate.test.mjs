import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,playerView,starterPlayer} from '../server/game.mjs';
import {heroDefinitions} from '../server/catalog.mjs';
import {eventList,publicEvents,milestonesOf} from '../server/events.mjs';

// 2026-11-09 và 2026-11-16 là thứ Hai: hai kỳ tuần khác nhau.
const at=(d,h=3)=>Date.UTC(2026,10,d,h),wanted=()=>eventList.find(e=>e.id==='wanted-summon');
const ssShards=new Set(heroDefinitions.filter(h=>h.rank===6&&!h.custom).map(h=>'heroshard:'+h.avatar));

test('wanted-summon last milestone is 50 shards of a random SS hero, fixed within a week and rerolled per week',()=>{
 const e=wanted(),last=m=>m.at(-1);
 assert.equal(last(e.milestones).target,240);
 const a=last(milestonesOf(e,at(10))),b=last(milestonesOf(e,at(15,16))),picks=new Set();
 assert.deepEqual(a.rewards,b.rewards,'cùng một tuần thì cùng một tướng');
 assert.equal(a.rewards.length,1);assert.equal(a.rewards[0].quantity,50);assert.ok(ssShards.has(a.rewards[0].itemId),a.rewards[0].itemId);
 for(let w=0;w<12;w++)picks.add(last(milestonesOf(e,at(2)+w*7*86400000)).rewards[0].itemId);
 assert.ok(picks.size>=6,'tướng SS đổi giữa các tuần: '+picks.size);
 // Các mốc khác giữ nguyên; danh sách gửi client đã áp mốc của kỳ.
 assert.deepEqual(milestonesOf(e,at(10)).slice(0,-1),e.milestones.slice(0,-1));
 assert.deepEqual(publicEvents(at(10)).find(x=>x.id==='wanted-summon').milestones.at(-1).rewards,a.rewards);
});

test('event progress resets to zero when the period ends and the 240 milestone grants the SS shards',()=>{
 const p=starterPlayer('Captain'),e=wanted(),now=at(10);p.inventory['consumable:16']=300;
 for(let i=0;i<24;i++)applyAction(p,'summon',{faction:'abyss',count:10},now);
 assert.equal(playerView(p,now).events['wanted-summon'].count,240);
 const shard=milestonesOf(e,now).at(-1).rewards[0],before=p.inventory[shard.itemId]||0;
 applyAction(p,'event-claim',{id:'wanted-summon',index:e.milestones.length-1},now);
 assert.equal(p.inventory[shard.itemId],before+50);
 const view=playerView(p,now).events['wanted-summon'];assert.ok(view.endsAt===Date.UTC(2026,10,15,17),'kết thúc 00:00 thứ Hai giờ Việt Nam');
 // Sang tuần mới: tiến độ và mốc đã nhận về 0, nhận lại được từ đầu.
 const next=at(17),fresh=playerView(p,next).events['wanted-summon'];
 assert.equal(fresh.count,0);assert.deepEqual(fresh.claimed,[]);
 assert.throws(()=>applyAction(p,'event-claim',{id:'wanted-summon',index:0},next),/Chưa đạt/);
 applyAction(p,'summon',{faction:'abyss',count:10},next);assert.equal(playerView(p,next).events['wanted-summon'].count,10);
 applyAction(p,'event-claim',{id:'wanted-summon',index:0},next);
});
