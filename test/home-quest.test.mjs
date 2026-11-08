import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView} from '../server/game.mjs';
import {homeQuests,questText} from '../server/home-quest.mjs';

const now=Date.UTC(2026,10,8,5);
const view=p=>playerView(p,now).homeQuest;

test('db_home_quest is the full 1333-step chain and every step keeps a reward',()=>{
 assert.equal(homeQuests.length,1333);assert.ok(homeQuests.every(q=>q.rewards.length>0));
 assert.equal(questText(homeQuests[17]),'Vượt ải 4-5');assert.equal(questText(homeQuests[1]),'Sở hữu 1 thuyền viên đạt cấp 5');
 assert.equal(homeQuests[4].rewards[0].itemId,'heroshard:164','Giải Cứu Zoro gives Zoro shards');
});

test('the box shows the original stage code and "x/y" progress, and claiming moves to the next step',()=>{
 const p=starterPlayer('hq');p.homeQuest={index:17,count:0};p.adventure.cleared=Array.from({length:30},(_,i)=>i+1);
 let q=view(p);assert.equal(q.text,'Vượt ải 4-5');assert.equal(q.progress,30);assert.equal(q.target,35);assert.equal(q.done,false);assert.equal(q.go,'campaign');
 assert.deepEqual(q.rewards[0],{itemId:'consumable:3',quantity:100});
 assert.throws(()=>applyAction(p,'home-quest-claim',{},now),/Chưa hoàn thành/);
 p.adventure.cleared.push(31,32,33,34,35);assert.equal(view(p).done,true);
 const dust=p.inventory['consumable:3']||0,r=applyAction(p,'home-quest-claim',{},now);
 assert.equal(p.inventory['consumable:3'],dust+100);assert.equal(r.rewards.length,2);
 q=view(p);assert.equal(q.id,19);assert.equal(q.text,'Vượt qua tháp 1');assert.equal(q.go,'tower');
});

test('the first quest is "Vượt ải 1-1" and Đá EXP rewards go into the shared EXP wallet',()=>{
 const p=starterPlayer('hq1');assert.equal(view(p).text,'Vượt ải 1-1');
 p.adventure.cleared=[1];const spirit=p.wallet.spirit,gold=p.wallet.gold;applyAction(p,'home-quest-claim',{},now);
 assert.equal(p.wallet.spirit,spirit+5000);assert.equal(p.wallet.gold,gold+5000);
});

test('stone upgrades count only while that quest is current; guild-skill and sky-island steps are skipped',()=>{
 const p=starterPlayer('hq2'),stoneIndex=homeQuests.findIndex(q=>q.type===5);
 p.homeQuest={index:stoneIndex,count:0};assert.match(view(p).text,/Nâng 1 lần đá hộ mệnh/);assert.equal(view(p).progress,0);
 p.hero.level=60;p.account.level=60;p.wallet.gold=1e9;p.inventory['consumable:3']=1e6;applyAction(p,'stone-unlock',{},now);
 assert.equal(view(p).done,false,'unlocking is not an upgrade');applyAction(p,'stone-upgrade',{},now);assert.equal(view(p).done,true);
 const skipped=homeQuests.findIndex(q=>q.type===6);p.homeQuest={index:skipped,count:0};
 assert.notEqual(view(p).id,homeQuests[skipped].id);assert.ok(![6,7].includes(homeQuests.find(q=>q.id===view(p).id).type));
 p.homeQuest={index:homeQuests.length,count:0};assert.deepEqual(view(p),{finished:true});assert.throws(()=>applyAction(p,'home-quest-claim',{},now),/mọi nhiệm vụ/);
});
