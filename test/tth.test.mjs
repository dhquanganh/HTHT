import {test,describe,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {starterPlayer,applyAction,playerView} from '../server/game.mjs';
import {tthData,bossOfDay,bossUnit,tthDay,startDay,vnDay,milestones,rankReward,freePerDay,buyPrice} from '../server/tth.mjs';
import {Store} from '../server/store.mjs';
try{process.loadEnvFile('.env')}catch{}

test('original TTHDb: 4 Yonko in hub order, daily rotation (day 19 = Shanks Yonko, level 190), original skills',()=>{
 assert.deepEqual(tthData.bosses.map(b=>[b.heroKey,b.name]),[[512,'Luffy Yonko'],[479,'Buggy Yonko'],[557,'Shanks Yonko'],[548,'Blackbeard Yonko']]);
 assert.equal(bossOfDay(19).name,'Shanks Yonko');assert.equal(bossUnit(19).level,190);assert.equal(bossOfDay(1).name,'Luffy Yonko');assert.equal(bossOfDay(5).name,'Luffy Yonko');
 for(const b of tthData.bosses)assert.equal(b.skills.length,4);
 assert.ok(bossUnit(20).maxHp>bossUnit(16).maxHp,'boss mạnh lên mỗi ngày');assert.ok(bossUnit(3).endless);
 assert.equal(tthDay(Date.parse('2026-11-01T08:00:00+07:00')),1);assert.equal(rankReward(1)[0].quantity,500);assert.equal(buyPrice(10),-1);
});

const strong=()=>{const p=starterPlayer('Tth');p.hero.level=150;p.hero.stars=8;p.wallet.diamonds=5000;return p};
test('10 free attacks a day, buy more with gems, boss never dies, best single hit and milestones are kept for the day',()=>{
 const p=strong(),v=playerView(p).tth;assert.equal(v.attacksLeft,freePerDay);assert.equal(v.bossName,bossOfDay(tthDay()).name);
 applyAction(p,'tth-attack',{skip:true});const b=p.battle;assert.equal(b.status,'won');assert.ok(b.enemies[0].hp>0,'boss không chết');assert.ok(b.reward.damage>0);
 const after=playerView(p).tth;assert.equal(after.attacksLeft,freePerDay-1);assert.equal(after.myBest,b.reward.damage);
 const reached=milestones.filter((_,i)=>b.reward.damage>=after.milestones[i].threshold).length;assert.equal(after.milestones.filter(m=>m.claimed).length,reached);
 for(let i=1;i<freePerDay;i++)applyAction(p,'tth-attack',{skip:true});
 assert.throws(()=>applyAction(p,'tth-attack',{skip:true}),/hết lượt/);
 const gems=p.wallet.diamonds;applyAction(p,'tth-buy',{});assert.equal(p.wallet.diamonds,gems-50);applyAction(p,'tth-attack',{skip:true});
});

describe('Tân Tứ Hoàng ranking on MongoDB',{skip:!process.env.MONGODB_URI},()=>{
 const database='htps_tth_'+randomUUID().replaceAll('-','').slice(0,12);let store,a,b;const key=()=>randomUUID();
 before(async()=>{store=new Store(process.env.MONGODB_URI,database);await store.connect();a=await store.createUser('tth_a','password-tth-1');b=await store.createUser('tth_b','password-tth-2');
  await store.users.updateOne({_id:a._id},{$set:{'player.hero.level':150,'player.hero.stars':8}});});
 after(async()=>{assert.match(database,/^htps_tth_[a-f0-9]{12}$/);if(store){await store.db.dropDatabase();await store.close()}});
 test('each attack keeps the best single damage per day / boss; ranking per boss; daily rank rewards are mailed once',async()=>{
  const A=a._id.toHexString(),B=b._id.toHexString(),day=tthDay(),boss=bossOfDay(day).index;
  const r1=await store.mutate(A,key(),'tth-attack',{skip:true});const d1=r1.player.battle.reward.damage;assert.equal(r1.result.tth.rank,1);
  await store.mutate(B,key(),'tth-attack',{skip:true});
  const rank=await store.tthRanking(A);assert.equal(rank.boss,boss);assert.equal(rank.top.length,2);assert.equal(rank.top[0].name,'tth_a');assert.equal(rank.me.rank,1);assert.equal(rank.me.damage,d1);
  const other=await store.tthRanking(A,(boss+1)%4);assert.equal(other.top.length,0);
  assert.equal(await store.tthScores.countDocuments({day,boss}),2);
  // Sang ngày mới: trả thưởng ngày hôm qua đúng một lần.
  await store.tthScores.updateMany({},{$set:{day:day-1,boss:bossOfDay(day-1).index}});await store.tthMeta.updateOne({_id:'paid'},{$set:{day:day-2}});
  await store.tthTick();await store.tthTick();
  const mails=(await store.getUser(a._id)).player.mail.filter(m=>m.title==='Thưởng Tân Tứ Hoàng');assert.equal(mails.length,1);assert.match(mails[0].text,/hạng 1/);
 });
});
