import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,playerView,starterPlayer} from '../server/game.mjs';
import {dailyQuests,dailyResetIn} from '../server/daily-quests.mjs';

const now=Date.UTC(2026,10,8,3,0,0); // 10:00 giờ Việt Nam
const claim=(p,id,at=now)=>applyAction(p,'daily-quest-claim',{id},at);

test('ten original daily quests with the rewards shown in the asset',()=>{
 assert.equal(dailyQuests.length,10);
 assert.deepEqual(dailyQuests.slice(0,3).map(q=>q.name),['Chiêu mộ thường 1 lần','Chiêu mộ cao cấp 1 lần','Dùng Khu giao dịch 1 lần']);
 assert.deepEqual(dailyQuests[2].rewards,[{itemId:'gold',quantity:60000},{itemId:'spirit',quantity:1500},{itemId:'vipExp',quantity:10}]);
});
test('summons advance basic and premium quests and pay once',()=>{
 const p=starterPlayer('Daily');p.inventory['consumable:16']=11;
 applyAction(p,'summon',{faction:'abyss',count:1},now);applyAction(p,'summon',{faction:'abyss',count:10},now);
 const v=playerView(p,now).dailyQuest;assert.equal(v.ready,true);assert.deepEqual(v.quests.slice(0,2).map(q=>q.progress),[1,1]);
 const gold=p.wallet.gold,spirit=p.wallet.spirit;claim(p,'summon-premium');
 assert.equal(p.wallet.gold,gold+40000);assert.equal(p.wallet.spirit,spirit+1000);
 assert.throws(()=>claim(p,'summon-premium'),/Đã nhận/);assert.throws(()=>claim(p,'trade'),/chưa hoàn thành/);
});
test('progress stops at the target and failed actions do not count',()=>{
 const p=starterPlayer('Daily');p.inventory['consumable:16']=0;
 assert.throws(()=>applyAction(p,'summon',{faction:'abyss',count:1},now));
 assert.equal(playerView(p,now).dailyQuest.quests[0].progress,0);
});
test('all ten claimed unlocks diamonds and magic dust once',()=>{
 const p=starterPlayer('Daily');p.dailyQuests={day:'2026-11-08',progress:Object.fromEntries(dailyQuests.map(q=>[q.id,q.target])),claimed:[],final:false};
 assert.throws(()=>claim(p,'final'),/Cần hoàn thành 10/);
 for(const q of dailyQuests)claim(p,q.id);
 const gems=p.wallet.diamonds,dust=p.inventory['consumable:3']||0;claim(p,'final');
 assert.equal(p.wallet.diamonds,gems+100);assert.equal(p.inventory['consumable:3'],dust+15);assert.throws(()=>claim(p,'final'),/Đã nhận/);
});
test('quests reset at midnight Vietnam time',()=>{
 const p=starterPlayer('Daily');p.inventory['consumable:16']=1;applyAction(p,'summon',{faction:'abyss',count:1},now);
 assert.equal(dailyResetIn(now),14*3600);
 const tomorrow=now+14*3600*1000;assert.equal(playerView(p,tomorrow).dailyQuest.quests[0].progress,0);
});
