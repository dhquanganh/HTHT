import {test,describe,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Store} from '../server/store.mjs';
import {heroDefinitions,heroKits} from '../server/catalog.mjs';
import {grantSummon} from '../server/summon.mjs';
import {schedule,scheduleRows,stages,validateNovaConfig,defaultNovaConfig,rankGroup,quickSeries,seeded,currency} from '../server/nova.mjs';
import {isRewardId} from '../server/game.mjs';
try{process.loadEnvFile('.env')}catch{}

// Mùa chứa thứ Hai 16/11/2026 (giờ VN).
const monday=Date.UTC(2026,10,15,17)+60000,H=3600000,D=24*H;

test('lịch: Đăng ký thứ Hai, 4 vòng thứ Ba - thứ Sáu (chuẩn bị / đánh tự do / tự động), vòng 16 thứ Bảy, nghỉ Chủ nhật',()=>{
 const s=schedule(monday);assert.equal(s.status,0);assert.equal(new Date(s.start+7*H).getUTCDay(),1);
 assert.deepEqual([schedule(monday+D+2*H),schedule(monday+D+10*H),schedule(monday+D+23*H)].map(x=>[x.status,x.state]),[[1,1],[1,2],[1,3]]);
 assert.deepEqual([schedule(monday+4*D+12*H).status,schedule(monday+5*D+13*H).state,schedule(monday+5*D+21*H).state,schedule(monday+6*D).status],[4,2,3,-1]);
 assert.equal(schedule(monday+7*D).season,s.season+1);assert.equal(scheduleRows(monday+D+10*H).find(r=>r.roundId===1).status,1);
 assert.equal(stages[1].field,256);assert.equal(stages[4].field/stages[4].group*stages[4].advance,16);
});

test('xếp hạng nhóm, kết quả nhanh theo lực chiến, cấu hình quản trị hợp lệ',()=>{
 assert.deepEqual(rankGroup([{id:'a',wins:2,teamWins:4},{id:'b',wins:3,teamWins:6},{id:'c',wins:2,teamWins:5}]).map(x=>x.id),['b','c','a']);
 const r=seeded(1);let strong=0;for(let i=0;i<200;i++)if(quickSeries(3e6,1e6,r).win)strong++;assert.ok(strong>170);
 const c=defaultNovaConfig();assert.deepEqual(validateNovaConfig(c,isRewardId),c);
 assert.throws(()=>validateNovaConfig({...c,finalRewards:c.finalRewards.slice(1)},isRewardId),/vô địch/);
});

describe('Đấu Trường Tân Tinh on MongoDB',{skip:!process.env.MONGODB_URI},()=>{
 const database='htps_nova_'+randomUUID().replaceAll('-','').slice(0,12);let store,a,b;const key=()=>randomUUID();
 const ss=heroDefinitions.filter(d=>heroKits.has(d.id)&&d.id!=='luffy-gear-2').slice(0,18);
 before(async()=>{store=new Store(process.env.MONGODB_URI,database);store.novaTime=monday;await store.connect();
  a=await store.createUser('nova_a','password-nova-1');b=await store.createUser('nova_b','password-nova-2');
  for(const u of [a,b]){const doc=await store.users.findOne({_id:u._id}),p=doc.player;p.reserveHeroes??={};p.account.level=90;for(const d of ss){grantSummon(p,{avatar:d.avatar});const h=p.reserveHeroes[d.id];if(h)h.level=300}p.inventory[currency]=5000;await store.users.updateOne({_id:u._id},{$set:{player:p}})}});
 after(async()=>{assert.match(database,/^htps_nova_[a-f0-9]{12}$/);if(store){clearInterval(store.novaTimer);await store.db.dropDatabase();await store.close()}});
 const teams=()=>[ss.slice(0,6),ss.slice(6,12),ss.slice(12,18)].map(t=>t.map(d=>d.id));
 test('một mùa: đăng ký → 4 vòng (thách đấu trong nhóm) → vòng 16 + dự đoán → vinh danh + thích',async()=>{
  const id=a._id.toHexString();
  let st=await store.novaStatus(id);assert.equal(st.status,0);assert.equal(st.registered,false);assert.equal(st.recommend.length,5);
  const reg=await store.novaTeam(id,key(),{teams:teams()});assert.equal(reg.result.registered,true);
  await store.novaTeam(b._id.toHexString(),key(),{teams:teams()});
  st=await store.novaStatus(id);assert.equal(st.registered,true);assert.ok(st.power>0);assert.equal(st.quests.find(q=>q.kind==='register').status,1);
  // Vòng loại 1: chuẩn bị → không đánh được; đánh tự do → đánh 1 đối thủ trong nhóm.
  store.novaTime=monday+D+2*H;st=await store.novaStatus(id);assert.equal(st.status,1);assert.equal(st.board.opponents.length,7);
  await assert.rejects(store.novaAttack(id,key(),{opponentId:st.board.opponents[0].id}),/chuẩn bị/);
  store.novaTime=monday+D+10*H;const opp=st.board.opponents[0].id,fight=await store.novaAttack(id,key(),{opponentId:opp});
  assert.ok(Array.isArray(fight.result.nova.score));
  st=await store.novaStatus(id);assert.equal(st.board.matches,6);assert.equal(st.board.opponents.find(o=>o.id===opp).attacked,true);
  await assert.rejects(store.novaAttack(id,key(),{opponentId:opp}),/Đã khiêu chiến/);
  assert.equal(await store.novaEntries.countDocuments({season:st.season,'groups.1':{$exists:true}}),256);
  // Qua hết các vòng: lượt còn lại tự đánh, top đi tiếp, thưởng vòng qua thư.
  store.novaTime=monday+5*D+13*H;st=await store.novaStatus(id);assert.equal(st.status,5);
  for(const k of [1,2,3,4])assert.equal(await store.novaEntries.countDocuments({season:st.season,stage:{$gte:k+1}}),stages[k].field/stages[k].group*stages[k].advance);
  const ea=await store.novaEntries.findOne({_id:`${st.season}:${id}`});assert.equal(Object.keys(ea.results[1].attacks).length,7);
  const mail=(await store.getUser(id)).player.mail;assert.ok(mail.some(m=>/Tân Tinh/.test(m.title)));
  assert.equal(st.bracket.r16.length,8);assert.ok(st.bracket.r16.every(m=>m.a&&m.b));
  const m=st.bracket.r16[0];await store.novaBet(id,key(),{matchId:m.id,pick:m.a.id});
  await assert.rejects(store.novaBet(id,key(),{matchId:m.id,pick:m.b.id}),/đã dự đoán/);
  st=await store.novaStatus(id);assert.equal(st.bracket.r16[0].mine,m.a.id);assert.equal(st.bracket.r16[0].betsA,1);
  // Chủ nhật: đã xử lý cả 4 vòng loại trực tiếp, cược đã trả, có top 4.
  store.novaTime=monday+6*D+H;st=await store.novaStatus(id);assert.equal(st.status,-1);
  assert.equal(st.bracket.final[0].winner!=null,true);const bet=await store.novaBets.findOne({matchId:m.id});assert.equal(bet.settled,true);
  const top=await store.novaTop();assert.equal(top[0].players.length,4);
  const liked=await store.novaLike(id,key(),{entryId:top[0].players[0].id});assert.ok(liked.result.rewards.length);
  await assert.rejects(store.novaLike(id,key(),{entryId:top[0].players[0].id}),/đã thích/);
  assert.equal((await store.novaTop())[0].players[0].likes,1);
  // Chủ nhật đăng ký trước cho mùa sau.
  await store.novaTeam(id,key(),{teams:teams()});assert.ok(await store.novaEntries.findOne({_id:`${st.season+1}:${id}`}));
  assert.equal((await store.novaStatus(id)).registered,true);
  const ranks=await store.novaRanks(id,1);assert.equal(ranks.rows.length,8);assert.ok(ranks.groups>=32);
  const hist=await store.novaHistory(id);assert.equal(hist.rounds[0].rows.length,7);
 });
 test('nhiệm vụ và cửa hàng',async()=>{
  const id=b._id.toHexString(),season=schedule(store.novaTime).season;
  const q=await store.mutate(id,key(),'nova-quest',{id:1},{nova:{season:schedule(monday).season}}).catch(e=>e);
  const shop=await store.mutate(id,key(),'nova-shop',{id:6,count:2},{nova:{season}});assert.equal(shop.result.rewards[0].quantity,1000000);
  await assert.rejects(store.mutate(id,key(),'nova-shop',{id:4,count:2},{nova:{season}}),/Chỉ mua thêm được 1/);
  assert.ok(q);
 });
});
