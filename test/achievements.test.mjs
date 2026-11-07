import {test} from 'node:test';
import assert from 'node:assert/strict';
import {starterPlayer,applyAction,playerView} from '../server/game.mjs';

const now=Date.UTC(2026,10,7,5);
const find=(p,id)=>playerView(p,now).achievements.find(a=>a.id===id);

test('level achievement uses the original wording and pays 10K Beli + 50 diamonds at the first tier',()=>{
 const p=starterPlayer('ach');
 let a=find(p,'level');assert.equal(a.text,'Đạt cấp 10');assert.equal(a.status,0);
 assert.deepEqual(a.rewards,[{itemId:'gold',quantity:10000},{itemId:'diamonds',quantity:50}]);
 assert.throws(()=>applyAction(p,'achievement-claim',{id:'level'},now),/Chưa hoàn thành/);
 p.account.level=37;a=find(p,'level');assert.equal(a.status,1);assert.equal(playerView(p,now).achievements[0].status,1,'claimable rows go first');
 const gold=p.wallet.gold,gems=p.wallet.diamonds,r=applyAction(p,'achievement-claim',{id:'level'},now);
 assert.equal(p.wallet.gold,gold+10000);assert.equal(p.wallet.diamonds,gems+50);assert.equal(r.rewards.length,2);
 a=find(p,'level');assert.equal(a.text,'Đạt cấp 20');assert.equal(a.rewards[0].quantity,20000);
 applyAction(p,'achievement-claim',{id:'level'},now);applyAction(p,'achievement-claim',{id:'level'},now);
 assert.throws(()=>applyAction(p,'achievement-claim',{id:'level'},now),/Chưa hoàn thành/);
});

test('star, tower and summon achievements read the player state; finished ones show as done',()=>{
 const p=starterPlayer('ach2');p.hero.stars=7;
 assert.equal(find(p,'stars-7').status,1);assert.equal(find(p,'stars-7').text,'Sở hữu 1 thuyền viên 7 sao');assert.equal(find(p,'stars-8').status,0);
 p.tower.floor=8;assert.equal(find(p,'tower').progress,7);assert.equal(find(p,'tower').text,'Vượt tầng 1 Tháp Lãng Quên');
 p.account.level=100;for(let i=0;i<10;i++)applyAction(p,'achievement-claim',{id:'level'},now);
 assert.equal(find(p,'level').status,2);assert.throws(()=>applyAction(p,'achievement-claim',{id:'level'},now),/hết/);
 assert.equal(playerView(p,now).achievements.at(-1).id,'level','finished rows go last');
 assert.throws(()=>applyAction(p,'achievement-claim',{id:'nope'},now),/không hợp lệ/);
});
