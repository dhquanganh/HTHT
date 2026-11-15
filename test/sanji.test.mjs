import {test,describe,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {starterPlayer,applyAction,playerView,isRewardId} from '../server/game.mjs';
import {Store} from '../server/store.mjs';
import {sanjiConfig,defaultSanjiConfig,validateSanjiConfig,spoonItem,seasonOf,topReward} from '../server/sanji.mjs';
try{process.loadEnvFile('.env')}catch{}

const now=Date.UTC(2026,10,16,3),H=3600000,D=24*H;
const player=()=>{const p=starterPlayer('Sanji');p.account.level=40;p.wallet.diamonds=10000;p.wallet.gold=1e7;return p};
const view=(p,t=now)=>playerView(p,t).sanji;

test('cấu hình mặc định hợp lệ; mốc trùng điểm và hạng top chồng nhau bị từ chối',()=>{
 const c=defaultSanjiConfig();assert.deepEqual(validateSanjiConfig(c,isRewardId),c);
 assert.throws(()=>validateSanjiConfig({...c,milestones:[c.milestones[0],c.milestones[0]]},isRewardId),/trùng điểm/);
 assert.throws(()=>validateSanjiConfig({...c,top:[{...c.top[0],to:5},{...c.top[1],from:3,to:6}]},isRewardId),/chồng hạng/);
 assert.deepEqual(topReward(1,500),c.top[0].rewards);assert.equal(topReward(1,10),null);assert.equal(topReward(999,9999),null);
});

test('tặng món: phí, Thìa + Tim, thời gian hồi, tăng tốc bằng kim cương',()=>{
 const p=player(),[pizza,noodle,roast]=sanjiConfig().dishes;
 applyAction(p,'sanji-send',{dish:1},now);let v=view(p);
 assert.equal(v.hearts,pizza.hearts);assert.equal(p.inventory[spoonItem],pizza.spoons);assert.equal(v.cooldownUntil,now+pizza.cooldownHours*H);
 assert.throws(()=>applyAction(p,'sanji-send',{dish:2},now),/chờ hoặc tăng tốc/);
 assert.equal(view(p,now+10*60000).skipFee,sanjiConfig().skipPerHour);
 const d=p.wallet.diamonds;applyAction(p,'sanji-skip',{},now+10*60000);assert.equal(p.wallet.diamonds,d-sanjiConfig().skipPerHour);
 const g=p.wallet.gold;applyAction(p,'sanji-send',{dish:2},now+11*60000);assert.equal(p.wallet.gold,g-noodle.fee.quantity);
 applyAction(p,'sanji-send',{dish:3},now+11*60000+noodle.cooldownHours*H);assert.equal(view(p,now+D).hearts,pizza.hearts+noodle.hearts+roast.hearts);
 assert.throws(()=>applyAction(player(),'sanji-skip',{},now),/Không cần/);
});

test('quà mốc Tim, cửa hàng Đầu Bếp (Thìa, giới hạn), mùa mới làm lại',()=>{
 const p=player(),m=sanjiConfig().milestones[0];
 assert.throws(()=>applyAction(p,'sanji-claim',{point:m.point},now),/Chưa đủ/);
 for(let i=0;i<10;i++)applyAction(p,'sanji-send',{dish:1},now+i*2*H);
 const g=p.wallet.gold;applyAction(p,'sanji-claim',{point:m.point},now+D);assert.ok(p.wallet.gold>g);assert.throws(()=>applyAction(p,'sanji-claim',{point:m.point},now+D),/Đã nhận/);
 const x=sanjiConfig().shop[1];p.inventory[spoonItem]=x.price*x.limit;applyAction(p,'sanji-buy',{id:x.id,count:x.limit},now+D);assert.equal(p.inventory[spoonItem]||0,0);
 assert.throws(()=>applyAction(p,'sanji-buy',{id:x.id},now+D),/Chỉ mua thêm được 0/);
 const next=now+7*D;assert.equal(view(p,next).hearts,0);assert.equal(view(p,next).shop[1].bought,0);assert.notEqual(seasonOf(next),seasonOf(now));
});

describe('Bữa tiệc Sanji on MongoDB',{skip:!process.env.MONGODB_URI},()=>{
 const database='htps_sanji_'+randomUUID().replaceAll('-','').slice(0,12);let store,a,b;
 before(async()=>{store=new Store(process.env.MONGODB_URI,database);await store.connect();
  a=await store.createUser('sanji_a','password-sanji-1');b=await store.createUser('sanji_b','password-sanji-2');
  for(const u of [a,b]){const doc=await store.users.findOne({_id:u._id}),p={...starterPlayer(doc.player.displayName),version:doc.player.version};p.account.level=40;p.wallet.diamonds=10000;await store.users.updateOne({_id:u._id},{$set:{player:p}})}});
 after(async()=>{assert.match(database,/^htps_sanji_[a-f0-9]{12}$/);if(store){clearInterval(store.novaTimer);await store.db.dropDatabase();await store.close()}});
 test('tặng món ghi bảng xếp hạng; hết mùa gửi thưởng top qua thư một lần',async()=>{
  const ida=a._id.toHexString(),idb=b._id.toHexString();
  await store.sanjiSend(ida,randomUUID(),{dish:3});await store.sanjiSend(idb,randomUUID(),{dish:1});
  let r=await store.sanjiRanks(ida);assert.equal(r.myRank,1);assert.equal(r.rows.length,2);assert.equal(r.rows[0].me,true);assert.ok(r.rows[0].points>r.rows[1].points);
  assert.equal((await store.sanjiRanks(idb)).myRank,2);
  // Đẩy điểm đủ mức top rồi sang tuần sau.
  await store.sanjiRank.updateOne({_id:`${r.season}:${ida}`},{$set:{points:600}});
  store.sanjiTime=Date.now()+7*D;await store.sanjiRanks(ida);await store.sanjiRanks(ida);
  const mail=(await store.getUser(ida)).player.mail.filter(m=>m.title==='Bữa tiệc Sanji');assert.equal(mail.length,1);
  assert.equal((await store.getUser(idb)).player.mail.filter(m=>m.title==='Bữa tiệc Sanji').length,0,'hạng 2 dưới điểm tối thiểu');
 });
});
